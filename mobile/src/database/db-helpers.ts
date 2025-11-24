import { eq, and, or, like, gte, lte, desc, asc, sql } from 'drizzle-orm';
import { getDatabase, generateId } from './index';
import { products, categories, orders, syncQueue } from './schema';
import { Product, Category, Order, SyncQueueItem, productFromDb, categoryFromDb, orderFromDb, syncQueueFromDb } from './types';

// Products helpers
export async function getAllProducts(filters?: {
  search?: string;
  category?: string;
  lowStock?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<Product[]> {
  const db = await getDatabase();
  
  const conditions = [eq(products.isActive, true)];

  if (filters?.search) {
    conditions.push(
      or(
        like(products.name, `%${filters.search}%`),
        like(products.sku, `%${filters.search}%`),
        eq(products.barcode, filters.search)
      )!
    );
  }

  if (filters?.category) {
    conditions.push(eq(products.categoryId, filters.category));
  }

  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];
  
  // Apply sorting
  const sortBy = filters?.sortBy || 'name';
  const sortOrder = filters?.sortOrder || 'asc';
  
  let results;
  if (sortBy === 'name') {
    results = await db.select().from(products)
      .where(whereClause)
      .orderBy(sortOrder === 'desc' ? desc(products.name) : asc(products.name));
  } else {
    results = await db.select().from(products)
      .where(whereClause)
      .orderBy(sortOrder === 'desc' ? desc(products.createdAt) : asc(products.createdAt));
  }

  let productsList = results.map(productFromDb);

  // Filter low stock in memory if needed
  if (filters?.lowStock) {
    productsList = productsList.filter(p => p.isLowStock);
  }

  return productsList;
}

export async function getProductById(id: string): Promise<Product | null> {
  const db = await getDatabase();
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result.length > 0 ? productFromDb(result[0]) : null;
}

export async function searchProductsByBarcode(barcode: string): Promise<Product[]> {
  const db = await getDatabase();
  const results = await db.select().from(products)
    .where(and(eq(products.isActive, true), eq(products.barcode, barcode)));
  return results.map(productFromDb);
}

export async function createProduct(data: {
  name: string;
  sku: string;
  barcode?: string;
  categoryId: string;
  price: number;
  cost: number;
  taxRate?: number;
  stockQuantity?: number;
  lowStockThreshold?: number;
  unit?: string;
  images?: string[];
}): Promise<Product> {
  const db = await getDatabase();
  const id = await generateId();
  const now = Date.now();

  await db.insert(products).values({
    id,
    name: data.name,
    sku: data.sku,
    barcode: data.barcode || null,
    categoryId: data.categoryId,
    price: data.price,
    cost: data.cost,
    taxRate: data.taxRate || 0,
    stockQuantity: data.stockQuantity || 0,
    lowStockThreshold: data.lowStockThreshold || 5,
    unit: data.unit || 'pcs',
    images: data.images ? JSON.stringify(data.images) : null,
    isActive: true,
    syncStatus: 'pending',
    createdAt: new Date(now),
    updatedAt: new Date(now),
  });

  const product = await getProductById(id);
  if (!product) throw new Error('Failed to create product');
  return product;
}

export async function updateProduct(id: string, data: Partial<{
  name: string;
  sku: string;
  barcode: string;
  categoryId: string;
  price: number;
  cost: number;
  taxRate: number;
  stockQuantity: number;
  lowStockThreshold: number;
  unit: string;
  images: string[];
}>): Promise<Product> {
  const db = await getDatabase();
  const updateData: any = {
    updatedAt: new Date(),
    syncStatus: 'pending',
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.sku !== undefined) updateData.sku = data.sku;
  if (data.barcode !== undefined) updateData.barcode = data.barcode || null;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (data.price !== undefined) updateData.price = data.price;
  if (data.cost !== undefined) updateData.cost = data.cost;
  if (data.taxRate !== undefined) updateData.taxRate = data.taxRate;
  if (data.stockQuantity !== undefined) updateData.stockQuantity = data.stockQuantity;
  if (data.lowStockThreshold !== undefined) updateData.lowStockThreshold = data.lowStockThreshold;
  if (data.unit !== undefined) updateData.unit = data.unit;
  if (data.images !== undefined) updateData.images = JSON.stringify(data.images);

  await db.update(products).set(updateData).where(eq(products.id, id));

  const product = await getProductById(id);
  if (!product) throw new Error('Failed to update product');
  return product;
}

export async function deleteProduct(id: string): Promise<void> {
  const db = await getDatabase();
  await db.update(products)
    .set({ isActive: false, syncStatus: 'pending', updatedAt: new Date() })
    .where(eq(products.id, id));
}

// Categories helpers
export async function getAllCategories(): Promise<Category[]> {
  const db = await getDatabase();
  const results = await db.select().from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.name));
  return results.map(categoryFromDb);
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const db = await getDatabase();
  const result = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return result.length > 0 ? categoryFromDb(result[0]) : null;
}

// Orders helpers
export async function getAllOrders(filters?: {
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}): Promise<Order[]> {
  const db = await getDatabase();
  
  const conditions = [];
  
  if (filters?.status) {
    conditions.push(eq(orders.status, filters.status));
  }

  if (filters?.dateFrom) {
    conditions.push(gte(orders.createdAt, filters.dateFrom));
  }

  if (filters?.dateTo) {
    conditions.push(lte(orders.createdAt, filters.dateTo));
  }

  if (filters?.search) {
    conditions.push(
      or(
        like(orders.orderNumber, `%${filters.search}%`),
        like(orders.customerId || sql`''`, `%${filters.search}%`)
      )!
    );
  }

  let results;
  if (conditions.length > 0) {
    results = await db.select().from(orders)
      .where(and(...conditions))
      .orderBy(desc(orders.createdAt));
  } else {
    results = await db.select().from(orders)
      .orderBy(desc(orders.createdAt));
  }

  return results.map(orderFromDb);
}

export async function getOrderById(id: string): Promise<Order | null> {
  const db = await getDatabase();
  const result = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return result.length > 0 ? orderFromDb(result[0]) : null;
}

export async function createOrder(data: {
  orderNumber: string;
  cashierId: string;
  customerId?: string;
  items: string; // JSON string
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  payments: string; // JSON string
  status: string;
  customNote?: string;
}): Promise<Order> {
  const db = await getDatabase();
  const id = await generateId();
  const now = Date.now();

  await db.insert(orders).values({
    id,
    orderNumber: data.orderNumber,
    cashierId: data.cashierId,
    customerId: data.customerId || null,
    items: data.items,
    subtotal: data.subtotal,
    taxAmount: data.taxAmount,
    discountAmount: data.discountAmount,
    total: data.total,
    payments: data.payments,
    status: data.status,
    customNote: data.customNote || null,
    syncStatus: 'pending',
    createdAt: new Date(now),
    completedAt: data.status === 'completed' ? new Date(now) : null,
  });

  const order = await getOrderById(id);
  if (!order) throw new Error('Failed to create order');
  return order;
}

export async function updateOrder(id: string, data: Partial<{
  status: string;
  completedAt: Date;
}>): Promise<Order> {
  const db = await getDatabase();
  const updateData: any = {
    syncStatus: 'pending',
  };

  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === 'completed' && !data.completedAt) {
      updateData.completedAt = new Date();
    }
  }
  if (data.completedAt !== undefined) updateData.completedAt = data.completedAt;

  await db.update(orders).set(updateData).where(eq(orders.id, id));

  const order = await getOrderById(id);
  if (!order) throw new Error('Failed to update order');
  return order;
}

// Sync queue helpers
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const db = await getDatabase();
  const results = await db.select().from(syncQueue)
    .where(eq(syncQueue.status, 'pending'))
    .orderBy(asc(syncQueue.timestamp));
  return results.map(syncQueueFromDb);
}

export async function createSyncQueueItem(data: {
  operation: 'create' | 'update' | 'delete';
  collection: string;
  documentId: string;
  data: any;
}): Promise<SyncQueueItem> {
  const db = await getDatabase();
  const id = await generateId();

  await db.insert(syncQueue).values({
    id,
    operation: data.operation,
    collection: data.collection,
    documentId: data.documentId,
    data: JSON.stringify(data.data),
    status: 'pending',
    retryCount: 0,
    timestamp: new Date(),
  });

  const result = await db.select().from(syncQueue).where(eq(syncQueue.id, id)).limit(1);
  if (result.length === 0) throw new Error('Failed to create sync queue item');
  return syncQueueFromDb(result[0]);
}

export async function updateSyncQueueItem(id: string, data: Partial<{
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  retryCount: number;
  errorMessage: string;
}>): Promise<void> {
  const db = await getDatabase();
  const updateData: any = {};
  
  if (data.status !== undefined) updateData.status = data.status;
  if (data.retryCount !== undefined) updateData.retryCount = data.retryCount;
  if (data.errorMessage !== undefined) updateData.errorMessage = data.errorMessage || null;

  await db.update(syncQueue).set(updateData).where(eq(syncQueue.id, id));
}

export async function deleteSyncQueueItem(id: string): Promise<void> {
  const db = await getDatabase();
  await db.delete(syncQueue).where(eq(syncQueue.id, id));
}

