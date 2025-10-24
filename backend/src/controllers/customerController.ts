import { Request, Response } from 'express';
import Customer from '@/models/Customer';
import { sendSuccess, sendError } from '@/utils/response';
import logger from '@/utils/logger';
import { TokenPayload } from '@/services/authService';

interface AuthenticatedRequest extends Omit<Request, 'user'> {
  user: TokenPayload;
}

export class CustomerController {
  /**
   * Get all customers with search and pagination
   */
  static async getCustomers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { search, page = 1, limit = 50, sortBy = 'name', sortOrder = 'asc' } = req.query;
      const storeId = req.user?.storeId;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      // Build query
      const query: any = { storeId, isActive: true };

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phoneNumber: { $regex: search, $options: 'i' } }
        ];
      }

      // Build sort object
      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      // Calculate pagination
      const skip = (Number(page) - 1) * Number(limit);

      // Execute query
      const [customers, total] = await Promise.all([
        Customer.find(query)
          .sort(sort)
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        Customer.countDocuments(query)
      ]);

      sendSuccess(res, {
        customers,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      logger.error('Error fetching customers:', error);
      sendError(res, 'Failed to fetch customers', 500);
    }
  }

  /**
   * Get a single customer by ID
   */
  static async getCustomer(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const storeId = req.user?.storeId;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      const customer = await Customer.findOne({ _id: id, storeId, isActive: true });

      if (!customer) {
        sendError(res, 'Customer not found', 404);
        return;
      }

      sendSuccess(res, customer);
    } catch (error) {
      logger.error('Error fetching customer:', error);
      sendError(res, 'Failed to fetch customer', 500);
    }
  }

  /**
   * Create a new customer
   */
  static async createCustomer(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const storeId = req.user?.storeId;
      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      const customerData = {
        ...req.body,
        storeId
      };

      const customer = new Customer(customerData);
      await customer.save();

      sendSuccess(res, customer, 'Customer created successfully', 201);
    } catch (error: any) {
      logger.error('Error creating customer:', error);
      
      if (error.code === 11000) {
        sendError(res, 'Email or phone number already exists', 400);
        return;
      }
      
      sendError(res, 'Failed to create customer', 500);
    }
  }

  /**
   * Update a customer
   */
  static async updateCustomer(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const storeId = req.user?.storeId;
      const updateData = req.body;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      const customer = await Customer.findOneAndUpdate(
        { _id: id, storeId, isActive: true },
        { ...updateData, storeId },
        { new: true, runValidators: true }
      );

      if (!customer) {
        sendError(res, 'Customer not found', 404);
        return;
      }

      sendSuccess(res, customer, 'Customer updated successfully');
    } catch (error: any) {
      logger.error('Error updating customer:', error);
      
      if (error.code === 11000) {
        sendError(res, 'Email or phone number already exists', 400);
        return;
      }
      
      sendError(res, 'Failed to update customer', 500);
    }
  }

  /**
   * Delete a customer (soft delete)
   */
  static async deleteCustomer(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const storeId = req.user?.storeId;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      const customer = await Customer.findOneAndUpdate(
        { _id: id, storeId },
        { isActive: false },
        { new: true }
      );

      if (!customer) {
        sendError(res, 'Customer not found', 404);
        return;
      }

      sendSuccess(res, null, 'Customer deleted successfully');
    } catch (error) {
      logger.error('Error deleting customer:', error);
      sendError(res, 'Failed to delete customer', 500);
    }
  }

  /**
   * Search customers
   */
  static async searchCustomers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { query } = req.query;
      const storeId = req.user?.storeId;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      if (!query) {
        sendError(res, 'Search query is required', 400);
        return;
      }

      const customers = await (Customer as any)['searchCustomers'](storeId, query as string);

      sendSuccess(res, customers);
    } catch (error) {
      logger.error('Error searching customers:', error);
      sendError(res, 'Failed to search customers', 500);
    }
  }

  /**
   * Get customer statistics
   */
  static async getCustomerStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const storeId = req.user?.storeId;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      const [stats, tierBreakdown] = await Promise.all([
        (Customer as any)['getCustomerStats'](storeId),
        (Customer as any)['getTierBreakdown'](storeId)
      ]);

      sendSuccess(res, {
        stats: stats[0] || {
          totalCustomers: 0,
          totalSpent: 0,
          averageSpent: 0,
          totalOrders: 0,
          averageOrders: 0,
          totalLoyaltyPoints: 0
        },
        tierBreakdown
      });
    } catch (error) {
      logger.error('Error fetching customer stats:', error);
      sendError(res, 'Failed to fetch customer statistics', 500);
    }
  }

  /**
   * Update customer loyalty points
   */
  static async updateLoyaltyPoints(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { points, operation = 'add' } = req.body;
      const storeId = req.user?.storeId;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      if (!points || isNaN(Number(points))) {
        sendError(res, 'Valid points value is required', 400);
        return;
      }

      const pointsValue = Number(points);
      const updateOperation = operation === 'subtract' ? -pointsValue : pointsValue;

      const customer = await Customer.findOneAndUpdate(
        { _id: id, storeId, isActive: true },
        { $inc: { loyaltyPoints: updateOperation } },
        { new: true }
      );

      if (!customer) {
        sendError(res, 'Customer not found', 404);
        return;
      }

      sendSuccess(res, customer, 'Loyalty points updated successfully');
    } catch (error) {
      logger.error('Error updating loyalty points:', error);
      sendError(res, 'Failed to update loyalty points', 500);
    }
  }
}
