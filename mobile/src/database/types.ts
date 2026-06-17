// Type definitions for database entities

export interface ProductItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  subtotal: number;
}

export interface PaymentMethod {
  method: 'cash' | 'card' | 'mobile_money';
  amount: number;
  reference?: string;
}

export type SyncOperation = 'create' | 'update' | 'delete';
export type SyncStatus = 'pending' | 'syncing' | 'completed' | 'failed';

// Product type
export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  categoryId: string;
  price: number;
  cost: number;
  taxRate: number;
  stockQuantity: number;
  lowStockThreshold: number;
  unit: string;
  images?: string | null;
  isActive: boolean;
  syncStatus: string;
  lastSyncedAt?: number | null;
  serverId?: string | null;
  syncVersion?: number | null;
  createdAt: Date;
  updatedAt: Date;

  // Computed properties (not in DB)
  isLowStock?: boolean;
  profitMargin?: number;
  imageUrls?: string[];
}

// Category type
export interface Category {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  syncStatus: string;
  lastSyncedAt?: number | null;
  serverId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Order type
export interface Order {
  id: string;
  orderNumber: string;
  cashierId: string;
  customerId?: string | null;
  items: string; // JSON string
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  payments: string; // JSON string
  status: string;
  customNote?: string | null;
  syncStatus: string;
  lastSyncedAt?: number | null;
  serverId?: string | null;
  createdAt: Date;
  completedAt?: Date | null;

  // Computed properties (not in DB)
  orderItems?: ProductItem[];
  paymentMethods?: PaymentMethod[];
  isCompleted?: boolean;
  isPending?: boolean;
  isCancelled?: boolean;
}

// Local customer (DB row); map to store Customer with _id = serverId || id
export interface LocalCustomer {
  id: string;
  name: string;
  email?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
  totalSpent: number;
  totalOrders: number;
  lastVisit?: Date | null;
  notes?: string | null;
  loyaltyPoints: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  isActive: boolean;
  syncStatus: string;
  lastSyncedAt?: number | null;
  serverId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// SyncQueue type
export interface SyncQueueItem {
  id: string;
  operation: SyncOperation;
  collection: string;
  documentId: string;
  data: string; // JSON string
  status: SyncStatus;
  retryCount: number;
  errorMessage?: string | null;
  timestamp: Date;
  deviceId?: string | null;

  // Computed properties (not in DB)
  syncData?: any;
  isPending?: boolean;
  isSyncing?: boolean;
  isCompleted?: boolean;
  isFailed?: boolean;
  canRetry?: boolean;
}

// Helper functions to convert between DB and app types
export function productFromDb(row: any): Product {
  const product: Product = {
    id: row.id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode,
    categoryId: row.categoryId || row.category_id,
    price: row.price,
    cost: row.cost,
    taxRate: row.taxRate ?? row.tax_rate,
    stockQuantity: row.stockQuantity ?? row.stock_quantity,
    lowStockThreshold: row.lowStockThreshold ?? row.low_stock_threshold,
    unit: row.unit,
    images: row.images,
    isActive: Boolean(row.isActive ?? row.is_active),
    syncStatus: row.syncStatus || row.sync_status,
    lastSyncedAt: row.lastSyncedAt ?? row.last_synced_at,
    serverId: row.serverId || row.server_id,
    syncVersion: row.syncVersion ?? row.sync_version ?? null,
    createdAt: new Date(row.createdAt || row.created_at),
    updatedAt: new Date(row.updatedAt || row.updated_at),
  };

  // Add computed properties
  product.isLowStock = product.stockQuantity <= product.lowStockThreshold;
  product.profitMargin = product.cost === 0 ? 0 : ((product.price - product.cost) / product.cost) * 100;
  product.imageUrls = product.images ? (() => {
    try {
      return JSON.parse(product.images);
    } catch {
      return [];
    }
  })() : [];

  return product;
}

export function categoryFromDb(row: any): Category {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: Boolean(row.isActive ?? row.is_active),
    syncStatus: row.syncStatus || row.sync_status,
    lastSyncedAt: row.lastSyncedAt ?? row.last_synced_at,
    serverId: row.serverId || row.server_id,
    createdAt: new Date(row.createdAt || row.created_at),
    updatedAt: new Date(row.updatedAt || row.updated_at),
  };
}

export function orderFromDb(row: any): Order {
  const order: Order = {
    id: row.id,
    orderNumber: row.orderNumber || row.order_number,
    cashierId: row.cashierId || row.cashier_id,
    customerId: row.customerId || row.customer_id,
    items: row.items,
    subtotal: row.subtotal,
    taxAmount: row.taxAmount ?? row.tax_amount,
    discountAmount: row.discountAmount ?? row.discount_amount,
    total: row.total,
    payments: row.payments,
    status: row.status,
    customNote: row.customNote || row.custom_note,
    syncStatus: row.syncStatus || row.sync_status,
    lastSyncedAt: row.lastSyncedAt ?? row.last_synced_at,
    serverId: row.serverId || row.server_id,
    createdAt: new Date(row.createdAt || row.created_at),
    completedAt: (row.completedAt || row.completed_at) ? new Date(row.completedAt || row.completed_at) : undefined,
  };

  // Add computed properties
  order.orderItems = (() => {
    try {
      return JSON.parse(order.items);
    } catch {
      return [];
    }
  })();

  order.paymentMethods = (() => {
    try {
      return JSON.parse(order.payments);
    } catch {
      return [];
    }
  })();

  order.isCompleted = order.status === 'completed';
  order.isPending = order.status === 'pending';
  order.isCancelled = order.status === 'cancelled';

  return order;
}

export function customerFromDb(row: any): LocalCustomer {
  return {
    id: row.id,
    name: row.name,
    email: row.email ?? null,
    phoneNumber: row.phoneNumber ?? row.phone_number ?? null,
    address: row.address ?? null,
    totalSpent: row.totalSpent ?? row.total_spent ?? 0,
    totalOrders: row.totalOrders ?? row.total_orders ?? 0,
    lastVisit: (row.lastVisit ?? row.last_visit) != null ? new Date(row.lastVisit ?? row.last_visit) : null,
    notes: row.notes ?? null,
    loyaltyPoints: row.loyaltyPoints ?? row.loyalty_points ?? 0,
    tier: (row.tier ?? 'bronze') as LocalCustomer['tier'],
    isActive: Boolean(row.isActive ?? row.is_active),
    syncStatus: row.syncStatus ?? row.sync_status ?? 'pending',
    lastSyncedAt: row.lastSyncedAt ?? row.last_synced_at ?? null,
    serverId: row.serverId ?? row.server_id ?? null,
    createdAt: new Date(row.createdAt || row.created_at),
    updatedAt: new Date(row.updatedAt || row.updated_at),
  };
}

/** Map LocalCustomer to store Customer shape (with _id for API compatibility) */
export function localCustomerToStoreCustomer(local: LocalCustomer): {
  _id: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  address?: { street: string; city: string; country: string; postalCode: string };
  totalSpent: number;
  totalOrders: number;
  lastVisit?: string;
  notes?: string;
  loyaltyPoints: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
} {
  let address: { street: string; city: string; country: string; postalCode: string } | undefined;
  if (local.address) {
    try {
      const a = JSON.parse(local.address);
      if (a && (a.street || a.city || a.country || a.postalCode)) {
        address = {
          street: a.street || '',
          city: a.city || '',
          country: a.country || '',
          postalCode: a.postalCode || '',
        };
      }
    } catch {
      // ignore
    }
  }
  return {
    _id: local.serverId || local.id,
    name: local.name,
    email: local.email || undefined,
    phoneNumber: local.phoneNumber || undefined,
    address,
    totalSpent: local.totalSpent,
    totalOrders: local.totalOrders,
    lastVisit: local.lastVisit?.toISOString(),
    notes: local.notes || undefined,
    loyaltyPoints: local.loyaltyPoints,
    tier: local.tier,
    isActive: local.isActive,
    createdAt: local.createdAt.toISOString(),
    updatedAt: local.updatedAt.toISOString(),
  };
}

export function syncQueueFromDb(row: any): SyncQueueItem {
  const item: SyncQueueItem = {
    id: row.id,
    operation: row.operation,
    collection: row.collection,
    documentId: row.documentId || row.document_id,
    data: row.data,
    status: row.status,
    retryCount: row.retryCount ?? row.retry_count,
    errorMessage: row.errorMessage || row.error_message,
    timestamp: new Date(row.timestamp),
    deviceId: row.deviceId ?? row.device_id ?? null,
  };

  // Add computed properties
  item.syncData = (() => {
    try {
      return JSON.parse(item.data);
    } catch {
      return null;
    }
  })();

  item.isPending = item.status === 'pending';
  item.isSyncing = item.status === 'syncing';
  item.isCompleted = item.status === 'completed';
  item.isFailed = item.status === 'failed';
  item.canRetry = item.isFailed && item.retryCount < 3;

  return item;
}

