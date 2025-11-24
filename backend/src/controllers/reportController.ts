import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Customer from '@/models/Customer';
import { sendSuccess, sendError } from '@/utils/response';
import logger from '@/utils/logger';
import { TokenPayload } from '@/services/authService';

interface AuthenticatedRequest extends Omit<Request, 'user'> {
  user: TokenPayload;
}

export class ReportController {
  /**
   * Get daily sales summary
   */
  static async getDailySalesSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { date } = req.query;
      const storeId = req.user?.storeId;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      const targetDate = date ? new Date(date as string) : new Date();
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Get sales summary
      const salesSummary = await Order.aggregate([
        {
          $match: {
            storeId: new mongoose.Types.ObjectId(storeId),
            status: 'completed',
            completedAt: {
              $gte: startOfDay,
              $lte: endOfDay
            }
          }
        },
        {
          $addFields: {
            totalItemsCount: {
              $sum: '$items.quantity'
            },
            cashPayment: {
              $sum: {
                $map: {
                  input: {
                    $filter: {
                      input: '$payments',
                      as: 'payment',
                      cond: { $eq: ['$$payment.method', 'cash'] }
                    }
                  },
                  as: 'cash',
                  in: '$$cash.amount'
                }
              }
            },
            cardPayment: {
              $sum: {
                $map: {
                  input: {
                    $filter: {
                      input: '$payments',
                      as: 'payment',
                      cond: { $eq: ['$$payment.method', 'card'] }
                    }
                  },
                  as: 'card',
                  in: '$$card.amount'
                }
              }
            },
            mobileMoneyPayment: {
              $sum: {
                $map: {
                  input: {
                    $filter: {
                      input: '$payments',
                      as: 'payment',
                      cond: { $eq: ['$$payment.method', 'mobile_money'] }
                    }
                  },
                  as: 'mobile',
                  in: '$$mobile.amount'
                }
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: '$total' },
            totalOrders: { $sum: 1 },
            totalItems: { $sum: '$totalItemsCount' },
            averageOrderValue: { $avg: '$total' },
            cashSales: { $sum: '$cashPayment' },
            cardSales: { $sum: '$cardPayment' },
            mobileMoneySales: { $sum: '$mobileMoneyPayment' }
          }
        }
      ]);

      // Get hourly breakdown
      const hourlyBreakdown = await Order.aggregate([
        {
          $match: {
            storeId: new mongoose.Types.ObjectId(storeId),
            status: 'completed',
            completedAt: {
              $gte: startOfDay,
              $lte: endOfDay
            }
          }
        },
        {
          $group: {
            _id: { $hour: '$completedAt' },
            sales: { $sum: '$total' },
            orders: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);

      // Get top selling products
      const topProducts = await Order.aggregate([
        {
          $match: {
            storeId: new mongoose.Types.ObjectId(storeId),
            status: 'completed',
            completedAt: {
              $gte: startOfDay,
              $lte: endOfDay
            }
          }
        },
        {
          $unwind: '$items'
        },
        {
          $group: {
            _id: {
              productId: '$items.productId',
              productName: '$items.productName',
              sku: '$items.sku'
            },
            totalQuantity: { $sum: '$items.quantity' },
            totalRevenue: { $sum: '$items.subtotal' }
          }
        },
        {
          $sort: { totalQuantity: -1 }
        },
        {
          $limit: 10
        }
      ]);

      const result = {
        date: targetDate.toISOString().split('T')[0],
        summary: salesSummary[0] || {
          totalSales: 0,
          totalOrders: 0,
          totalItems: 0,
          averageOrderValue: 0,
          cashSales: 0,
          cardSales: 0,
          mobileMoneySales: 0
        },
        hourlyBreakdown,
        topProducts
      };

      sendSuccess(res, result);
    } catch (error) {
      logger.error('Error fetching daily sales summary:', error);
      sendError(res, 'Failed to fetch daily sales summary', 500);
    }
  }

  /**
   * Get sales report for date range
   */
  static async getSalesReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { startDate, endDate, groupBy = 'day' } = req.query;
      const storeId = req.user?.storeId;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      if (!startDate || !endDate) {
        sendError(res, 'Start date and end date are required', 400);
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);

      let groupFormat: any;
      switch (groupBy) {
        case 'hour':
          groupFormat = {
            year: { $year: '$completedAt' },
            month: { $month: '$completedAt' },
            day: { $dayOfMonth: '$completedAt' },
            hour: { $hour: '$completedAt' }
          };
          break;
        case 'day':
          groupFormat = {
            year: { $year: '$completedAt' },
            month: { $month: '$completedAt' },
            day: { $dayOfMonth: '$completedAt' }
          };
          break;
        case 'week':
          groupFormat = {
            year: { $year: '$completedAt' },
            week: { $week: '$completedAt' }
          };
          break;
        case 'month':
          groupFormat = {
            year: { $year: '$completedAt' },
            month: { $month: '$completedAt' }
          };
          break;
        default:
          groupFormat = {
            year: { $year: '$completedAt' },
            month: { $month: '$completedAt' },
            day: { $dayOfMonth: '$completedAt' }
          };
      }

      const salesReport = await Order.aggregate([
        {
          $match: {
            storeId: new mongoose.Types.ObjectId(storeId),
            status: 'completed',
            completedAt: {
              $gte: start,
              $lte: end
            }
          }
        },
        {
          $group: {
            _id: groupFormat,
            totalSales: { $sum: '$total' },
            totalOrders: { $sum: 1 },
            totalItems: { 
              $sum: {
                $reduce: {
                  input: '$items',
                  initialValue: 0,
                  in: { $add: ['$$value', '$$this.quantity'] }
                }
              }
            },
            averageOrderValue: { $avg: '$total' },
            cashSales: {
              $sum: {
                $cond: [
                  { $eq: [{ $arrayElemAt: ['$payments.method', 0] }, 'cash'] },
                  '$total',
                  0
                ]
              }
            },
            cardSales: {
              $sum: {
                $cond: [
                  { $eq: [{ $arrayElemAt: ['$payments.method', 0] }, 'card'] },
                  '$total',
                  0
                ]
              }
            },
            mobileMoneySales: {
              $sum: {
                $cond: [
                  { $eq: [{ $arrayElemAt: ['$payments.method', 0] }, 'mobile_money'] },
                  '$total',
                  0
                ]
              }
            }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);

      sendSuccess(res, {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
        groupBy,
        data: salesReport
      });
    } catch (error) {
      logger.error('Error fetching sales report:', error);
      sendError(res, 'Failed to fetch sales report', 500);
    }
  }

  /**
   * Get product performance report
   */
  static async getProductPerformance(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { startDate, endDate, sortBy = 'sales', limit = 50 } = req.query;
      const storeId = req.user?.storeId;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      const start = startDate ? new Date(startDate as string) : new Date();
      start.setDate(start.getDate() - 30); // Default to last 30 days
      
      const end = endDate ? new Date(endDate as string) : new Date();
      end.setHours(23, 59, 59, 999);

      const productPerformance = await Order.aggregate([
        {
          $match: {
            storeId: new mongoose.Types.ObjectId(storeId),
            status: 'completed',
            completedAt: {
              $gte: start,
              $lte: end
            }
          }
        },
        {
          $unwind: '$items'
        },
        {
          $group: {
            _id: {
              productId: '$items.productId',
              productName: '$items.productName',
              sku: '$items.sku'
            },
            totalQuantitySold: { $sum: '$items.quantity' },
            totalRevenue: { $sum: '$items.subtotal' },
            totalOrders: { $addToSet: '$_id' },
            averagePrice: { $avg: '$items.unitPrice' },
            totalDiscount: { $sum: '$items.discount' },
            totalTax: { $sum: '$items.tax' }
          }
        },
        {
          $addFields: {
            orderCount: { $size: '$totalOrders' }
          }
        },
        {
          $project: {
            _id: 1,
            totalQuantitySold: 1,
            totalRevenue: 1,
            orderCount: 1,
            averagePrice: 1,
            totalDiscount: 1,
            totalTax: 1
          }
        },
        {
          $sort: sortBy === 'revenue' ? { totalRevenue: -1 } : { totalQuantitySold: -1 }
        },
        {
          $limit: Number(limit)
        }
      ]);

      sendSuccess(res, {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
        sortBy,
        products: productPerformance
      });
    } catch (error) {
      logger.error('Error fetching product performance:', error);
      sendError(res, 'Failed to fetch product performance', 500);
    }
  }

  /**
   * Get inventory valuation report
   */
  static async getInventoryValuation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const storeId = req.user?.storeId;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      const inventoryValuation = await Product.aggregate([
        {
          $match: {
            storeId: new mongoose.Types.ObjectId(storeId),
            isActive: true
          }
        },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            totalCostValue: { $sum: { $multiply: ['$cost', '$stockQuantity'] } },
            totalRetailValue: { $sum: { $multiply: ['$price', '$stockQuantity'] } },
            lowStockProducts: {
              $sum: {
                $cond: [
                  { $lte: ['$stockQuantity', '$lowStockThreshold'] },
                  1,
                  0
                ]
              }
            },
            outOfStockProducts: {
              $sum: {
                $cond: [
                  { $lte: ['$stockQuantity', 0] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]);

      const result = inventoryValuation[0] || {
        totalProducts: 0,
        totalCostValue: 0,
        totalRetailValue: 0,
        lowStockProducts: 0,
        outOfStockProducts: 0
      };

      result.profitMargin = result.totalRetailValue - result.totalCostValue;
      result.profitMarginPercentage = result.totalRetailValue > 0 
        ? ((result.profitMargin / result.totalRetailValue) * 100).toFixed(2)
        : 0;

      sendSuccess(res, result);
    } catch (error) {
      logger.error('Error fetching inventory valuation:', error);
      sendError(res, 'Failed to fetch inventory valuation', 500);
    }
  }

  /**
   * Get customer analytics
   */
  static async getCustomerAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      const storeId = req.user?.storeId;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      const start = startDate ? new Date(startDate as string) : new Date();
      start.setDate(start.getDate() - 30); // Default to last 30 days
      
      const end = endDate ? new Date(endDate as string) : new Date();
      end.setHours(23, 59, 59, 999);

      const [customerStats, topCustomers, newCustomers] = await Promise.all([
        // Customer statistics
        Customer.aggregate([
          {
            $match: {
              storeId: new mongoose.Types.ObjectId(storeId),
              isActive: true
            }
          },
          {
            $group: {
              _id: null,
              totalCustomers: { $sum: 1 },
              totalLoyaltyPoints: { $sum: '$loyaltyPoints' },
              averageSpent: { $avg: '$totalSpent' },
              averageOrders: { $avg: '$totalOrders' }
            }
          }
        ]),
        // Top customers by spending
        Customer.aggregate([
          {
            $match: {
              storeId: new mongoose.Types.ObjectId(storeId),
              isActive: true,
              totalSpent: { $gt: 0 }
            }
          },
          {
            $sort: { totalSpent: -1 }
          },
          {
            $limit: 10
          },
          {
            $project: {
              name: 1,
              email: 1,
              phoneNumber: 1,
              totalSpent: 1,
              totalOrders: 1,
              loyaltyPoints: 1,
              tier: 1
            }
          }
        ]),
        // New customers in date range
        Customer.aggregate([
          {
            $match: {
              storeId: new mongoose.Types.ObjectId(storeId),
              isActive: true,
              createdAt: {
                $gte: start,
                $lte: end
              }
            }
          },
          {
            $count: 'newCustomers'
          }
        ])
      ]);

      sendSuccess(res, {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
        stats: customerStats[0] || {
          totalCustomers: 0,
          totalLoyaltyPoints: 0,
          averageSpent: 0,
          averageOrders: 0
        },
        topCustomers,
        newCustomers: newCustomers[0]?.newCustomers || 0
      });
    } catch (error) {
      logger.error('Error fetching customer analytics:', error);
      sendError(res, 'Failed to fetch customer analytics', 500);
    }
  }
}
