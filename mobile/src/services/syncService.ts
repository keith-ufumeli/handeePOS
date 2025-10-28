import database from '../database';
import Product from '../database/models/Product';
import Category from '../database/models/Category';
import SyncQueue, { SyncOperation } from '../database/models/SyncQueue';
import { Q } from '@nozbe/watermelondb';

// Add error handling for database initialization
let isDatabaseReady = false;
let databaseError: Error | null = null;

try {
  // Test database connection
  const _ = database.adapter.schema;
  isDatabaseReady = true;
} catch (error) {
  console.warn('Database not ready:', error);
  databaseError = error as Error;
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

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  private checkDatabaseReady(): boolean {
    if (!isDatabaseReady) {
      console.warn('Database not ready, skipping sync operation');
      return false;
    }
    return true;
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

    if (!this.checkDatabaseReady()) {
      result.success = false;
      result.errors.push('Database not ready');
      return result;
    }

    try {
      // Get all pending sync queue items
      const pendingItems = await database.collections
        .get<SyncQueue>('sync_queue')
        .query(Q.where('status', 'pending'))
        .fetch();

      for (const item of pendingItems) {
        try {
          await this.syncQueueItem(item);
          result.syncedCount++;
        } catch (error) {
          result.failedCount++;
          result.errors.push(`Failed to sync ${item.collection} ${item.documentId}: ${error}`);
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
  private async syncQueueItem(item: SyncQueue): Promise<void> {
    // Mark as syncing
    await database.write(async () => {
      await item.update((record) => {
        record.status = 'syncing';
      });
    });

    try {
      const data = item.syncData;
      
      switch (item.collectionName) {
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

      // Mark as completed
      await database.write(async () => {
        await item.update((record) => {
          record.status = 'completed';
        });
      });
    } catch (error) {
      // Mark as failed and increment retry count
      await database.write(async () => {
        await item.update((record) => {
          record.status = 'failed';
          record.retryCount += 1;
          record.errorMessage = error instanceof Error ? error.message : String(error);
        });
      });
      throw error;
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
        await this.makeRequest(`/api/products/${data.serverId}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        break;
      case 'delete':
        await this.makeRequest(`/api/products/${data.serverId}`, {
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
        await this.makeRequest(`/api/products/categories/${data.serverId}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        break;
      case 'delete':
        await this.makeRequest(`/api/products/categories/${data.serverId}`, {
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
        await this.makeRequest(`/api/orders/${data.serverId}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        break;
      case 'delete':
        await this.makeRequest(`/api/orders/${data.serverId}`, {
          method: 'DELETE',
        });
        break;
    }
  }

  /**
   * Pull latest data from server
   */
  private async pullFromServer(): Promise<void> {
    // Pull products
    const productsResponse = await this.makeRequest('/api/products');
    await this.updateLocalProducts(productsResponse.data);

    // Pull categories
    const categoriesResponse = await this.makeRequest('/api/products/categories');
    await this.updateLocalCategories(categoriesResponse.data);

    // Pull orders (if needed)
    // const ordersResponse = await this.makeRequest('/api/orders');
    // await this.updateLocalOrders(ordersResponse.data);
  }

  /**
   * Update local products with server data
   */
  private async updateLocalProducts(serverProducts: any[]): Promise<void> {
    await database.write(async () => {
      for (const serverProduct of serverProducts) {
        // Check if product exists locally
        const existingProduct = await database.collections
          .get<Product>('products')
          .query(Q.where('server_id', serverProduct._id))
          .fetch();

        if (existingProduct.length > 0) {
          // Update existing product
          await existingProduct[0].update((product) => {
            product.name = serverProduct.name;
            product.sku = serverProduct.sku;
            product.barcode = serverProduct.barcode;
            product.categoryId = serverProduct.categoryId;
            product.price = serverProduct.price;
            product.cost = serverProduct.cost;
            product.taxRate = serverProduct.taxRate;
            product.stockQuantity = serverProduct.stockQuantity;
            product.lowStockThreshold = serverProduct.lowStockThreshold;
            product.unit = serverProduct.unit;
            product.images = serverProduct.images ? JSON.stringify(serverProduct.images) : undefined;
            product.isActive = serverProduct.isActive;
            product.syncStatusValue = 'synced';
            product.lastSyncedAt = Date.now();
          });
        } else {
          // Create new product
          await database.collections.get<Product>('products').create((product) => {
            product.name = serverProduct.name;
            product.sku = serverProduct.sku;
            product.barcode = serverProduct.barcode;
            product.categoryId = serverProduct.categoryId;
            product.price = serverProduct.price;
            product.cost = serverProduct.cost;
            product.taxRate = serverProduct.taxRate;
            product.stockQuantity = serverProduct.stockQuantity;
            product.lowStockThreshold = serverProduct.lowStockThreshold;
            product.unit = serverProduct.unit;
            product.images = serverProduct.images ? JSON.stringify(serverProduct.images) : undefined;
            product.isActive = serverProduct.isActive;
            product.syncStatusValue = 'synced';
            product.serverId = serverProduct._id;
            product.lastSyncedAt = Date.now();
          });
        }
      }
    });
  }

  /**
   * Update local categories with server data
   */
  private async updateLocalCategories(serverCategories: any[]): Promise<void> {
    await database.write(async () => {
      for (const serverCategory of serverCategories) {
        // Check if category exists locally
        const existingCategory = await database.collections
          .get<Category>('categories')
          .query(Q.where('server_id', serverCategory._id))
          .fetch();

        if (existingCategory.length > 0) {
          // Update existing category
          await existingCategory[0].update((category) => {
            category.name = serverCategory.name;
            category.description = serverCategory.description;
            category.isActive = serverCategory.isActive;
            category.syncStatusValue = 'synced';
            category.lastSyncedAt = Date.now();
          });
        } else {
          // Create new category
          await database.collections.get<Category>('categories').create((category) => {
            category.name = serverCategory.name;
            category.description = serverCategory.description;
            category.isActive = serverCategory.isActive;
            category.syncStatusValue = 'synced';
            category.serverId = serverCategory._id;
            category.lastSyncedAt = Date.now();
          });
        }
      }
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
    await database.write(async () => {
      await database.collections.get<SyncQueue>('sync_queue').create((item) => {
        item.operation = operation;
        item.collectionName = collection;
        item.documentId = documentId;
        item.syncData = data;
        item.status = 'pending';
        item.retryCount = 0;
        item.timestamp = new Date();
      });
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
    const pendingItems = await database.collections
      .get<SyncQueue>('sync_queue')
      .query(Q.where('status', 'pending'))
      .fetch();

    const failedItems = await database.collections
      .get<SyncQueue>('sync_queue')
      .query(Q.where('status', 'failed'))
      .fetch();

    const lastSyncedItems = await database.collections
      .get<SyncQueue>('sync_queue')
      .query(Q.where('status', 'completed'))
      .fetch();

    const lastSyncTime = lastSyncedItems.length > 0 
      ? Math.max(...lastSyncedItems.map(item => item.timestamp.getTime()))
      : null;

    return {
      pendingCount: pendingItems.length,
      failedCount: failedItems.length,
      lastSyncTime,
    };
  }
}

export default SyncService;
