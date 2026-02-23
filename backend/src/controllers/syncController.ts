import { Response } from 'express';
import Product from '@/models/Product';
import Category from '@/models/Category';
import { sendSuccess, sendError } from '@/utils/response';
import logger from '@/utils/logger';
import { TokenPayload } from '@/services/authService';
import { ProductController } from '@/controllers/productController';
import { CategoryController } from '@/controllers/categoryController';
import { OrderController } from '@/controllers/orderController';

interface AuthenticatedRequestLike {
  user?: TokenPayload;
  query: Record<string, any>;
  body: any;
  params: Record<string, string>;
  get: (name: string) => string | undefined;
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Build a minimal req and res to delegate to an existing controller.
 * Returns a promise that resolves with { statusCode, body }.
 */
function runController(
  method: (req: AuthenticatedRequestLike, res: Response) => Promise<void>,
  opts: { user: TokenPayload; body?: any; params?: Record<string, string>; query?: Record<string, any>; idempotencyKey?: string }
): Promise<{ statusCode: number; body: any }> {
  return new Promise((resolve, reject) => {
    const captured: { statusCode: number; body: any } = { statusCode: 200, body: null };
    const res = {
      status(code: number) {
        captured.statusCode = code;
        return res;
      },
      json(body: any) {
        captured.body = body;
        resolve(captured);
        return res;
      },
      setHeader: () => res,
    } as unknown as Response;

    const req: AuthenticatedRequestLike = {
      user: opts.user,
      body: opts.body ?? {},
      params: opts.params ?? {},
      query: opts.query ?? {},
      headers: opts.idempotencyKey ? { 'x-idempotency-key': opts.idempotencyKey } : {},
      get(name: string) {
        if (name.toLowerCase() === 'x-idempotency-key') return opts.idempotencyKey;
        return undefined;
      },
    };

    method(req as any, res).catch((err) => {
      logger.error('[SYNC_CONTROLLER] Controller run error', { error: err?.message });
      reject(err);
    });
  });
}

export class SyncController {
  /**
   * GET /api/sync/status - Return server timestamp and message (for client to check before full pull).
   */
  static async getStatus(req: { user?: TokenPayload }, res: Response): Promise<void> {
    sendSuccess(res, {
      serverTimestamp: new Date().toISOString(),
      message: 'OK',
    });
  }

  /**
   * POST /api/sync/pull - Single round-trip pull with optional updatedAfter (incremental).
   * Body or query: lastSync / updatedAfter (ISO or ms). Optional: entityTypes (e.g. ['products','categories']).
   */
  static async pull(req: AuthenticatedRequestLike & { user?: TokenPayload }, res: Response): Promise<void> {
    try {
      const storeId = req.user?.storeId;
      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      const updatedAfter =
        (req.body?.['updatedAfter'] ?? req.body?.['lastSync'] ?? req.query?.['updatedAfter'] ?? req.query?.['lastSync']) as string | undefined;
      const entityTypes = (req.body?.['entityTypes'] ?? req.query?.['entityTypes']) as string[] | undefined;
      const wantProducts = !entityTypes || entityTypes.includes('products');
      const wantCategories = !entityTypes || entityTypes.includes('categories');

      const serverTimestamp = new Date().toISOString();

      let products: any[] = [];
      let categories: any[] = [];

      if (wantProducts) {
        const query: any = { storeId, isActive: true };
        if (updatedAfter) {
          const after =
            typeof updatedAfter === 'string' && /^\d+$/.test(updatedAfter)
              ? new Date(Number(updatedAfter))
              : new Date(updatedAfter);
          if (!isNaN(after.getTime())) query.updatedAt = { $gte: after };
        }
        products = await Product.find(query)
          .populate('categoryId', 'name')
          .sort({ name: 1 })
          .lean();
      }

      if (wantCategories) {
        const query: any = { storeId, isActive: true };
        if (updatedAfter) {
          const after =
            typeof updatedAfter === 'string' && /^\d+$/.test(updatedAfter)
              ? new Date(Number(updatedAfter))
              : new Date(updatedAfter);
          if (!isNaN(after.getTime())) query.updatedAt = { $gte: after };
        }
        categories = await Category.find(query).sort({ name: 1 }).lean();
      }

      sendSuccess(res, {
        products,
        categories,
        serverTimestamp,
      });
    } catch (error: any) {
      logger.error('Sync pull error:', error);
      sendError(res, 'Failed to pull', 500);
    }
  }

  /**
   * POST /api/sync/push - Batch push operations. Body: { operations: [{ collection, operation, id, data }] }.
   * Returns { synced: number, failed: number, results?: { id, success, error? }[] }.
   */
  static async push(req: AuthenticatedRequestLike & { user?: TokenPayload }, res: Response): Promise<void> {
    try {
      const storeId = req.user?.storeId;
      const userId = req.user?.userId;
      if (!storeId || !userId) {
        sendError(res, 'Store ID or user not found', 400);
        return;
      }

      const { operations } = req.body ?? {};
      if (!Array.isArray(operations) || operations.length === 0) {
        sendSuccess(res, { synced: 0, failed: 0, results: [] });
        return;
      }

      const results: { id: string; success: boolean; error?: string }[] = [];
      let synced = 0;
      let failed = 0;

      for (const op of operations) {
        const { collection, operation, id, data } = op;
        const opId = id ?? op.documentId ?? 'unknown';

        try {
          if (collection === 'orders' && operation === 'create') {
            const result = await runController(OrderController.createOrder as any, {
              user: req.user!,
              body: data,
              idempotencyKey: opId,
            });
            if (result.statusCode >= 200 && result.statusCode < 300) {
              synced++;
              results.push({ id: opId, success: true });
            } else {
              failed++;
              results.push({
                id: opId,
                success: false,
                error: (result.body?.message as string) || `HTTP ${result.statusCode}`,
              });
            }
          } else if (collection === 'products') {
            if (operation === 'create') {
              const result = await runController(ProductController.createProduct as any, {
                user: req.user!,
                body: data,
              });
              if (result.statusCode >= 200 && result.statusCode < 300) {
                synced++;
                results.push({ id: opId, success: true });
              } else {
                failed++;
                results.push({
                  id: opId,
                  success: false,
                  error: (result.body?.message as string) || `HTTP ${result.statusCode}`,
                });
              }
            } else if (operation === 'update') {
              const serverId = data?.serverId ?? data?.id ?? opId;
              const result = await runController(ProductController.updateProduct as any, {
                user: req.user!,
                body: data,
                params: { id: serverId },
              });
              if (result.statusCode >= 200 && result.statusCode < 300) {
                synced++;
                results.push({ id: opId, success: true });
              } else {
                failed++;
                results.push({
                  id: opId,
                  success: false,
                  error: (result.body?.message as string) || `HTTP ${result.statusCode}`,
                });
              }
            } else if (operation === 'delete') {
              const serverId = data?.serverId ?? data?.id ?? opId;
              const result = await runController(ProductController.deleteProduct as any, {
                user: req.user!,
                params: { id: serverId },
              });
              if (result.statusCode >= 200 && result.statusCode < 300) {
                synced++;
                results.push({ id: opId, success: true });
              } else {
                failed++;
                results.push({
                  id: opId,
                  success: false,
                  error: (result.body?.message as string) || `HTTP ${result.statusCode}`,
                });
              }
            } else {
              failed++;
              results.push({ id: opId, success: false, error: `Unknown operation: ${operation}` });
            }
          } else if (collection === 'categories') {
            if (operation === 'create') {
              const result = await runController(CategoryController.createCategory as any, {
                user: req.user!,
                body: data,
              });
              if (result.statusCode >= 200 && result.statusCode < 300) {
                synced++;
                results.push({ id: opId, success: true });
              } else {
                failed++;
                results.push({
                  id: opId,
                  success: false,
                  error: (result.body?.message as string) || `HTTP ${result.statusCode}`,
                });
              }
            } else if (operation === 'update') {
              const serverId = data?.serverId ?? data?.id ?? opId;
              const result = await runController(CategoryController.updateCategory as any, {
                user: req.user!,
                body: data,
                params: { id: serverId },
              });
              if (result.statusCode >= 200 && result.statusCode < 300) {
                synced++;
                results.push({ id: opId, success: true });
              } else {
                failed++;
                results.push({
                  id: opId,
                  success: false,
                  error: (result.body?.message as string) || `HTTP ${result.statusCode}`,
                });
              }
            } else if (operation === 'delete') {
              const serverId = data?.serverId ?? data?.id ?? opId;
              const result = await runController(CategoryController.deleteCategory as any, {
                user: req.user!,
                params: { id: serverId },
              });
              if (result.statusCode >= 200 && result.statusCode < 300) {
                synced++;
                results.push({ id: opId, success: true });
              } else {
                failed++;
                results.push({
                  id: opId,
                  success: false,
                  error: (result.body?.message as string) || `HTTP ${result.statusCode}`,
                });
              }
            } else {
              failed++;
              results.push({ id: opId, success: false, error: `Unknown operation: ${operation}` });
            }
          } else {
            failed++;
            results.push({ id: opId, success: false, error: `Unknown collection: ${collection}` });
          }
        } catch (err: any) {
          failed++;
          results.push({
            id: opId,
            success: false,
            error: err?.message ?? String(err),
          });
        }
      }

      sendSuccess(res, { synced, failed, results });
    } catch (error: any) {
      logger.error('Sync push error:', error);
      sendError(res, 'Failed to push', 500);
    }
  }
}
