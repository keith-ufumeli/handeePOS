import { create } from 'zustand';
import database from '../database';
import Product from '../database/models/Product';
import Category from '../database/models/Category';
import { Q } from '@nozbe/watermelondb';
import SyncService from '../services/syncService';
import { API_CONFIG } from '../config/api';

export interface ProductFilters {
  search?: string;
  category?: string;
  lowStock?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ProductState {
  products: Product[];
  categories: Category[];
  isLoading: boolean;
  error: string | null;
  filters: ProductFilters;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  
  // Actions
  loadProducts: (filters?: ProductFilters) => Promise<void>;
  loadCategories: () => Promise<void>;
  searchProducts: (query: string) => Promise<void>;
  searchProductsByBarcode: (barcode: string) => Promise<Product[]>;
  getProductById: (id: string) => Promise<Product | null>;
  createProduct: (data: any) => Promise<void>;
  updateProduct: (id: string, data: any) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  updateStock: (id: string, stockQuantity: number, reason?: string) => Promise<void>;
  syncProducts: () => Promise<void>;
  setFilters: (filters: ProductFilters) => void;
  clearError: () => void;
}

// Create sync service instance
const syncService = new SyncService(API_CONFIG.BASE_URL);

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  categories: [],
  isLoading: false,
  error: null,
  filters: {},
  pagination: {
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  },

  loadProducts: async (filters = {}) => {
    set({ isLoading: true, error: null });
    
    try {
      const { search, category, lowStock, sortBy = 'name', sortOrder = 'asc' } = filters;
      
      // Build query
      let query = database.collections.get<Product>('products').query(
        Q.where('is_active', true)
      );

      // Apply filters
      if (search) {
        query = query.extend(
          Q.or(
            Q.where('name', Q.like(`%${search}%`)),
            Q.where('sku', Q.like(`%${search}%`)),
            Q.where('barcode', search)
          )
        );
      }

      if (category) {
        query = query.extend(Q.where('category_id', category));
      }

      if (lowStock) {
        // This would need a custom query for low stock
        // For now, we'll filter in memory
      }

      // Apply sorting
      const sortField = sortBy === 'name' ? 'name' : 'created_at';
      const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc';
      query = query.extend(Q.sortBy(sortField, sortDirection));

      const products = await query.fetch();
      
      // Filter low stock in memory if needed
      const filteredProducts = lowStock 
        ? products.filter(product => product.isLowStock)
        : products;

      set({
        products: filteredProducts,
        isLoading: false,
        filters,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load products',
        isLoading: false,
      });
    }
  },

  loadCategories: async () => {
    try {
      const categories = await database.collections
        .get<Category>('categories')
        .query(
          Q.where('is_active', true),
          Q.sortBy('name', 'asc')
        )
        .fetch();

      set({ categories });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load categories',
      });
    }
  },

  searchProducts: async (query: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const products = await database.collections
        .get<Product>('products')
        .query(
          Q.where('is_active', true),
          Q.or(
            Q.where('name', Q.like(`%${query}%`)),
            Q.where('sku', Q.like(`%${query}%`)),
            Q.where('barcode', query)
          ),
          Q.sortBy('name', 'asc')
        )
        .fetch();

      set({
        products,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Search failed',
        isLoading: false,
      });
    }
  },

  searchProductsByBarcode: async (barcode: string) => {
    try {
      const products = await database.collections
        .get<Product>('products')
        .query(
          Q.where('is_active', true),
          Q.where('barcode', barcode)
        )
        .fetch();

      return products;
    } catch (error) {
      console.error('Error searching products by barcode:', error);
      return [];
    }
  },

  getProductById: async (id: string) => {
    try {
      const products = await database.collections
        .get<Product>('products')
        .query(Q.where('id', id))
        .fetch();

      return products.length > 0 ? products[0] : null;
    } catch (error) {
      console.error('Error getting product:', error);
      return null;
    }
  },

  createProduct: async (data: any) => {
    set({ isLoading: true, error: null });
    
    try {
      // Create product locally
      await database.write(async () => {
        const product = await database.collections.get<Product>('products').create((record) => {
          record.name = data.name;
          record.sku = data.sku;
          record.barcode = data.barcode;
          record.categoryId = data.categoryId;
          record.price = data.price;
          record.cost = data.cost;
          record.taxRate = data.taxRate || 0;
          record.stockQuantity = data.stockQuantity || 0;
          record.lowStockThreshold = data.lowStockThreshold || 5;
          record.unit = data.unit || 'pcs';
          record.images = data.images ? JSON.stringify(data.images) : undefined;
          record.isActive = true;
          record.syncStatusValue = 'pending';
        });

        // Add to sync queue
        await syncService.addToSyncQueue('create', 'products', product.id, data);
      });

      // Reload products
      await get().loadProducts(get().filters);
      
      set({ isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create product',
        isLoading: false,
      });
    }
  },

  updateProduct: async (id: string, data: any) => {
    set({ isLoading: true, error: null });
    
    try {
      await database.write(async () => {
        const product = await database.collections
          .get<Product>('products')
          .find(id);

        await product.update((record) => {
          record.name = data.name;
          record.sku = data.sku;
          record.barcode = data.barcode;
          record.categoryId = data.categoryId;
          record.price = data.price;
          record.cost = data.cost;
          record.taxRate = data.taxRate;
          record.stockQuantity = data.stockQuantity;
          record.lowStockThreshold = data.lowStockThreshold;
          record.unit = data.unit;
          record.images = data.images ? JSON.stringify(data.images) : undefined;
          record.syncStatusValue = 'pending';
        });

        // Add to sync queue
        await syncService.addToSyncQueue('update', 'products', id, data);
      });

      // Reload products
      await get().loadProducts(get().filters);
      
      set({ isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update product',
        isLoading: false,
      });
    }
  },

  deleteProduct: async (id: string) => {
    set({ isLoading: true, error: null });
    
    try {
      await database.write(async () => {
        const product = await database.collections
          .get<Product>('products')
          .find(id);

        await product.update((record) => {
          record.isActive = false;
          record.syncStatusValue = 'pending';
        });

        // Add to sync queue
        await syncService.addToSyncQueue('delete', 'products', id, {});
      });

      // Reload products
      await get().loadProducts(get().filters);
      
      set({ isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete product',
        isLoading: false,
      });
    }
  },

  updateStock: async (id: string, stockQuantity: number, reason?: string) => {
    set({ isLoading: true, error: null });
    
    try {
      await database.write(async () => {
        const product = await database.collections
          .get<Product>('products')
          .find(id);

        await product.update((record) => {
          record.stockQuantity = stockQuantity;
          record.syncStatusValue = 'pending';
        });

        // Add to sync queue
        await syncService.addToSyncQueue('update', 'products', id, {
          stockQuantity,
          reason,
        });
      });

      // Reload products
      await get().loadProducts(get().filters);
      
      set({ isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to update stock',
        isLoading: false,
      });
    }
  },

  syncProducts: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const result = await syncService.syncAll();
      
      if (result.success) {
        // Reload products after sync
        await get().loadProducts(get().filters);
        await get().loadCategories();
      } else {
        set({
          error: `Sync failed: ${result.errors.join(', ')}`,
        });
      }
      
      set({ isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Sync failed',
        isLoading: false,
      });
    }
  },

  setFilters: (filters: ProductFilters) => {
    set({ filters });
  },

  clearError: () => {
    set({ error: null });
  },
}));
