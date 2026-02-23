import { Router } from 'express';
import { authenticate, authorize } from '@/middleware/auth';
import { InventoryController } from '@/controllers/inventoryController';

const router = Router();

router.use(authenticate);

/**
 * @route   GET /api/inventory/adjustments
 * @desc    List inventory adjustments (audit log). Query: productId, dateFrom, dateTo, page, limit.
 * @access  Private
 */
router.get('/adjustments', authorize(['products', 'inventory']), InventoryController.getAdjustments as any);

export default router;
