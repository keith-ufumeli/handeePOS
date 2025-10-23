// Common types used throughout the application

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface User {
  _id: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  role: 'admin' | 'manager' | 'cashier' | 'inventory';
  stores: StoreAccess[];
  currentStoreId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

export interface StoreAccess {
  storeId: string;
  role: string;
  permissions: string[];
}

export interface Store {
  _id: string;
  businessId: string;
  name: string;
  address: {
    street: string;
    city: string;
    country: string;
    postalCode: string;
  };
  phoneNumber?: string;
  email?: string;
  taxId?: string;
  currency: string;
  timezone: string;
  logo?: string;
  receiptSettings: {
    header: string;
    footer: string;
    showLogo: boolean;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  _id: string;
  storeId: string;
  name: string;
  sku: string;
  barcode?: string;
  description?: string;
  categoryId?: string;
  price: number;
  cost: number;
  taxRate: number;
  variants?: ProductVariant[];
  stockQuantity: number;
  lowStockThreshold: number;
  unit: string;
  images: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  syncVersion: number;
}

export interface ProductVariant {
  name: string;
  price: number;
  sku: string;
  barcode?: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  storeId: string;
  cashierId: string;
  customerId?: string;
  items: OrderItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  payments: Payment[];
  status: 'completed' | 'pending' | 'refunded';
  customNote?: string;
  createdAt: Date;
  completedAt?: Date;
  syncStatus: 'synced' | 'pending';
  deviceId?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  subtotal: number;
}

export interface Payment {
  method: 'cash' | 'card' | 'mobile_money' | 'other';
  amount: number;
  reference?: string;
}

export interface Customer {
  _id: string;
  storeId: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  loyaltyPoints: number;
  storeCredit: number;
  totalSpent: number;
  totalOrders: number;
  lastVisit?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryAdjustment {
  _id: string;
  storeId: string;
  productId: string;
  previousQuantity: number;
  newQuantity: number;
  adjustmentQuantity: number;
  reason: 'restock' | 'damage' | 'count' | 'return';
  notes?: string;
  performedBy: string;
  createdAt: Date;
}

export interface SyncQueue {
  _id: string;
  deviceId: string;
  operation: 'create' | 'update' | 'delete';
  collection: string;
  documentId: string;
  data: any;
  timestamp: Date;
  status: 'pending' | 'synced' | 'failed';
  retryCount: number;
  error?: string;
}

// JWT Token payload
export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  storeId?: string;
  permissions: string[];
  iat: number;
  exp: number;
}

// Request extensions
export interface AuthenticatedRequest extends Request {
  user?: User;
  token?: TokenPayload;
}

// Error types
export interface AppError extends Error {
  statusCode: number;
  isOperational: boolean;
}
