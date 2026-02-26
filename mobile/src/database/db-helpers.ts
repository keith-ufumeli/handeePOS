import { eq, and, or, like, gte, lte, lt, desc, asc, sql } from 'drizzle-orm';
import { getDatabase, generateId } from './index';
import { products, categories, orders, customers, syncQueue } from './schema';
import { Product, Category, Order, LocalCustomer, SyncQueueItem, productFromDb, categoryFromDb, orderFromDb, customerFromDb, syncQueueFromDb } from './types';

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

/**
 * Decrement product stock by quantity (e.g. after local sale). Throws if product not found or insufficient stock.
 */
export async function decrementProductStock(productId: string, quantity: number): Promise<void> {
  if (quantity <= 0) return;
  const product = await getProductById(productId);
  if (!product) throw new Error(`Product ${productId} not found`);
  if (product.stockQuantity < quantity) {
    throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stockQuantity}, requested: ${quantity}`);
  }
  const db = await getDatabase();
  const newStock = Math.max(0, product.stockQuantity - quantity);
  await db.update(products)
    .set({ stockQuantity: newStock, updatedAt: new Date(), syncStatus: 'pending' })
    .where(eq(products.id, productId));
}

// Categories helpers
export async function getAllCategories(): Promise<Category[]> {
  const db = await getDatabase();
  const results = await db.select().from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.name));
  
  console.log('[DB_HELPERS] getAllCategories: Found', results.length, 'active categories');
  if (results.length === 0) {
    // Check if there are any categories at all (including inactive)
    const allCategories = await db.select().from(categories);
    console.log('[DB_HELPERS] Total categories in database:', allCategories.length);
  }
  
  return results.map(categoryFromDb);
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const db = await getDatabase();
  const result = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return result.length > 0 ? categoryFromDb(result[0]) : null;
}

// Customers helpers
export async function getAllCustomers(filters?: { search?: string }): Promise<LocalCustomer[]> {
  const db = await getDatabase();
  const conditions = [eq(customers.isActive, true)];
  if (filters?.search?.trim()) {
    conditions.push(
      or(
        like(customers.name, `%${filters.search}%`),
        like(customers.email ?? sql`''`, `%${filters.search}%`),
        like(customers.phoneNumber ?? sql`''`, `%${filters.search}%`)
      )!
    );
  }
  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];
  const results = await db.select().from(customers).where(whereClause).orderBy(asc(customers.name));
  return results.map((r: any) => customerFromDb(r));
}

export async function getCustomerById(id: string): Promise<LocalCustomer | null> {
  const db = await getDatabase();
  const result = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return result.length > 0 ? customerFromDb(result[0] as any) : null;
}

export async function getCustomerByServerId(serverId: string): Promise<LocalCustomer | null> {
  const db = await getDatabase();
  const result = await db.select().from(customers).where(eq(customers.serverId, serverId)).limit(1);
  return result.length > 0 ? customerFromDb(result[0] as any) : null;
}

export async function createCustomer(data: {
  name: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  notes?: string;
}): Promise<LocalCustomer> {
  const db = await getDatabase();
  const id = await generateId();
  const now = Date.now();
  await db.insert(customers).values({
    id,
    name: data.name,
    email: data.email ?? null,
    phoneNumber: data.phoneNumber ?? null,
    address: data.address ?? null,
    notes: data.notes ?? null,
    totalSpent: 0,
    totalOrders: 0,
    loyaltyPoints: 0,
    tier: 'bronze',
    isActive: true,
    syncStatus: 'pending',
    createdAt: new Date(now),
    updatedAt: new Date(now),
  });
  const customer = await getCustomerById(id);
  if (!customer) throw new Error('Failed to create customer');
  return customer;
}

export async function updateCustomer(id: string, data: Partial<{
  name: string;
  email: string;
  phoneNumber: string;
  address: string;
  notes: string;
}>): Promise<LocalCustomer> {
  const db = await getDatabase();
  const updateData: any = { updatedAt: new Date(), syncStatus: 'pending' };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email ?? null;
  if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber ?? null;
  if (data.address !== undefined) updateData.address = data.address ?? null;
  if (data.notes !== undefined) updateData.notes = data.notes ?? null;
  await db.update(customers).set(updateData).where(eq(customers.id, id));
  const customer = await getCustomerById(id);
  if (!customer) throw new Error('Failed to update customer');
  return customer;
}

export async function deleteCustomer(id: string): Promise<void> {
  const db = await getDatabase();
  await db.update(customers).set({ isActive: false, syncStatus: 'pending', updatedAt: new Date() }).where(eq(customers.id, id));
}

export async function upsertCustomersFromServer(serverCustomers: Array<{
  _id: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  address?: { street?: string; city?: string; country?: string; postalCode?: string };
  totalSpent?: number;
  totalOrders?: number;
  lastVisit?: string | Date;
  notes?: string;
  loyaltyPoints?: number;
  tier?: string;
  isActive?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}>): Promise<void> {
  const db = await getDatabase();
  for (const c of serverCustomers) {
    const serverId = String(c._id);
    const existing = await getCustomerByServerId(serverId);
    const addressStr = c.address ? JSON.stringify(c.address) : null;
    const now = Date.now();
    if (existing) {
      await db.update(customers).set({
        name: c.name,
        email: c.email ?? null,
        phoneNumber: c.phoneNumber ?? null,
        address: addressStr,
        totalSpent: c.totalSpent ?? 0,
        totalOrders: c.totalOrders ?? 0,
        lastVisit: c.lastVisit ? new Date(c.lastVisit) : null,
        notes: c.notes ?? null,
        loyaltyPoints: c.loyaltyPoints ?? 0,
        tier: (c.tier as any) ?? 'bronze',
        isActive: c.isActive !== false,
        syncStatus: 'synced',
        lastSyncedAt: now,
        updatedAt: new Date(now),
      }).where(eq(customers.id, existing.id));
    } else {
      const id = await generateId();
      await db.insert(customers).values({
        id,
        name: c.name,
        email: c.email ?? null,
        phoneNumber: c.phoneNumber ?? null,
        address: addressStr,
        totalSpent: c.totalSpent ?? 0,
        totalOrders: c.totalOrders ?? 0,
        lastVisit: c.lastVisit ? new Date(c.lastVisit) : null,
        notes: c.notes ?? null,
        loyaltyPoints: c.loyaltyPoints ?? 0,
        tier: (c.tier as any) ?? 'bronze',
        isActive: c.isActive !== false,
        syncStatus: 'synced',
        lastSyncedAt: now,
        serverId,
        createdAt: new Date(now),
        updatedAt: new Date(now),
      });
    }
  }
}

export async function updateCustomerSyncResult(
  localCustomerId: string,
  result: { serverId: string; syncStatus?: string; lastSyncedAt?: number }
): Promise<void> {
  const db = await getDatabase();
  await db.update(customers).set({
    serverId: result.serverId,
    syncStatus: result.syncStatus ?? 'synced',
    lastSyncedAt: result.lastSyncedAt ?? Date.now(),
    updatedAt: new Date(),
  }).where(eq(customers.id, localCustomerId));
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

/**
 * Create order, decrement stock for each item, and add sync queue entry in a single transaction.
 * Note: expo-sqlite driver may have limited rollback behavior; this still improves atomicity when supported.
 */
export async function createOrderWithStockAndSyncQueue(
  orderData: {
    orderNumber: string;
    cashierId: string;
    customerId?: string;
    items: string;
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    total: number;
    payments: string;
    status: string;
    customNote?: string;
  },
  items: { productId: string; quantity: number }[],
  syncQueueData: Record<string, unknown>
): Promise<Order> {
  const db = await getDatabase();
  const id = await generateId();
  const queueId = await generateId();
  const now = Date.now();

  const runInTx = async (tx: any) => {
    await tx.insert(orders).values({
      id,
      orderNumber: orderData.orderNumber,
      cashierId: orderData.cashierId,
      customerId: orderData.customerId || null,
      items: orderData.items,
      subtotal: orderData.subtotal,
      taxAmount: orderData.taxAmount,
      discountAmount: orderData.discountAmount,
      total: orderData.total,
      payments: orderData.payments,
      status: orderData.status,
      customNote: orderData.customNote || null,
      syncStatus: 'pending',
      createdAt: new Date(now),
      completedAt: orderData.status === 'completed' ? new Date(now) : null,
    });

    for (const item of items) {
      const rows = await tx.select().from(products).where(eq(products.id, item.productId)).limit(1);
      const row = rows[0];
      if (!row) throw new Error(`Product ${item.productId} not found`);
      const current = row.stockQuantity ?? 0;
      if (current < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.productId}. Available: ${current}`);
      }
      await tx.update(products)
        .set({
          stockQuantity: Math.max(0, current - item.quantity),
          updatedAt: new Date(),
          syncStatus: 'pending',
        })
        .where(eq(products.id, item.productId));
    }

    await tx.insert(syncQueue).values({
      id: queueId,
      operation: 'create',
      collection: 'orders',
      documentId: id,
      data: JSON.stringify(syncQueueData),
      status: 'pending',
      retryCount: 0,
      timestamp: new Date(),
      deviceId: (syncQueueData as { deviceId?: string })?.deviceId ?? null,
    });
  };

  if (typeof db.transaction === 'function') {
    await db.transaction(runInTx);
  } else {
    // Fallback when driver does not support transaction (e.g. some expo-sqlite builds)
    await runInTx(db);
  }

  const order = await getOrderById(id);
  if (!order) throw new Error('Failed to create order');
  return order;
}

/**
 * Update local order after successful sync push (serverId, server orderNumber, sync status).
 */
export async function updateOrderSyncResult(
  localOrderId: string,
  result: { serverId: string; orderNumber?: string; syncStatus?: string; lastSyncedAt?: number }
): Promise<void> {
  const db = await getDatabase();
  const updateData: Record<string, unknown> = {
    serverId: result.serverId,
    syncStatus: result.syncStatus ?? 'synced',
    lastSyncedAt: result.lastSyncedAt ?? Date.now(),
  };
  if (result.orderNumber !== undefined) {
    updateData.orderNumber = result.orderNumber;
  }
  await db.update(orders).set(updateData as any).where(eq(orders.id, localOrderId));
}

// Sync queue helpers

const STALE_SYNCING_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Reset queue items stuck in 'syncing' (e.g. after app crash) to 'pending' so they are retried.
 */
export async function resetStaleSyncingItems(olderThanMs: number = STALE_SYNCING_MS): Promise<number> {
  const db = await getDatabase();
  const threshold = new Date(Date.now() - olderThanMs);
  const rows = await db.update(syncQueue)
    .set({ status: 'pending' })
    .where(and(eq(syncQueue.status, 'syncing'), lt(syncQueue.timestamp, threshold)));
  return rows.changes ?? 0;
}

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
  deviceId?: string | null;
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
    deviceId: data.deviceId ?? null,
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

