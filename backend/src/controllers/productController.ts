import { Request, Response } from 'express';
import Product from '@/models/Product';
import Category from '@/models/Category';
import InventoryAdjustment from '@/models/InventoryAdjustment';
import { sendSuccess, sendError } from '@/utils/response';
import logger from '@/utils/logger';
import { TokenPayload } from '@/services/authService';

interface AuthenticatedRequest extends Omit<Request, 'user'> {
  user: TokenPayload;
}

export class ProductController {
  /**
   * Get all products with search, filter, and pagination
   */
  static async getProducts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { 
        search, 
        category, 
        page = 1, 
        limit = 50, 
        sortBy = 'name', 
        sortOrder = 'asc',
        lowStock = false,
        updatedAfter
      } = req.query;

      const storeId = req.user?.storeId;
      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      // Build query
      const query: any = { storeId, isActive: true };

      // Incremental pull: only documents updated on or after this time (ISO or timestamp ms)
      if (updatedAfter) {
        const after = typeof updatedAfter === 'string' && /^\d+$/.test(updatedAfter)
          ? new Date(Number(updatedAfter))
          : new Date(updatedAfter as string);
        if (!isNaN(after.getTime())) {
          query.updatedAt = { $gte: after };
        }
      }

      // Add search filter
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { sku: { $regex: search, $options: 'i' } },
          { barcode: search }
        ];
      }

      // Add category filter
      if (category) {
        query.categoryId = category;
      }

      // Add low stock filter
      if (lowStock === 'true') {
        query.$expr = { $lte: ['$stockQuantity', '$lowStockThreshold'] };
      }

      // Build sort object
      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      // Calculate pagination
      const skip = (Number(page) - 1) * Number(limit);

      // Execute query
      const [products, total] = await Promise.all([
        Product.find(query)
          .populate('categoryId', 'name')
          .sort(sort)
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        Product.countDocuments(query)
      ]);

      const payload: any = {
        products,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      };
      if (updatedAfter !== undefined) {
        payload.serverTimestamp = new Date().toISOString();
      }
      sendSuccess(res, payload);
    } catch (error) {
      logger.error('Error fetching products:', error);
      sendError(res, 'Failed to fetch products', 500);
    }
  }

  /**
   * Get a single product by ID
   */
  static async getProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const storeId = req.user?.storeId;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      const product = await Product.findOne({ _id: id, storeId, isActive: true })
        .populate('categoryId', 'name');

      if (!product) {
        sendError(res, 'Product not found', 404);
        return;
      }

      sendSuccess(res, product);
    } catch (error) {
      logger.error('Error fetching product:', error);
      sendError(res, 'Failed to fetch product', 500);
    }
  }

  /**
   * Create a new product
   */
  static async createProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const storeId = req.user?.storeId;
      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      const productData = {
        ...req.body,
        storeId
      };

      // Check if SKU already exists in store
      const existingSku = await Product.findOne({ 
        storeId, 
        sku: productData.sku 
      });
      
      if (existingSku) {
        sendError(res, 'SKU already exists in this store', 400);
        return;
      }

      // Check if barcode already exists (if provided)
      if (productData.barcode) {
        const existingBarcode = await Product.findOne({ 
          storeId, 
          barcode: productData.barcode 
        });
        
        if (existingBarcode) {
          sendError(res, 'Barcode already exists in this store', 400);
          return;
        }
      }

      // Verify category exists
      const category = await Category.findOne({ 
        _id: productData.categoryId, 
        storeId, 
        isActive: true 
      });
      
      if (!category) {
        sendError(res, 'Category not found', 400);
        return;
      }

      const product = new Product(productData);
      await product.save();

      const populatedProduct = await Product.findById(product._id)
        .populate('categoryId', 'name');

      sendSuccess(res, populatedProduct, 'Product created successfully', 201);
    } catch (error: any) {
      logger.error('Error creating product:', error);
      
      if (error.code === 11000) {
        sendError(res, 'SKU or barcode already exists', 400);
        return;
      }
      
      sendError(res, 'Failed to create product', 500);
    }
  }

  /**
   * Update a product.
   * Optional optimistic concurrency: send syncVersion in body; if it does not match server, returns 409.
   */
  static async updateProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const storeId = req.user?.storeId;
      const updateData = { ...req.body };

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      // Check if product exists and belongs to store
      const existingProduct = await Product.findOne({ _id: id, storeId });
      if (!existingProduct) {
        sendError(res, 'Product not found', 404);
        return;
      }

      // Optional syncVersion: conflict detection for offline sync
      const clientSyncVersion = updateData.syncVersion != null ? Number(updateData.syncVersion) : undefined;
      if (clientSyncVersion !== undefined && existingProduct.syncVersion !== clientSyncVersion) {
        res.status(409).json({
          success: false,
          message: 'Product was updated elsewhere; refresh and retry',
          code: 'SYNC_CONFLICT',
        });
        return;
      }
      delete updateData.syncVersion; // do not write client value; we increment server-side

      // Check for SKU conflicts (if SKU is being updated)
      if (updateData.sku && updateData.sku !== existingProduct.sku) {
        const skuConflict = await Product.findOne({ 
          storeId, 
          sku: updateData.sku,
          _id: { $ne: id }
        });
        
        if (skuConflict) {
          sendError(res, 'SKU already exists in this store', 400);
          return;
        }
      }

      // Check for barcode conflicts (if barcode is being updated)
      if (updateData.barcode && updateData.barcode !== existingProduct.barcode) {
        const barcodeConflict = await Product.findOne({ 
          storeId, 
          barcode: updateData.barcode,
          _id: { $ne: id }
        });
        
        if (barcodeConflict) {
          sendError(res, 'Barcode already exists in this store', 400);
          return;
        }
      }

      // Verify category exists (if category is being updated)
      if (updateData.categoryId && updateData.categoryId !== existingProduct.categoryId.toString()) {
        const category = await Category.findOne({ 
          _id: updateData.categoryId, 
          storeId, 
          isActive: true 
        });
        
        if (!category) {
          sendError(res, 'Category not found', 400);
          return;
        }
      }

      // findByIdAndUpdate does not run pre('save'), so increment syncVersion explicitly
      const updatedProduct = await Product.findByIdAndUpdate(
        id,
        { ...updateData, storeId, $inc: { syncVersion: 1 } },
        { new: true, runValidators: true }
      ).populate('categoryId', 'name');

      sendSuccess(res, updatedProduct, 'Product updated successfully');
    } catch (error: any) {
      logger.error('Error updating product:', error);
      
      if (error.code === 11000) {
        sendError(res, 'SKU or barcode already exists', 400);
        return;
      }
      
      sendError(res, 'Failed to update product', 500);
    }
  }

  /**
   * Delete a product (soft delete)
   */
  static async deleteProduct(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const storeId = req.user?.storeId;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      const product = await Product.findOneAndUpdate(
        { _id: id, storeId },
        { isActive: false },
        { new: true }
      );

      if (!product) {
        sendError(res, 'Product not found', 404);
        return;
      }

      sendSuccess(res, null, 'Product deleted successfully');
    } catch (error) {
      logger.error('Error deleting product:', error);
      sendError(res, 'Failed to delete product', 500);
    }
  }

  /**
   * Get low stock products
   */
  static async getLowStockProducts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const storeId = req.user?.storeId;
      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      const products = await Product.find({
        storeId,
        isActive: true,
        $expr: { $lte: ['$stockQuantity', '$lowStockThreshold'] }
      }).populate('categoryId', 'name');

      sendSuccess(res, products);
    } catch (error) {
      logger.error('Error fetching low stock products:', error);
      sendError(res, 'Failed to fetch low stock products', 500);
    }
  }

  /**
   * Search products by barcode
   */
  static async searchByBarcode(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { barcode } = req.query;
      const storeId = req.user?.storeId;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      if (!barcode) {
        sendError(res, 'Barcode is required', 400);
        return;
      }

      const product = await Product.findOne({
        storeId,
        barcode,
        isActive: true
      }).populate('categoryId', 'name');

      if (!product) {
        sendError(res, 'Product not found', 404);
        return;
      }

      sendSuccess(res, product);
    } catch (error) {
      logger.error('Error searching product by barcode:', error);
      sendError(res, 'Failed to search product', 500);
    }
  }

  /**
   * Update product stock
   */
  static async updateStock(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { stockQuantity, reason } = req.body;
      const storeId = req.user?.storeId;
      const performedBy = req.user?.userId ?? 'system';

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      if (stockQuantity < 0) {
        sendError(res, 'Stock quantity cannot be negative', 400);
        return;
      }

      const existing = await Product.findOne({ _id: id, storeId, isActive: true });
      if (!existing) {
        sendError(res, 'Product not found', 404);
        return;
      }

      const previousQuantity = existing.stockQuantity;
      const delta = stockQuantity - previousQuantity;

      const product = await Product.findOneAndUpdate(
        { _id: id, storeId, isActive: true },
        { stockQuantity },
        { new: true }
      ).populate('categoryId', 'name');

      if (!product) {
        sendError(res, 'Product not found', 404);
        return;
      }

      const reasonValue = ['sale', 'restock', 'adjustment', 'return', 'cancellation'].includes(reason) ? reason : 'adjustment';
      await InventoryAdjustment.create({
        storeId,
        productId: id,
        previousQuantity,
        newQuantity: stockQuantity,
        delta,
        reason: reasonValue,
        performedBy,
      });

      logger.info(`Stock updated for product ${product.name}: ${stockQuantity} (${reason || 'Manual adjustment'})`);

      sendSuccess(res, product, 'Stock updated successfully');
    } catch (error) {
      logger.error('Error updating stock:', error);
      sendError(res, 'Failed to update stock', 500);
    }
  }
}
