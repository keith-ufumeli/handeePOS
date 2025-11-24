import * as dbHelpers from '../database/db-helpers';
import { SyncOperation, SyncQueueItem } from '../database/types';
import { getDatabase, generateId } from '../database';
import { products, categories, syncQueue } from '../database/schema';
import { eq } from 'drizzle-orm';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: string[];
}

class SyncService {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
      const productsResponse = await this.makeRequest('/api/products');
      if (productsResponse.success && productsResponse.data) {
        await this.updateLocalProducts(productsResponse.data);
      }

      // Pull categories
      const categoriesResponse = await this.makeRequest('/api/products/categories');
      if (categoriesResponse.success && categoriesResponse.data) {
        await this.updateLocalCategories(categoriesResponse.data);
      }
    } catch (error) {
      console.error('Error pulling from server:', error);
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
        // Check if product exists locally by server_id
        const existingProducts = await db.select().from(products)
          .where(eq(products.serverId, serverProduct._id || serverProduct.id))
          .limit(1);

        const productData = {
          name: serverProduct.name,
          sku: serverProduct.sku,
          barcode: serverProduct.barcode || null,
          categoryId: serverProduct.categoryId || serverProduct.category_id || '',
          price: serverProduct.price,
          cost: serverProduct.cost || 0,
          taxRate: serverProduct.taxRate || serverProduct.tax_rate || 0,
          stockQuantity: serverProduct.stockQuantity || serverProduct.stock_quantity || 0,
          lowStockThreshold: serverProduct.lowStockThreshold || serverProduct.low_stock_threshold || 5,
          unit: serverProduct.unit || 'pcs',
          images: serverProduct.images ? JSON.stringify(serverProduct.images) : null,
          isActive: serverProduct.isActive !== false,
          syncStatus: 'synced',
          lastSyncedAt: Date.now(),
          serverId: serverProduct._id || serverProduct.id,
          updatedAt: new Date(),
        };

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
            createdAt: new Date(),
          });
        }
      } catch (error) {
        console.error('Error updating product:', error);
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
        // Check if category exists locally by server_id
        const existingCategories = await db.select().from(categories)
          .where(eq(categories.serverId, serverCategory._id || serverCategory.id))
          .limit(1);

        const categoryData = {
          name: serverCategory.name,
          description: serverCategory.description || null,
          isActive: serverCategory.isActive !== false,
          syncStatus: 'synced',
          lastSyncedAt: Date.now(),
          serverId: serverCategory._id || serverCategory.id,
          updatedAt: new Date(),
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
            createdAt: new Date(),
          });
        }
      } catch (error) {
        console.error('Error updating category:', error);
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
