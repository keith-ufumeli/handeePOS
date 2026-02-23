import { Request, Response } from 'express';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Customer from '@/models/Customer';
import InventoryAdjustment from '@/models/InventoryAdjustment';
import { sendSuccess, sendError } from '@/utils/response';
import logger from '@/utils/logger';
import { TokenPayload } from '@/services/authService';
import mongoose from 'mongoose';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const idempotencyCache = new Map<string, { body: any; expiry: number }>();

function getIdempotencyKey(req: Request | AuthenticatedRequest): string | undefined {
  const key = req.get('X-Idempotency-Key') ?? (req.headers['x-idempotency-key'] as string);
  return key && String(key).trim() ? String(key).trim() : undefined;
}

interface AuthenticatedRequest extends Omit<Request, 'user'> {
  user: TokenPayload;
}

export class OrderController {
  /**
   * Create a new order
   */
  static async createOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
    const idempotencyKey = getIdempotencyKey(req);
    if (idempotencyKey) {
      const cached = idempotencyCache.get(idempotencyKey);
      if (cached && cached.expiry > Date.now()) {
        res.status(200).json(cached.body);
        return;
      }
    }

    const session = await mongoose.startSession();

    try {
      const populatedOrder = await session.withTransaction(async () => {
        const storeId = req.user?.storeId;
        const cashierId = req.user?.userId;
        const { items, customerId, customNote, payments } = req.body;

        if (!storeId || !cashierId) {
          throw new Error('Store ID or Cashier ID not found');
        }

        // Validate items
        if (!items || !Array.isArray(items) || items.length === 0) {
          throw new Error('Order must have at least one item');
        }

        const stockAdjustments: { productId: mongoose.Types.ObjectId; previousQuantity: number; newQuantity: number; delta: number }[] = [];

        // Check product availability and update stock
        for (const item of items) {
          const product = await Product.findOne({
            _id: item.productId,
            storeId,
            isActive: true
          }).session(session);

          if (!product) {
            throw new Error(`Product ${item.productName} not found or inactive`);
          }

          if (product.stockQuantity < item.quantity) {
            throw new Error(`Insufficient stock for ${item.productName}. Available: ${product.stockQuantity}`);
          }

          const previousQuantity = product.stockQuantity;
          const newQuantity = previousQuantity - item.quantity;
          stockAdjustments.push({
            productId: new mongoose.Types.ObjectId(String(product._id)),
            previousQuantity,
            newQuantity,
            delta: -item.quantity,
          });

          // Update stock
          await Product.findByIdAndUpdate(
            item.productId,
            { $inc: { stockQuantity: -item.quantity } },
            { session }
          );
        }

        // Create order
        const orderData = {
          storeId,
          cashierId,
          customerId: customerId || null,
          items,
          customNote,
          payments: payments || [{ method: 'cash', amount: 0 }],
          deviceId: req.body.deviceId
        };

        const order = new Order(orderData);
        await order.save({ session });

        // Inventory adjustment log (sale)
        for (const adj of stockAdjustments) {
          await InventoryAdjustment.create(
            [
              {
                storeId,
                productId: adj.productId,
                previousQuantity: adj.previousQuantity,
                newQuantity: adj.newQuantity,
                delta: adj.delta,
                reason: 'sale',
                orderId: order._id,
                performedBy: cashierId,
              },
            ],
            { session }
          );
        }

        // Update customer stats if customer is provided
        if (customerId) {
          await Customer.findByIdAndUpdate(
            customerId,
            {
              $inc: {
                totalSpent: order.total,
                totalOrders: 1
              },
              $set: {
                lastVisit: new Date()
              }
            },
            { session }
          );
        }

        // Populate the order with related data
        const populated = await Order.findById(order._id)
          .populate('cashierId', 'fullName email')
          .populate('customerId', 'name email phoneNumber')
          .session(session)
          .lean();

        return populated;
      });

      const responseBody = {
        success: true,
        data: populatedOrder,
        message: 'Order created successfully'
      };

      if (idempotencyKey) {
        idempotencyCache.set(idempotencyKey, {
          body: responseBody,
          expiry: Date.now() + IDEMPOTENCY_TTL_MS
        });
      }

      res.status(201).json(responseBody);
    } catch (error: any) {
      logger.error('Error creating order:', error);
      sendError(res, error.message || 'Failed to create order', 500);
    } finally {
      await session.endSession();
    }
  }

  /**
   * Get orders with filters and pagination
   */
  static async getOrders(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        startDate,
        endDate,
        status,
        page = 1,
        limit = 50,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const storeId = req.user?.storeId;
      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      // Build query
      const query: any = { storeId };

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
          query.createdAt.$gte = new Date(startDate as string);
        }
        if (endDate) {
          query.createdAt.$lte = new Date(endDate as string);
        }
      }

      if (status) {
        query.status = status;
      }

      // Build sort object
      const sort: any = {};
      sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

      // Calculate pagination
      const skip = (Number(page) - 1) * Number(limit);

      // Execute query
      const [orders, total] = await Promise.all([
        Order.find(query)
          .populate('cashierId', 'fullName email')
          .populate('customerId', 'name email phoneNumber')
          .sort(sort)
          .skip(skip)
          .limit(Number(limit))
          .lean(),
        Order.countDocuments(query)
      ]);

      sendSuccess(res, {
        orders,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      });
    } catch (error) {
      logger.error('Error fetching orders:', error);
      sendError(res, 'Failed to fetch orders', 500);
    }
  }

  /**
   * Get a single order by ID
   */
  static async getOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const storeId = req.user?.storeId;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      const order = await Order.findOne({ _id: id, storeId })
        .populate('cashierId', 'fullName email')
        .populate('customerId', 'name email phoneNumber');

      if (!order) {
        sendError(res, 'Order not found', 404);
        return;
      }

      sendSuccess(res, order);
    } catch (error) {
      logger.error('Error fetching order:', error);
      sendError(res, 'Failed to fetch order', 500);
    }
  }

  /**
   * Update order status
   */
  static async updateOrderStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const storeId = req.user?.storeId;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      const validStatuses = ['pending', 'completed', 'cancelled', 'refunded'];
      if (!validStatuses.includes(status)) {
        sendError(res, 'Invalid status', 400);
        return;
      }

      const order = await Order.findOneAndUpdate(
        { _id: id, storeId },
        { status },
        { new: true }
      ).populate('cashierId', 'fullName email')
       .populate('customerId', 'name email phoneNumber');

      if (!order) {
        sendError(res, 'Order not found', 404);
        return;
      }

      sendSuccess(res, order, 'Order status updated successfully');
    } catch (error) {
      logger.error('Error updating order status:', error);
      sendError(res, 'Failed to update order status', 500);
    }
  }

  /**
   * Get order statistics
   */
  static async getOrderStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { date } = req.query;
      const storeId = req.user?.storeId;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      const targetDate = date ? new Date(date as string) : new Date();
      const stats = await (Order as any)['getDailyStats'](storeId, targetDate);

      sendSuccess(res, stats[0] || {
        totalOrders: 0,
        totalRevenue: 0,
        totalTax: 0,
        totalDiscount: 0,
        averageOrderValue: 0
      });
    } catch (error) {
      logger.error('Error fetching order stats:', error);
      sendError(res, 'Failed to fetch order statistics', 500);
    }
  }

  /**
   * Get payment method breakdown
   */
  static async getPaymentBreakdown(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      const storeId = req.user?.storeId;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      const start = startDate ? new Date(startDate as string) : new Date();
      start.setHours(0, 0, 0, 0);
      
      const end = endDate ? new Date(endDate as string) : new Date();
      end.setHours(23, 59, 59, 999);

      const breakdown = await (Order as any)['getPaymentBreakdown'](storeId, start, end);

      sendSuccess(res, breakdown);
    } catch (error) {
      logger.error('Error fetching payment breakdown:', error);
      sendError(res, 'Failed to fetch payment breakdown', 500);
    }
  }

  /**
   * Cancel an order
   */
  static async cancelOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        const { id } = req.params;
        const storeId = req.user?.storeId;

        if (!storeId) {
          throw new Error('Store ID not found');
        }

        const order = await Order.findOne({ _id: id, storeId }).session(session);
        if (!order) {
          throw new Error('Order not found');
        }

        if (order.status === 'completed') {
          throw new Error('Cannot cancel completed order');
        }

        const performedBy = (req as AuthenticatedRequest).user?.userId ?? 'system';

        // Restore stock for each item and log adjustment
        for (const item of order.items) {
          const product = await Product.findById(item.productId).session(session);
          if (product) {
            const previousQuantity = product.stockQuantity;
            const newQuantity = previousQuantity + item.quantity;
            await Product.findByIdAndUpdate(
              item.productId,
              { $inc: { stockQuantity: item.quantity } },
              { session }
            );
            await InventoryAdjustment.create(
              [
                {
                  storeId,
                  productId: item.productId,
                  previousQuantity,
                  newQuantity,
                  delta: item.quantity,
                  reason: 'cancellation',
                  orderId: order._id,
                  performedBy,
                },
              ],
              { session }
            );
          }
        }

        // Update order status
        await Order.findByIdAndUpdate(
          id,
          { status: 'cancelled' },
          { session }
        );

        // Update customer stats if customer exists
        if (order.customerId) {
          await Customer.findByIdAndUpdate(
            order.customerId,
            {
              $inc: {
                totalSpent: -order.total,
                totalOrders: -1
              }
            },
            { session }
          );
        }

        sendSuccess(res, null, 'Order cancelled successfully');
      });
    } catch (error: any) {
      logger.error('Error cancelling order:', error);
      sendError(res, error.message || 'Failed to cancel order', 500);
    } finally {
      await session.endSession();
    }
  }
}
