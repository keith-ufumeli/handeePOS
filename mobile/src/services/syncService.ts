import * as dbHelpers from '../database/db-helpers';
import { SyncOperation, SyncQueueItem } from '../database/types';
import { getDatabase, generateId } from '../database';
import { products, categories, customers, syncQueue } from '../database/schema';
import { eq } from 'drizzle-orm';
import apiService, { ApiResponse } from './apiService';
import { getOrCreateDeviceId } from '../utils/deviceId';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: string[];
  /** Set after a successful pull when server returns serverTimestamp (for incremental pull). */
  serverTimestamp?: string;
}

class SyncService {
  /**
   * Sync all pending changes to server.
   * @param lastSyncTime - Optional ISO timestamp or ms for incremental pull (updatedAfter).
   */
  async syncAll(lastSyncTime?: string | null): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      errors: [],
    };

    try {
      // Recover items stuck in 'syncing' from a previous crash
      const resetCount = await dbHelpers.resetStaleSyncingItems();
      if (resetCount > 0) {
        console.log('[SYNC_SERVICE] Reset stale syncing items to pending:', resetCount);
      }

      // Get all pending sync queue items
      const pendingItems = await dbHelpers.getPendingSyncItems();

      console.log('[SYNC_SERVICE] Processing sync queue items:', pendingItems.length);
      for (const item of pendingItems) {
        try {
          console.log('[SYNC_SERVICE] Syncing queue item:', {
            id: item.id,
            collection: item.collection,
            operation: item.operation,
            documentId: item.documentId
          });

          // Mark as syncing
          await dbHelpers.updateSyncQueueItem(item.id, { status: 'syncing' });

          await this.syncQueueItem(item);
          result.syncedCount++;
          console.log('[SYNC_SERVICE] Successfully synced queue item:', item.id);

          // Mark as completed
          await dbHelpers.updateSyncQueueItem(item.id, { status: 'completed' });
        } catch (error) {
          result.failedCount++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(`Failed to sync ${item.collection} ${item.documentId}: ${errorMessage}`);

          console.error('[SYNC_SERVICE] Sync queue item failed:', {
            id: item.id,
            collection: item.collection,
            operation: item.operation,
            documentId: item.documentId,
            error: errorMessage,
            errorStack: error instanceof Error ? error.stack?.substring(0, 500) : undefined
          });

          // Mark as failed and increment retry count
          await dbHelpers.updateSyncQueueItem(item.id, {
            status: 'failed',
            retryCount: item.retryCount + 1,
            errorMessage,
          });
        }
      }

      console.log('[SYNC_SERVICE] Sync queue processing complete. Starting pullFromServer...');

      // Pull latest data from server (incremental when lastSyncTime is set)
      const serverTimestamp = await this.pullFromServer(lastSyncTime);
      if (serverTimestamp) result.serverTimestamp = serverTimestamp;
    } catch (error) {
      result.success = false;
      result.errors.push(`Sync failed: ${error}`);
    }

    return result;
  }

  /**
   * Sync a single queue item
   */
  private async syncQueueItem(item: SyncQueueItem): Promise<void> {
    const data = item.syncData;

    switch (item.collection) {
      case 'products':
        await this.syncProduct(item.operation, data, item.documentId);
        break;
      case 'categories':
        await this.syncCategory(item.operation, data, item.documentId);
        break;
      case 'orders':
        await this.syncOrder(item.operation, data, item.documentId);
        break;
      case 'customers':
        await this.syncCustomer(item.operation, data, item.documentId);
        break;
      default:
        throw new Error(`Unknown collection: ${item.collection}`);
    }
  }

  /**
   * Sync product to server
   */
  private async syncProduct(operation: SyncOperation, data: any, documentId: string): Promise<void> {
    const db = await getDatabase();

    // For update/delete, we need the serverId. 
    // Look it up from the local database to ensure we have the latest one (in case it was just created/synced).
    let serverId = data.serverId || data.id;

    if (operation !== 'create') {
      const localProduct = await db.select().from(products).where(eq(products.id, documentId)).limit(1);
      if (localProduct.length > 0 && localProduct[0].serverId) {
        serverId = localProduct[0].serverId;
      }
    }

    switch (operation) {
      case 'create':
        // Dynamically resolve categoryId string UUID to the mongo serverId
        const payloadCreate = { ...data };
        if (payloadCreate.categoryId) {
          const catCreate = await db.select().from(categories).where(eq(categories.id, payloadCreate.categoryId)).limit(1);
          if (catCreate.length > 0 && catCreate[0].serverId) {
            payloadCreate.categoryId = catCreate[0].serverId;
          }
        }

        const createResponse = await apiService.post('/api/products', payloadCreate) as any;

        // Unwrap { success, data: {...} } envelope that apiService returns
        const createdProduct = createResponse?.data ?? createResponse;
        const newServerId = createdProduct?._id ?? createdProduct?.id ?? null;
        await db.update(products)
          .set({
            ...(newServerId ? { serverId: String(newServerId) } : {}),
            syncStatus: 'synced',
            lastSyncedAt: Date.now()
          })
          .where(eq(products.id, documentId));
        break;
      case 'update': {
        if (!serverId) throw new Error('Cannot update product: Missing serverId');
        const localProduct = await db.select().from(products).where(eq(products.id, documentId)).limit(1);
        const payload = { ...data };

        // Dynamically resolve categoryId string UUID to the mongo serverId
        if (payload.categoryId) {
          const catUpdate = await db.select().from(categories).where(eq(categories.id, payload.categoryId)).limit(1);
          if (catUpdate.length > 0 && catUpdate[0].serverId) {
            payload.categoryId = catUpdate[0].serverId;
          }
        }

        if (localProduct.length > 0 && localProduct[0].syncVersion != null) {
          payload.syncVersion = localProduct[0].syncVersion;
        }
        const updateResponse = await apiService.put(`/api/products/${serverId}`, payload) as any;
        await db.update(products)
          .set({
            syncStatus: 'synced',
            lastSyncedAt: Date.now(),
            ...(updateResponse?.data?.syncVersion != null ? { syncVersion: updateResponse.data.syncVersion } : {}),
          })
          .where(eq(products.id, documentId));
        break;
      }
      case 'delete':
        if (!serverId) {
          console.warn('[SYNC_SERVICE] Cannot delete product: Missing serverId. It may have not been synced yet.');
          return;
        }
        await apiService.delete(`/api/products/${serverId}`);
        break;
    }
  }

  /**
   * Sync category to server
   */
  private async syncCategory(operation: SyncOperation, data: any, documentId: string): Promise<void> {
    const db = await getDatabase();

    let serverId = data.serverId || data.id;

    if (operation !== 'create') {
      const localCategory = await db.select().from(categories).where(eq(categories.id, documentId)).limit(1);
      if (localCategory.length > 0 && localCategory[0].serverId) {
        serverId = localCategory[0].serverId;
      }
    }

    switch (operation) {
      case 'create': {
        const createResponse = await apiService.post('/api/products/categories', data) as any;

        // Unwrap { success, data: {...} } envelope that apiService returns
        const createdCategory = createResponse?.data ?? createResponse;
        const newCatServerId = createdCategory?._id ?? createdCategory?.id ?? null;
        await db.update(categories)
          .set({
            ...(newCatServerId ? { serverId: String(newCatServerId) } : {}),
            syncStatus: 'synced',
            lastSyncedAt: Date.now()
          })
          .where(eq(categories.id, documentId));
        break;
      }
      case 'update':
        if (!serverId) throw new Error('Cannot update category: Missing serverId');
        await apiService.put(`/api/products/categories/${serverId}`, data);
        await db.update(categories)
          .set({ syncStatus: 'synced', lastSyncedAt: Date.now() })
          .where(eq(categories.id, documentId));
        break;
      case 'delete':
        if (!serverId) {
          console.warn('[SYNC_SERVICE] Cannot delete category: Missing serverId');
          return;
        }
        await apiService.delete(`/api/products/categories/${serverId}`);
        break;
    }
  }

  /**
   * Sync order to server.
   * For create: maps local productIds to serverIds so backend can find products.
   */
  private async syncOrder(operation: SyncOperation, data: any, documentId: string): Promise<void> {
    switch (operation) {
      case 'create': {
        // Resolve local productIds to serverIds (backend expects MongoDB ObjectIds)
        const items = Array.isArray(data.items) ? data.items : [];
        const db = await getDatabase();
        const mappedItems: any[] = [];
        for (const item of items) {
          const localProductId = item.productId;
          if (!localProductId) {
            throw new Error(`Order item missing productId (productName: ${item.productName ?? 'unknown'})`);
          }
          const rows = await db.select({ serverId: products.serverId }).from(products).where(eq(products.id, localProductId)).limit(1);
          const serverId = rows[0]?.serverId;
          if (!serverId) {
            throw new Error(`Product not yet synced to server: ${item.productName ?? localProductId}. Sync products first.`);
          }
          mappedItems.push({ ...item, productId: serverId });
        }
        const payload = { ...data, items: mappedItems };
        const response = await apiService.post<{ success?: boolean; data?: any }>(
          '/api/orders',
          payload,
          { 'X-Idempotency-Key': documentId }
        );
        const order = response?.data ?? response;
        const serverId = order?._id ?? order?.id;
        if (serverId) {
          await dbHelpers.updateOrderSyncResult(documentId, {
            serverId: String(serverId),
            orderNumber: order?.orderNumber,
            syncStatus: 'synced',
            lastSyncedAt: Date.now(),
          });
        }
        break;
      }
      case 'update':
        await apiService.put(`/api/orders/${data.serverId || data.id}`, data);
        break;
      case 'delete':
        await apiService.delete(`/api/orders/${data.serverId || data.id}`);
        break;
    }
  }

  /**
   * Sync customer to server
   */
  private async syncCustomer(operation: SyncOperation, data: any, documentId: string): Promise<void> {
    const db = await getDatabase();
    let serverId = data.serverId || data._id;

    if (operation !== 'create') {
      const rows = await db.select().from(customers).where(eq(customers.id, documentId)).limit(1);
      if (rows.length > 0 && rows[0].serverId) {
        serverId = rows[0].serverId;
      }
    }

    switch (operation) {
      case 'create': {
        const payload = {
          name: data.name,
          email: data.email,
          phoneNumber: data.phoneNumber,
          address: data.address,
          notes: data.notes,
        };
        const response = await apiService.post<{ data?: { _id?: string }; _id?: string }>('/api/customers', payload);
        const res = response?.data ?? response;
        const newServerId = res?._id ?? (res as any)?.id;
        if (newServerId) {
          await dbHelpers.updateCustomerSyncResult(documentId, {
            serverId: String(newServerId),
            syncStatus: 'synced',
            lastSyncedAt: Date.now(),
          });
        }
        break;
      }
      case 'update':
        if (!serverId) throw new Error('Cannot update customer: Missing serverId');
        await apiService.put(`/api/customers/${serverId}`, {
          name: data.name,
          email: data.email,
          phoneNumber: data.phoneNumber,
          address: data.address,
          notes: data.notes,
        });
        await db.update(customers).set({ syncStatus: 'synced', lastSyncedAt: Date.now(), updatedAt: new Date() }).where(eq(customers.id, documentId));
        break;
      case 'delete':
        if (!serverId) return;
        await apiService.delete(`/api/customers/${serverId}`);
        break;
    }
  }

  /**
   * Pull latest data from server. When lastSyncTime is set, sends updatedAfter for incremental pull.
   * @returns serverTimestamp from response when present (for storing as next lastSyncTime).
   */
  private async pullFromServer(lastSyncTime?: string | null): Promise<string | undefined> {
    let serverTimestamp: string | undefined;
    const updatedAfter = lastSyncTime
      ? (typeof lastSyncTime === 'string' && /^\d+$/.test(lastSyncTime) ? lastSyncTime : lastSyncTime)
      : undefined;

    // Pull products (don't let errors stop category sync)
    try {
      console.log('[SYNC_SERVICE] ===== Starting pullFromServer =====', updatedAfter ? { updatedAfter } : '');
      console.log('[SYNC_SERVICE] Fetching products from server...');
      // Pull products (with optional updatedAfter for incremental pull)
      const productsUrl = updatedAfter
        ? `/api/products?updatedAfter=${encodeURIComponent(updatedAfter)}`
        : '/api/products';
      const productsResponse = await apiService.get<ApiResponse<any>>(productsUrl);
      console.log('[SYNC_SERVICE] Products response:', {
        success: productsResponse.success,
        hasData: !!productsResponse.data,
        dataType: typeof productsResponse.data,
        isArray: Array.isArray(productsResponse.data),
        productsCount: Array.isArray(productsResponse.data)
          ? productsResponse.data.length
          : productsResponse.data?.products?.length || 0
      });

      if (productsResponse.success && productsResponse.data) {
        if (productsResponse.data.serverTimestamp) {
          serverTimestamp = productsResponse.data.serverTimestamp;
        }
        // Handle both response formats:
        // 1. { data: { products: [...], pagination: {...} } } - from GET /api/products
        // 2. { data: [...] } - direct array (for backward compatibility)
        const productsArray = Array.isArray(productsResponse.data)
          ? productsResponse.data
          : productsResponse.data.products || [];

        console.log('[SYNC_SERVICE] Processing products:', productsArray.length);
        if (productsArray.length > 0) {
          try {
            await this.updateLocalProducts(productsArray);
            console.log('[SYNC_SERVICE] Products updated successfully');
          } catch (error) {
            console.error('[SYNC_SERVICE] Error in updateLocalProducts:', {
              error: error instanceof Error ? error.message : String(error),
              errorName: error instanceof Error ? error.name : typeof error,
              errorStack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
              productsCount: productsArray.length
            });
            // Don't throw - allow categories to sync even if products fail
          }
        }
      }
    } catch (error) {
      console.error('[SYNC_SERVICE] Error fetching products (continuing with categories):', {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
      });
      // Continue to categories sync even if products fail
    }

    // Pull categories (separate try-catch to ensure it always runs)
    // This MUST run even if products failed
    console.log('[SYNC_SERVICE] ===== Starting categories fetch (products may have failed) =====');
    try {
      // Pull categories
      // Backend returns: { success: true, data: [...] } or { success: true, data: { categories: [...] } }
      console.log('[SYNC_SERVICE] Fetching categories from server...');
      const categoriesUrl = updatedAfter
        ? `/api/products/categories?updatedAfter=${encodeURIComponent(updatedAfter)}`
        : '/api/products/categories';
      let categoriesResponse: ApiResponse<any>;
      try {
        categoriesResponse = await apiService.get<ApiResponse<any>>(categoriesUrl);
        console.log('[SYNC_SERVICE] Categories request completed successfully');
      } catch (requestError) {
        console.error('[SYNC_SERVICE] Categories request failed in try block:', {
          error: requestError instanceof Error ? requestError.message : String(requestError),
          errorName: requestError instanceof Error ? requestError.name : typeof requestError,
        });
        throw requestError; // Re-throw to be caught by outer catch
      }
      console.log('[SYNC_SERVICE] Categories response:', {
        success: categoriesResponse.success,
        hasData: !!categoriesResponse.data,
        dataType: typeof categoriesResponse.data,
        isArray: Array.isArray(categoriesResponse.data),
        categoriesCount: Array.isArray(categoriesResponse.data)
          ? categoriesResponse.data.length
          : categoriesResponse.data?.categories?.length || 0,
        responseKeys: categoriesResponse.data ? Object.keys(categoriesResponse.data) : [],
        fullResponse: JSON.stringify(categoriesResponse).substring(0, 500)
      });

      if (categoriesResponse.success && categoriesResponse.data) {
        if (categoriesResponse.data.serverTimestamp && !serverTimestamp) {
          serverTimestamp = categoriesResponse.data.serverTimestamp;
        }
        // Handle both response formats
        const categoriesArray = Array.isArray(categoriesResponse.data)
          ? categoriesResponse.data
          : categoriesResponse.data.categories || [];

        console.log('[SYNC_SERVICE] Processing categories:', categoriesArray.length);
        if (categoriesArray.length > 0) {
          console.log('[SYNC_SERVICE] Sample category:', JSON.stringify(categoriesArray[0]).substring(0, 200));
          try {
            await this.updateLocalCategories(categoriesArray);
            console.log('[SYNC_SERVICE] Categories updated successfully');
          } catch (error) {
            console.error('[SYNC_SERVICE] Error in updateLocalCategories:', {
              error: error instanceof Error ? error.message : String(error),
              errorName: error instanceof Error ? error.name : typeof error,
              errorStack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
              categoriesCount: categoriesArray.length
            });
            // Don't throw - allow sync to continue
          }
        } else {
          console.warn('[SYNC_SERVICE] No categories to process. Response data:', JSON.stringify(categoriesResponse.data).substring(0, 300));
        }
      } else {
        console.warn('[SYNC_SERVICE] Categories response not successful or no data:', {
          success: categoriesResponse.success,
          hasData: !!categoriesResponse.data,
          message: categoriesResponse.message,
          error: categoriesResponse.error
        });
      }
    } catch (error) {
      // Enhanced error logging
      const errorInfo: any = {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : typeof error,
        errorType: typeof error,
      };

      if (error instanceof Error) {
        errorInfo.errorStack = error.stack?.substring(0, 1000);
        // Try to get more details from the error object
        if ('cause' in error) {
          errorInfo.errorCause = error.cause;
        }
      }

      // Try to stringify the error object
      try {
        errorInfo.errorStringified = JSON.stringify(error, Object.getOwnPropertyNames(error));
      } catch {
        errorInfo.errorStringified = '[Unable to stringify]';
      }

      console.error('[SYNC_SERVICE] Error pulling from server:', errorInfo);
      console.error('[SYNC_SERVICE] Raw error object:', error);

      // Don't throw - allow sync to continue even if pull fails
    }

    // Pull customers
    try {
      console.log('[SYNC_SERVICE] Fetching customers from server...');
      const customersResponse = await apiService.get<ApiResponse<{ customers?: any[] }>>('/api/customers?limit=1000');
      if (customersResponse.success && customersResponse.data) {
        const list = customersResponse.data.customers ?? (Array.isArray(customersResponse.data) ? customersResponse.data : []);
        if (list.length > 0) {
          await dbHelpers.upsertCustomersFromServer(list);
          console.log('[SYNC_SERVICE] Customers updated successfully:', list.length);
        }
      }
    } catch (error) {
      console.error('[SYNC_SERVICE] Error fetching customers:', error instanceof Error ? error.message : String(error));
    }

    return serverTimestamp;
  }

  /**
   * Update local products with server data
   */
  private async updateLocalProducts(serverProducts: any[]): Promise<void> {
    const db = await getDatabase();

    for (const serverProduct of serverProducts) {
      try {
        // Extract and convert categoryId (handle populated format and ObjectId format)
        // Backend populates categoryId, so it might be: { _id: "...", name: "..." } or just a string/ObjectId
        let categoryId = '';
        if (serverProduct.categoryId) {
          // Handle populated category object: { _id: "...", name: "..." }
          if (typeof serverProduct.categoryId === 'object') {
            // Check if it's a populated Mongoose document with _id
            if ('_id' in serverProduct.categoryId) {
              const populatedId = serverProduct.categoryId._id;
              // Handle nested ObjectId format: { _id: { $oid: "..." } }
              if (typeof populatedId === 'object' && '$oid' in populatedId) {
                categoryId = String(populatedId.$oid);
              } else {
                categoryId = String(populatedId);
              }
            } else if ('$oid' in serverProduct.categoryId) {
              // Handle ObjectId format: { $oid: "..." }
              categoryId = String(serverProduct.categoryId.$oid);
            } else if ('toString' in serverProduct.categoryId && typeof serverProduct.categoryId.toString === 'function') {
              // Handle Mongoose ObjectId instance
              categoryId = serverProduct.categoryId.toString();
            } else {
              // Fallback: try to stringify and extract
              categoryId = String(serverProduct.categoryId);
            }
          } else {
            // Direct string or number
            categoryId = String(serverProduct.categoryId);
          }
        } else if (serverProduct.category_id) {
          categoryId = String(serverProduct.category_id);
        }

        // Skip products without valid categoryId (required field)
        if (!categoryId || categoryId.trim() === '' || categoryId === 'null' || categoryId === 'undefined') {
          console.warn('[SYNC_SERVICE] Skipping product without valid categoryId:', {
            name: serverProduct.name,
            sku: serverProduct.sku,
            categoryId: serverProduct.categoryId,
            categoryIdType: typeof serverProduct.categoryId
          });
          continue;
        }

        // Extract serverId
        let serverId = '';
        if (serverProduct._id) {
          if (typeof serverProduct._id === 'object' && '$oid' in serverProduct._id) {
            serverId = String(serverProduct._id.$oid);
          } else {
            serverId = String(serverProduct._id);
          }
        } else if (serverProduct.id) {
          serverId = String(serverProduct.id);
        }

        // Check if product exists locally by server_id or sku
        let existingProducts: any[] = [];
        if (serverId) {
          existingProducts = await db.select().from(products).where(eq(products.serverId, serverId)).limit(1);
        }

        // Validate required fields before creating productData
        if (!serverProduct.name || !serverProduct.sku) {
          console.warn('[SYNC_SERVICE] Skipping product with missing required fields:', {
            name: serverProduct.name,
            sku: serverProduct.sku,
            hasName: !!serverProduct.name,
            hasSku: !!serverProduct.sku
          });
          continue;
        }

        if (existingProducts.length === 0 && serverProduct.sku) {
          existingProducts = await db.select().from(products).where(eq(products.sku, String(serverProduct.sku).toUpperCase())).limit(1);
        }

        const now = Date.now();
        const serverSyncVersion = serverProduct.syncVersion != null ? Number(serverProduct.syncVersion) : null;
        const productData = {
          name: String(serverProduct.name || ''),
          sku: String(serverProduct.sku || '').toUpperCase(),
          barcode: serverProduct.barcode ? String(serverProduct.barcode) : null,
          categoryId: categoryId,
          price: Number(serverProduct.price) || 0,
          cost: Number(serverProduct.cost) || 0,
          taxRate: Number(serverProduct.taxRate || serverProduct.tax_rate || 0),
          stockQuantity: Number(serverProduct.stockQuantity || serverProduct.stock_quantity || 0),
          lowStockThreshold: Number(serverProduct.lowStockThreshold || serverProduct.low_stock_threshold || 5),
          unit: String(serverProduct.unit || 'pcs'),
          images: serverProduct.images ? JSON.stringify(serverProduct.images) : null,
          isActive: serverProduct.isActive !== false,
          syncStatus: 'synced' as const,
          lastSyncedAt: now,
          serverId: serverId || null,
          syncVersion: serverSyncVersion,
          updatedAt: new Date(now), // Drizzle timestamp mode expects Date object
        };

        // Log product data for debugging (first product only)
        if (serverProducts.indexOf(serverProduct) === 0) {
          console.log('[SYNC_SERVICE] Sample product data:', {
            name: productData.name,
            sku: productData.sku,
            categoryId: productData.categoryId,
            categoryIdLength: productData.categoryId.length,
            price: productData.price,
            hasServerId: !!productData.serverId
          });
        }

        if (existingProducts.length > 0) {
          // Update existing product
          await db.update(products)
            .set(productData)
            .where(eq(products.id, existingProducts[0].id));
        } else {
          // Create new product
          const id = await generateId();
          await db.insert(products).values({
            id,
            ...productData,
            createdAt: new Date(now), // Drizzle timestamp mode expects Date object
          });
        }
      } catch (error) {
        console.error('[SYNC_SERVICE] Error updating product:', {
          product: serverProduct.name || serverProduct.sku,
          error: error instanceof Error ? error.message : String(error),
          errorName: error instanceof Error ? error.name : undefined,
          errorStack: error instanceof Error ? error.stack?.substring(0, 500) : undefined,
          productData: {
            name: serverProduct.name,
            sku: serverProduct.sku,
            categoryId: serverProduct.categoryId,
            categoryIdType: typeof serverProduct.categoryId,
            hasPrice: serverProduct.price !== undefined,
            hasCost: serverProduct.cost !== undefined
          }
        });
        // Continue with next product instead of stopping entire sync
      }
    }
  }

  /**
   * Update local categories with server data
   */
  private async updateLocalCategories(serverCategories: any[]): Promise<void> {
    const db = await getDatabase();

    let successCount = 0;
    let errorCount = 0;

    for (const serverCategory of serverCategories) {
      try {
        // Validate required fields
        if (!serverCategory.name || String(serverCategory.name).trim() === '') {
          console.warn('[SYNC_SERVICE] Skipping category without name:', serverCategory);
          errorCount++;
          continue;
        }

        // Extract serverId (handle ObjectId format)
        let serverId = '';
        if (serverCategory._id) {
          if (typeof serverCategory._id === 'object' && '$oid' in serverCategory._id) {
            serverId = String(serverCategory._id.$oid);
          } else {
            serverId = String(serverCategory._id);
          }
        } else if (serverCategory.id) {
          serverId = String(serverCategory.id);
        }

        // Skip categories without valid serverId
        if (!serverId || serverId.trim() === '') {
          console.warn('[SYNC_SERVICE] Skipping category without serverId:', serverCategory.name);
          errorCount++;
          continue;
        }

        // Check if category exists locally by server_id or name
        let existingCategories: any[] = [];
        if (serverId) {
          existingCategories = await db.select().from(categories).where(eq(categories.serverId, serverId)).limit(1);
        }

        if (existingCategories.length === 0 && serverCategory.name) {
          existingCategories = await db.select().from(categories).where(eq(categories.name, String(serverCategory.name).trim())).limit(1);
        }

        const now = Date.now();
        const categoryName = String(serverCategory.name || '').trim();

        // Ensure name is not empty after trimming
        if (!categoryName) {
          console.warn('[SYNC_SERVICE] Skipping category with empty name after trim');
          errorCount++;
          continue;
        }

        const categoryData = {
          name: categoryName,
          description: serverCategory.description ? String(serverCategory.description).trim() : null,
          isActive: serverCategory.isActive !== false,
          syncStatus: 'synced' as const,
          lastSyncedAt: now,
          serverId: serverId,
          updatedAt: new Date(now), // Drizzle timestamp mode expects Date object
        };

        if (existingCategories.length > 0) {
          // Update existing category
          await db.update(categories)
            .set(categoryData)
            .where(eq(categories.id, existingCategories[0].id));
          successCount++;
          console.log('[SYNC_SERVICE] Updated category:', categoryName);
        } else {
          // Create new category
          const id = await generateId();
          await db.insert(categories).values({
            id,
            ...categoryData,
            createdAt: new Date(now), // Drizzle timestamp mode expects Date object
          });
          successCount++;
          console.log('[SYNC_SERVICE] Created category:', categoryName);
        }
      } catch (error) {
        errorCount++;
        console.error('[SYNC_SERVICE] Error updating category:', {
          category: serverCategory.name,
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack?.substring(0, 300) : undefined,
          categoryData: {
            name: serverCategory.name,
            hasId: !!serverCategory._id || !!serverCategory.id,
          }
        });
        // Continue processing other categories instead of throwing
      }
    }

    console.log('[SYNC_SERVICE] Category sync summary:', {
      total: serverCategories.length,
      success: successCount,
      errors: errorCount
    });
  }

  /**
   * Add item to sync queue
   */
  async addToSyncQueue(
    operation: SyncOperation,
    collection: string,
    documentId: string,
    data: any
  ): Promise<void> {
    const deviceId = await getOrCreateDeviceId();
    await dbHelpers.createSyncQueueItem({
      operation,
      collection,
      documentId,
      data,
      deviceId,
    });
  }

  /**
   * Get sync status
   */
  async getSyncStatus(): Promise<{
    pendingCount: number;
    failedCount: number;
    lastSyncTime: number | null;
  }> {
    const pendingItems = await dbHelpers.getPendingSyncItems();

    const db = await getDatabase();
    const failedItems = await db.select().from(syncQueue)
      .where(eq(syncQueue.status, 'failed'));

    const completedItems = await db.select().from(syncQueue)
      .where(eq(syncQueue.status, 'completed'));

    const lastSyncTime = completedItems.length > 0
      ? Math.max(...completedItems.map(item => item.timestamp.getTime()))
      : null;

    return {
      pendingCount: pendingItems.length,
      failedCount: failedItems.length,
      lastSyncTime,
    };
  }
}

export default new SyncService();
