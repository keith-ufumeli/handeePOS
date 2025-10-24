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
      const storeId = req.user?.storeId;
      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      const categories = await Category.find({ storeId, isActive: true })
        .sort({ name: 1 });

      sendSuccess(res, categories);
    } catch (error) {
      logger.error('Error fetching categories:', error);
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
