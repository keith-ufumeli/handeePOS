import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Order from '@/models/Order';
import Product from '@/models/Product';
import Customer from '@/models/Customer';
import { sendSuccess, sendError } from '@/utils/response';
import logger from '@/utils/logger';
import { TokenPayload } from '@/services/authService';

// ─── CSV helpers ─────────────────────────────────────────────────────────────

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const headerLine = headers.map(escapeCsvValue).join(',');
  const dataLines = rows.map(row =>
    headers.map(h => escapeCsvValue(row[h])).join(',')
  );
  return [headerLine, ...dataLines].join('\n');
}

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

      // Validate and normalize storeId format
      let storeIdObjectId: mongoose.Types.ObjectId;
      try {
        // Check if storeId is already a valid ObjectId string
        if (typeof storeId === 'string' && /^[0-9a-fA-F]{24}$/.test(storeId)) {
          storeIdObjectId = new mongoose.Types.ObjectId(storeId);
        } else {
          logger.error('[REPORT_CONTROLLER] Invalid storeId format', {
            storeId,
            storeIdType: typeof storeId,
            userId: req.user?.userId
          });
          sendError(res, 'Invalid store ID format', 400);
          return;
        }
      } catch (error) {
        logger.error('[REPORT_CONTROLLER] Error converting storeId to ObjectId', {
          error: error instanceof Error ? error.message : String(error),
          storeId,
          storeIdType: typeof storeId,
          userId: req.user?.userId
        });
        sendError(res, 'Invalid store ID format', 400);
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
            storeId: storeIdObjectId,
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
            storeId: storeIdObjectId,
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
            storeId: storeIdObjectId,
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
   * Export a report as CSV or JSON.
   * Query params:
   *   type    – 'sales' | 'products' | 'inventory' | 'customers' | 'daily-summary'
   *   format  – 'csv' (default) | 'json'
   *   startDate, endDate – ISO date strings (optional; defaults to last 30 days)
   *   groupBy – 'hour' | 'day' | 'week' | 'month'  (sales report only)
   *   sortBy  – 'sales' | 'revenue'                 (products report only)
   *   limit   – number                              (products report only)
   */
  static async exportReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        type = 'sales',
        format = 'csv',
        groupBy = 'day',
        sortBy = 'sales',
        limit = '100',
      } = req.query as Record<string, string>;

      const storeId = req.user?.storeId;
      if (!storeId || !/^[0-9a-fA-F]{24}$/.test(storeId)) {
        sendError(res, 'Invalid store ID', 400);
        return;
      }

      const storeOid = new mongoose.Types.ObjectId(storeId);

      // Date range: default last 30 days
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : new Date();
      endDate.setHours(23, 59, 59, 999);

      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : (() => { const d = new Date(endDate); d.setDate(d.getDate() - 30); return d; })();

      let csvContent = '';
      let rows: Record<string, unknown>[] = [];
      let headers: string[] = [];
      let filename = `handeepos-${type}-${new Date().toISOString().split('T')[0]}`;

      // ── Sales report ────────────────────────────────────────────────────────
      if (type === 'sales') {
        filename += `-${groupBy}`;
        let groupFormat: Record<string, unknown>;
        switch (groupBy) {
          case 'hour':
            groupFormat = { year: { $year: '$completedAt' }, month: { $month: '$completedAt' }, day: { $dayOfMonth: '$completedAt' }, hour: { $hour: '$completedAt' } };
            break;
          case 'week':
            groupFormat = { year: { $year: '$completedAt' }, week: { $week: '$completedAt' } };
            break;
          case 'month':
            groupFormat = { year: { $year: '$completedAt' }, month: { $month: '$completedAt' } };
            break;
          default:
            groupFormat = { year: { $year: '$completedAt' }, month: { $month: '$completedAt' }, day: { $dayOfMonth: '$completedAt' } };
        }

        const data = await Order.aggregate([
          { $match: { storeId: storeOid, status: 'completed', completedAt: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: groupFormat,
              totalSales: { $sum: '$total' },
              totalOrders: { $sum: 1 },
              totalItems: { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', '$$this.quantity'] } } } },
              averageOrderValue: { $avg: '$total' },
            },
          },
          { $sort: { _id: 1 } },
        ]);

        headers = ['Period', 'Total Sales', 'Total Orders', 'Items Sold', 'Avg Order Value'];
        rows = data.map(d => ({
          Period: [d._id.year, d._id.month, d._id.day, d._id.hour !== undefined ? `H${d._id.hour}` : undefined].filter(Boolean).join('-'),
          'Total Sales': d.totalSales.toFixed(2),
          'Total Orders': d.totalOrders,
          'Items Sold': d.totalItems,
          'Avg Order Value': d.averageOrderValue.toFixed(2),
        }));

      // ── Products report ─────────────────────────────────────────────────────
      } else if (type === 'products') {
        const data = await Order.aggregate([
          { $match: { storeId: storeOid, status: 'completed', completedAt: { $gte: startDate, $lte: endDate } } },
          { $unwind: '$items' },
          {
            $group: {
              _id: { productId: '$items.productId', productName: '$items.productName', sku: '$items.sku' },
              totalQuantitySold: { $sum: '$items.quantity' },
              totalRevenue: { $sum: '$items.subtotal' },
              averagePrice: { $avg: '$items.unitPrice' },
            },
          },
          { $sort: sortBy === 'revenue' ? { totalRevenue: -1 } : { totalQuantitySold: -1 } },
          { $limit: Number(limit) },
        ]);

        headers = ['Product Name', 'SKU', 'Qty Sold', 'Total Revenue', 'Avg Price'];
        rows = data.map(d => ({
          'Product Name': d._id.productName,
          SKU: d._id.sku,
          'Qty Sold': d.totalQuantitySold,
          'Total Revenue': d.totalRevenue.toFixed(2),
          'Avg Price': d.averagePrice.toFixed(2),
        }));

      // ── Inventory report ────────────────────────────────────────────────────
      } else if (type === 'inventory') {
        const data = await Product.find(
          { storeId: storeOid, isActive: true },
          { name: 1, sku: 1, price: 1, cost: 1, stockQuantity: 1, lowStockThreshold: 1, unit: 1 }
        ).lean();

        headers = ['Name', 'SKU', 'Stock', 'Unit', 'Retail Price', 'Cost', 'Retail Value', 'Cost Value', 'Status'];
        rows = (data as any[]).map(p => {
          const retailValue = (p.price || 0) * (p.stockQuantity || 0);
          const costValue = (p.cost || 0) * (p.stockQuantity || 0);
          const status = p.stockQuantity <= 0 ? 'Out of Stock' : p.stockQuantity <= p.lowStockThreshold ? 'Low Stock' : 'In Stock';
          return {
            Name: p.name,
            SKU: p.sku,
            Stock: p.stockQuantity,
            Unit: p.unit || 'pcs',
            'Retail Price': (p.price || 0).toFixed(2),
            Cost: (p.cost || 0).toFixed(2),
            'Retail Value': retailValue.toFixed(2),
            'Cost Value': costValue.toFixed(2),
            Status: status,
          };
        });

      // ── Customers report ────────────────────────────────────────────────────
      } else if (type === 'customers') {
        const data = await Customer.find(
          { storeId: storeOid, isActive: true },
          { name: 1, email: 1, phoneNumber: 1, totalSpent: 1, totalOrders: 1, loyaltyPoints: 1, tier: 1, lastVisit: 1, createdAt: 1 }
        ).sort({ totalSpent: -1 }).lean();

        headers = ['Name', 'Email', 'Phone', 'Tier', 'Total Spent', 'Total Orders', 'Loyalty Points', 'Last Visit', 'Member Since'];
        rows = (data as any[]).map(c => ({
          Name: c.name,
          Email: c.email || '',
          Phone: c.phoneNumber || '',
          Tier: c.tier || 'bronze',
          'Total Spent': (c.totalSpent || 0).toFixed(2),
          'Total Orders': c.totalOrders || 0,
          'Loyalty Points': c.loyaltyPoints || 0,
          'Last Visit': c.lastVisit ? new Date(c.lastVisit).toISOString().split('T')[0] : '',
          'Member Since': c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : '',
        }));

      // ── Daily summary ───────────────────────────────────────────────────────
      } else if (type === 'daily-summary') {
        const data = await Order.aggregate([
          { $match: { storeId: storeOid, status: 'completed', completedAt: { $gte: startDate, $lte: endDate } } },
          {
            $group: {
              _id: { year: { $year: '$completedAt' }, month: { $month: '$completedAt' }, day: { $dayOfMonth: '$completedAt' } },
              totalSales: { $sum: '$total' },
              totalOrders: { $sum: 1 },
              totalItems: { $sum: { $reduce: { input: '$items', initialValue: 0, in: { $add: ['$$value', '$$this.quantity'] } } } },
              averageOrderValue: { $avg: '$total' },
            },
          },
          { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
        ]);

        headers = ['Date', 'Total Sales', 'Total Orders', 'Items Sold', 'Avg Order Value'];
        rows = data.map(d => ({
          Date: `${d._id.year}-${String(d._id.month).padStart(2, '0')}-${String(d._id.day).padStart(2, '0')}`,
          'Total Sales': d.totalSales.toFixed(2),
          'Total Orders': d.totalOrders,
          'Items Sold': d.totalItems,
          'Avg Order Value': d.averageOrderValue.toFixed(2),
        }));

      } else {
        sendError(res, `Unknown report type: ${type}`, 400);
        return;
      }

      // ── Format & respond ────────────────────────────────────────────────────
      if (format === 'csv') {
        csvContent = buildCsv(headers, rows);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        res.status(200).send(csvContent);
      } else {
        sendSuccess(res, { filename, headers, rows, rowCount: rows.length });
      }
    } catch (error) {
      logger.error('Error exporting report:', error);
      sendError(res, 'Failed to export report', 500);
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
