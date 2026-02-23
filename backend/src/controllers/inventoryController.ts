import { Response } from 'express';
import InventoryAdjustment from '@/models/InventoryAdjustment';
import { sendSuccess, sendError } from '@/utils/response';
import logger from '@/utils/logger';
import { TokenPayload } from '@/services/authService';

interface AuthenticatedRequestLike {
  user?: TokenPayload;
  query: Record<string, any>;
}

export class InventoryController {
  /**
   * GET /api/inventory/adjustments - List inventory adjustments with optional filters.
   * Query: productId, dateFrom (ISO), dateTo (ISO), page, limit.
   */
  static async getAdjustments(req: AuthenticatedRequestLike, res: Response): Promise<void> {
    try {
      const storeId = req.user?.storeId;
      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      const { productId, dateFrom, dateTo, page = 1, limit = 50 } = req.query;
      const query: any = { storeId };

      if (productId) query.productId = productId;
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom as string);
        if (dateTo) query.createdAt.$lte = new Date(dateTo as string);
      }

      const skip = (Number(page) - 1) * Number(limit);
      const [adjustments, total] = await Promise.all([
        InventoryAdjustment.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
        InventoryAdjustment.countDocuments(query),
      ]);

      sendSuccess(res, {
        adjustments,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error: any) {
      logger.error('Error fetching inventory adjustments:', error);
      sendError(res, 'Failed to fetch adjustments', 500);
    }
  }
}
