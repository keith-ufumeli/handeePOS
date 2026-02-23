import { Request, Response } from 'express';
import Category from '@/models/Category';
import { sendSuccess, sendError } from '@/utils/response';
import logger from '@/utils/logger';
import { TokenPayload } from '@/services/authService';

interface AuthenticatedRequest extends Omit<Request, 'user'> {
  user: TokenPayload;
}

export class CategoryController {
  /**
   * Get all categories
   */
  static async getCategories(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      logger.info('[CATEGORY_CONTROLLER] getCategories called', {
        url: req.url,
        path: req.path,
        originalUrl: req.originalUrl,
        params: req.params,
        query: req.query,
        hasStoreId: !!req.user?.storeId,
        storeId: req.user?.storeId
      });

      const storeId = req.user?.storeId;
      if (!storeId) {
        logger.warn('[CATEGORY_CONTROLLER] Store ID not found in JWT');
        sendError(res, 'Store ID not found', 400);
        return;
      }

      // Validate storeId is a valid ObjectId format
      const mongoose = require('mongoose');
      if (!mongoose.Types.ObjectId.isValid(storeId)) {
        logger.error('[CATEGORY_CONTROLLER] Invalid storeId format in JWT:', { 
          storeId, 
          type: typeof storeId,
          storeIdString: String(storeId)
        });
        sendError(res, 'Invalid store ID format', 400);
        return;
      }

      const { updatedAfter } = req.query;
      const query: any = { storeId, isActive: true };
      if (updatedAfter) {
        const after = typeof updatedAfter === 'string' && /^\d+$/.test(updatedAfter)
          ? new Date(Number(updatedAfter))
          : new Date(updatedAfter as string);
        if (!isNaN(after.getTime())) {
          query.updatedAt = { $gte: after };
        }
      }

      logger.info('[CATEGORY_CONTROLLER] Querying categories with storeId:', storeId);
      const categories = await Category.find(query)
        .sort({ name: 1 });

      logger.info('[CATEGORY_CONTROLLER] Found categories:', categories.length);
      if (updatedAfter !== undefined) {
        sendSuccess(res, { categories, serverTimestamp: new Date().toISOString() });
        return;
      }
      sendSuccess(res, categories);
    } catch (error: any) {
      logger.error('[CATEGORY_CONTROLLER] Error fetching categories:', {
        error: error.message,
        errorName: error.name,
        stack: error.stack?.substring(0, 500),
        storeId: req.user?.storeId,
        url: req.url,
        path: req.path
      });
      
      // Handle Mongoose CastError (invalid ObjectId)
      if (error.name === 'CastError') {
        logger.error('[CATEGORY_CONTROLLER] Mongoose CastError - invalid storeId format:', {
          storeId: req.user?.storeId,
          error: error.message
        });
        sendError(res, 'Invalid store ID format', 400);
        return;
      }
      
      sendError(res, 'Failed to fetch categories', 500);
    }
  }

  /**
   * Get a single category by ID
   */
  static async getCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const storeId = req.user?.storeId;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      const category = await Category.findOne({ _id: id, storeId, isActive: true });

      if (!category) {
        sendError(res, 'Category not found', 404);
        return;
      }

      sendSuccess(res, category);
    } catch (error) {
      logger.error('Error fetching category:', error);
      sendError(res, 'Failed to fetch category', 500);
    }
  }

  /**
   * Create a new category
   */
  static async createCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const storeId = req.user?.storeId;
      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      const categoryData = {
        ...req.body,
        storeId
      };

      const category = new Category(categoryData);
      await category.save();

      sendSuccess(res, category, 'Category created successfully', 201);
    } catch (error: any) {
      logger.error('Error creating category:', error);
      
      if (error.code === 11000) {
        sendError(res, 'Category name already exists in this store', 400);
        return;
      }
      
      sendError(res, 'Failed to create category', 500);
    }
  }

  /**
   * Update a category
   */
  static async updateCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const storeId = req.user?.storeId;
      const updateData = req.body;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      const category = await Category.findOneAndUpdate(
        { _id: id, storeId, isActive: true },
        { ...updateData, storeId },
        { new: true, runValidators: true }
      );

      if (!category) {
        sendError(res, 'Category not found', 404);
        return;
      }

      sendSuccess(res, category, 'Category updated successfully');
    } catch (error: any) {
      logger.error('Error updating category:', error);
      
      if (error.code === 11000) {
        sendError(res, 'Category name already exists in this store', 400);
        return;
      }
      
      sendError(res, 'Failed to update category', 500);
    }
  }

  /**
   * Delete a category (soft delete)
   */
  static async deleteCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const storeId = req.user?.storeId;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      // Check if category has products
      const Product = require('@/models/Product').default;
      const productCount = await Product.countDocuments({ 
        categoryId: id, 
        storeId, 
        isActive: true 
      });

      if (productCount > 0) {
        sendError(res, 'Cannot delete category with existing products', 400);
        return;
      }

      const category = await Category.findOneAndUpdate(
        { _id: id, storeId },
        { isActive: false },
        { new: true }
      );

      if (!category) {
        sendError(res, 'Category not found', 404);
        return;
      }

      sendSuccess(res, null, 'Category deleted successfully');
    } catch (error) {
      logger.error('Error deleting category:', error);
      sendError(res, 'Failed to delete category', 500);
    }
  }
}
