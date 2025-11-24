import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Products table
export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sku: text('sku').notNull(),
  barcode: text('barcode'),
  categoryId: text('category_id').notNull(),
  price: real('price').notNull(),
  cost: real('cost').notNull(),
  taxRate: real('tax_rate').notNull().default(0),
  stockQuantity: integer('stock_quantity').notNull().default(0),
  lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
  unit: text('unit').notNull().default('pcs'),
  images: text('images'), // JSON string of image URLs
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  syncStatus: text('sync_status').notNull().default('pending'), // 'synced', 'pending', 'failed'
  lastSyncedAt: integer('last_synced_at'),
  serverId: text('server_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Categories table
export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  syncStatus: text('sync_status').notNull().default('pending'),
  lastSyncedAt: integer('last_synced_at'),
  serverId: text('server_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Orders table
export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  cashierId: text('cashier_id').notNull(),
  customerId: text('customer_id'),
  items: text('items').notNull(), // JSON string of order items
  subtotal: real('subtotal').notNull(),
  taxAmount: real('tax_amount').notNull().default(0),
  discountAmount: real('discount_amount').notNull().default(0),
  total: real('total').notNull(),
  payments: text('payments').notNull(), // JSON string of payment methods
  status: text('status').notNull().default('pending'), // 'pending', 'completed', 'cancelled', 'refunded'
  customNote: text('custom_note'),
  syncStatus: text('sync_status').notNull().default('pending'),
  lastSyncedAt: integer('last_synced_at'),
  serverId: text('server_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});

// Sync queue table
export const syncQueue = sqliteTable('sync_queue', {
  id: text('id').primaryKey(),
  operation: text('operation').notNull(), // 'create', 'update', 'delete'
  collection: text('collection').notNull(), // 'products', 'categories', 'orders'
  documentId: text('document_id').notNull(),
  data: text('data').notNull(), // JSON string of data to sync
  status: text('status').notNull().default('pending'), // 'pending', 'syncing', 'completed', 'failed'
  retryCount: integer('retry_count').notNull().default(0),
  errorMessage: text('error_message'),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});
