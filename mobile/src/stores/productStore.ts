import { create } from 'zustand';
import * as dbHelpers from '../database/db-helpers';
import { Product, Category } from '../database/types';
import syncService from '../services/syncService';

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
  // Category actions
  createCategory: (data: { name: string; description?: string }) => Promise<Category>;
  updateCategory: (id: string, data: { name?: string; description?: string }) => Promise<Category>;
  deleteCategory: (id: string) => Promise<void>;
}

// Sync service is imported as singleton

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
      const products = await dbHelpers.getAllProducts(filters);
      set({
        products,
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
    set({ isLoading: true });
    try {
      const categories = await dbHelpers.getAllCategories();
      console.log('[PRODUCT_STORE] Loaded categories:', categories.length);
      set({ categories, isLoading: false });
    } catch (error) {
      console.error('[PRODUCT_STORE] Error loading categories:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to load categories',
        categories: [],
        isLoading: false,
      });
    }
  },

  searchProducts: async (query: string) => {
    set({ isLoading: true, error: null });

    try {
      const products = await dbHelpers.getAllProducts({ search: query });
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
      return await dbHelpers.searchProductsByBarcode(barcode);
    } catch (error) {
      console.error('Error searching products by barcode:', error);
      return [];
    }
  },

  getProductById: async (id: string) => {
    try {
      return await dbHelpers.getProductById(id);
    } catch (error) {
      console.error('Error getting product:', error);
      return null;
    }
  },

  createProduct: async (data: any) => {
    set({ isLoading: true, error: null });

    try {
      const product = await dbHelpers.createProduct({
        name: data.name,
        sku: data.sku,
        barcode: data.barcode,
        categoryId: data.categoryId,
        price: data.price,
        cost: data.cost,
        taxRate: data.taxRate || 0,
        stockQuantity: data.stockQuantity || 0,
        lowStockThreshold: data.lowStockThreshold || 5,
        unit: data.unit || 'pcs',
        images: data.images,
      });

      // Add to sync queue
      await syncService.addToSyncQueue('create', 'products', product.id, data);

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
      await dbHelpers.updateProduct(id, {
        name: data.name,
        sku: data.sku,
        barcode: data.barcode,
        categoryId: data.categoryId,
        price: data.price,
        cost: data.cost,
        taxRate: data.taxRate,
        stockQuantity: data.stockQuantity,
        lowStockThreshold: data.lowStockThreshold,
        unit: data.unit,
        images: data.images,
      });

      // Add to sync queue
      await syncService.addToSyncQueue('update', 'products', id, data);

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
      await dbHelpers.deleteProduct(id);

      // Add to sync queue
      await syncService.addToSyncQueue('delete', 'products', id, {});

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
      await dbHelpers.updateProduct(id, { stockQuantity });

      // Add to sync queue
      await syncService.addToSyncQueue('update', 'products', id, {
        stockQuantity,
        reason,
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
      // Use the centralized sync store which will update UI state
      const { syncAll } = await import('./syncStore').then(m => m.useSyncStore.getState());
      await syncAll();

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

  createCategory: async (data) => {
    try {
      const category = await dbHelpers.createCategory(data);
      await syncService.addToSyncQueue('create', 'categories', category.id, {
        name: data.name,
        description: data.description,
      });
      await get().loadCategories();
      return category;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create category' });
      throw error;
    }
  },

  updateCategory: async (id, data) => {
    try {
      const category = await dbHelpers.updateCategory(id, data);
      await syncService.addToSyncQueue('update', 'categories', id, data);
      await get().loadCategories();
      return category;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to update category' });
      throw error;
    }
  },

  deleteCategory: async (id) => {
    try {
      await dbHelpers.deleteCategory(id);
      await syncService.addToSyncQueue('delete', 'categories', id, {});
      await get().loadCategories();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete category' });
      throw error;
    }
  },
}));
