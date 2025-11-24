import * as dbHelpers from '../database/db-helpers';
import { SyncOperation, SyncQueueItem } from '../database/types';
import { getDatabase, generateId } from '../database';
import { products, categories, syncQueue } from '../database/schema';
import { eq } from 'drizzle-orm';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { config } from '../config';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: string[];
}

class SyncService {
  private baseUrl: string;
  private authToken: string | null = null;
  private tokenRestorePromise: Promise<void> | null = null;
  private readonly AUTH_TOKEN_KEY = config.authTokenKey;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Restore token from storage on initialization
    this.tokenRestorePromise = this.restoreToken();
  }

  // Ensure token is restored before making requests
  private async ensureTokenRestored() {
    if (this.tokenRestorePromise) {
      await this.tokenRestorePromise;
      this.tokenRestorePromise = null;
    }
  }

  async restoreToken() {
    try {
      const token = await AsyncStorage.getItem(this.AUTH_TOKEN_KEY);
      if (token) {
        this.authToken = token;
        console.log('[SYNC_SERVICE] Token restored from storage');
      } else {
        console.log('[SYNC_SERVICE] No token found in storage');
      }
    } catch (error) {
      console.error('[SYNC_SERVICE] Failed to restore token from storage:', error);
    }
  }

  setAuthToken(token: string) {
    this.authToken = token;
    // Also persist token to storage
    if (token) {
      AsyncStorage.setItem(this.AUTH_TOKEN_KEY, token).catch((error) => {
        console.error('[SYNC_SERVICE] Failed to save token to storage:', error);
      });
    } else {
      AsyncStorage.removeItem(this.AUTH_TOKEN_KEY).catch((error) => {
        console.error('[SYNC_SERVICE] Failed to remove token from storage:', error);
      });
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    // Ensure token is restored before making the request
    await this.ensureTokenRestored();
    
    // Double-check token is available
    if (!this.authToken) {
      // Try restoring one more time
      await this.restoreToken();
    }
    
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
      ...options.headers,
    };

    // Warn if making authenticated request without token
    const isAuthEndpoint = endpoint.includes('/auth/');
    if (!isAuthEndpoint && !this.authToken) {
      console.warn('[SYNC_SERVICE] Making request without auth token:', endpoint);
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData: any = await response.json().catch(() => ({}));
      const errorMessage = errorData?.message || errorData?.error || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * Sync all pending changes to server
   */
  async syncAll(): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      errors: [],
    };

    try {
      // Get all pending sync queue items
      const pendingItems = await dbHelpers.getPendingSyncItems();

      for (const item of pendingItems) {
        try {
          // Mark as syncing
          await dbHelpers.updateSyncQueueItem(item.id, { status: 'syncing' });

          await this.syncQueueItem(item);
          result.syncedCount++;

          // Mark as completed
          await dbHelpers.updateSyncQueueItem(item.id, { status: 'completed' });
        } catch (error) {
          result.failedCount++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(`Failed to sync ${item.collection} ${item.documentId}: ${errorMessage}`);
          
          // Mark as failed and increment retry count
          await dbHelpers.updateSyncQueueItem(item.id, {
            status: 'failed',
            retryCount: item.retryCount + 1,
            errorMessage,
          });
          console.error('Sync error:', error);
        }
      }

      // Pull latest data from server
      await this.pullFromServer();
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
        await this.syncProduct(item.operation, data);
        break;
      case 'categories':
        await this.syncCategory(item.operation, data);
        break;
      case 'orders':
        await this.syncOrder(item.operation, data);
        break;
      default:
        throw new Error(`Unknown collection: ${item.collection}`);
    }
  }

  /**
   * Sync product to server
   */
  private async syncProduct(operation: SyncOperation, data: any): Promise<void> {
    switch (operation) {
      case 'create':
        await this.makeRequest('/api/products', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        break;
      case 'update':
        await this.makeRequest(`/api/products/${data.serverId || data.id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        break;
      case 'delete':
        await this.makeRequest(`/api/products/${data.serverId || data.id}`, {
          method: 'DELETE',
        });
        break;
    }
  }

  /**
   * Sync category to server
   */
  private async syncCategory(operation: SyncOperation, data: any): Promise<void> {
    switch (operation) {
      case 'create':
        await this.makeRequest('/api/products/categories', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        break;
      case 'update':
        await this.makeRequest(`/api/products/categories/${data.serverId || data.id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        break;
      case 'delete':
        await this.makeRequest(`/api/products/categories/${data.serverId || data.id}`, {
          method: 'DELETE',
        });
        break;
    }
  }

  /**
   * Sync order to server
   */
  private async syncOrder(operation: SyncOperation, data: any): Promise<void> {
    switch (operation) {
      case 'create':
        await this.makeRequest('/api/orders', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        break;
      case 'update':
        await this.makeRequest(`/api/orders/${data.serverId || data.id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        break;
      case 'delete':
        await this.makeRequest(`/api/orders/${data.serverId || data.id}`, {
          method: 'DELETE',
        });
        break;
    }
  }

  /**
   * Pull latest data from server
   */
  private async pullFromServer(): Promise<void> {
    try {
      // Pull products
      // Backend returns: { success: true, data: { products: [...], pagination: {...} } }
      const productsResponse = await this.makeRequest('/api/products') as ApiResponse<any>;
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
            throw error; // Re-throw to be caught by outer catch
          }
        }
      }

      // Pull categories
      // Backend returns: { success: true, data: [...] } or { success: true, data: { categories: [...] } }
      const categoriesResponse = await this.makeRequest('/api/products/categories') as ApiResponse<any>;
      console.log('[SYNC_SERVICE] Categories response:', {
        success: categoriesResponse.success,
        hasData: !!categoriesResponse.data,
        dataType: typeof categoriesResponse.data,
        isArray: Array.isArray(categoriesResponse.data),
        categoriesCount: Array.isArray(categoriesResponse.data)
          ? categoriesResponse.data.length
          : categoriesResponse.data?.categories?.length || 0
      });
      
      if (categoriesResponse.success && categoriesResponse.data) {
        // Handle both response formats
        const categoriesArray = Array.isArray(categoriesResponse.data)
          ? categoriesResponse.data
          : categoriesResponse.data.categories || [];
        
        console.log('[SYNC_SERVICE] Processing categories:', categoriesArray.length);
        if (categoriesArray.length > 0) {
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
            throw error; // Re-throw to be caught by outer catch
          }
        }
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

        // Check if product exists locally by server_id
        const existingProducts = serverId 
          ? await db.select().from(products)
              .where(eq(products.serverId, serverId))
              .limit(1)
          : [];

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

        const now = Date.now();
        const productData = {
          name: String(serverProduct.name || ''),
          sku: String(serverProduct.sku || ''),
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
    
    for (const serverCategory of serverCategories) {
      try {
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
          continue;
        }

        // Check if category exists locally by server_id
        const existingCategories = await db.select().from(categories)
          .where(eq(categories.serverId, serverId))
          .limit(1);

        const now = Date.now();
        const categoryData = {
          name: String(serverCategory.name || ''),
          description: serverCategory.description ? String(serverCategory.description) : null,
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
        } else {
          // Create new category
          const id = await generateId();
          await db.insert(categories).values({
            id,
            ...categoryData,
            createdAt: new Date(now), // Drizzle timestamp mode expects Date object
          });
        }
      } catch (error) {
        console.error('[SYNC_SERVICE] Error updating category:', {
          category: serverCategory.name,
          error: error instanceof Error ? error.message : String(error),
          errorDetails: error
        });
      }
    }
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
    await dbHelpers.createSyncQueueItem({
      operation,
      collection,
      documentId,
      data,
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

export default SyncService;
