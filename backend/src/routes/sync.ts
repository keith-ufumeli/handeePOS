import { Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { SyncController } from '@/controllers/syncController';

const router = Router();

router.use(authenticate);

/**
 * @route   GET /api/sync/status
 * @desc    Return server timestamp and status (for client to check before full pull).
 * @access  Private
 */
router.get('/status', SyncController.getStatus as any);

/**
 * @route   POST /api/sync/pull
 * @desc    Single round-trip pull; optional body/query: updatedAfter/lastSync, entityTypes.
 * @access  Private
 */
router.post('/pull', SyncController.pull as any);

/**
 * @route   POST /api/sync/push
 * @desc    Batch push operations: { operations: [{ collection, operation, id, data }] }.
 * @access  Private
 */
router.post('/push', SyncController.push as any);

export default router;
