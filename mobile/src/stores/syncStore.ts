import { create } from 'zustand';
import apiService from '@/services/apiService';
import { useOrderStore } from './orderStore';
import { useProductStore } from './productStore';
import { useCustomerStore } from './customerStore';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

interface SyncQueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  collection: 'orders' | 'products' | 'customers';
  documentId: string;
  data: any;
  timestamp: number;
  retryCount: number;
}

interface SyncStore {
  syncStatus: SyncStatus;
  pendingCount: number;
  lastSyncTime: string | null;
  syncQueue: SyncQueueItem[];
  error: string | null;
  isOnline: boolean;
  
  // Actions
  setOnlineStatus: (isOnline: boolean) => void;
  addToSyncQueue: (item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>) => void;
  removeFromSyncQueue: (id: string) => void;
  syncNow: () => Promise<void>;
  syncOrders: () => Promise<void>;
  syncProducts: () => Promise<void>;
  syncCustomers: () => Promise<void>;
  clearError: () => void;
  retryFailedItems: () => Promise<void>;
}

export const useSyncStore = create<SyncStore>((set, get) => ({
  syncStatus: 'idle',
  pendingCount: 0,
  lastSyncTime: null,
  syncQueue: [],
  error: null,
  isOnline: true,

  setOnlineStatus: (isOnline: boolean) => {
    set({ isOnline });
    if (isOnline && get().syncQueue.length > 0) {
      get().syncNow();
    }
  },

  addToSyncQueue: (item) => {
    const syncItem: SyncQueueItem = {
      ...item,
      id: `${item.collection}_${item.documentId}_${Date.now()}`,
      timestamp: Date.now(),
      retryCount: 0
    };

    set(state => ({
      syncQueue: [...state.syncQueue, syncItem],
      pendingCount: state.pendingCount + 1
    }));
  },

  removeFromSyncQueue: (id: string) => {
    set(state => ({
      syncQueue: state.syncQueue.filter(item => item.id !== id),
      pendingCount: Math.max(0, state.pendingCount - 1)
    }));
  },

  syncNow: async () => {
    const { syncQueue, isOnline } = get();
    
    if (!isOnline) {
      set({ syncStatus: 'offline' });
      return;
    }

    if (syncQueue.length === 0) {
      set({ syncStatus: 'synced' });
      return;
    }

    set({ syncStatus: 'syncing', error: null });

    try {
      // Sync all pending items
      await Promise.all([
        get().syncOrders(),
        get().syncProducts(),
        get().syncCustomers()
      ]);

      set({ 
        syncStatus: 'synced',
        lastSyncTime: new Date().toISOString(),
        pendingCount: 0
      });
    } catch (error: any) {
      set({ 
        syncStatus: 'error',
        error: error.message || 'Sync failed'
      });
    }
  },

  syncOrders: async () => {
    const { syncQueue } = get();
    const orderItems = syncQueue.filter(item => item.collection === 'orders');
    
    if (orderItems.length === 0) return;

    try {
      // Group by operation type
      const creates = orderItems.filter(item => item.operation === 'create');
      const updates = orderItems.filter(item => item.operation === 'update');
      const deletes = orderItems.filter(item => item.operation === 'delete');

      // Process creates
      for (const item of creates) {
        try {
          await apiService.createOrder(item.data);
          get().removeFromSyncQueue(item.id);
        } catch (error) {
          console.error('Failed to sync order create:', error);
          // Increment retry count
          set(state => ({
            syncQueue: state.syncQueue.map(queueItem =>
              queueItem.id === item.id
                ? { ...queueItem, retryCount: queueItem.retryCount + 1 }
                : queueItem
            )
          }));
        }
      }

      // Process updates
      for (const item of updates) {
        try {
          await apiService.updateOrder(item.documentId, item.data);
          get().removeFromSyncQueue(item.id);
        } catch (error) {
          console.error('Failed to sync order update:', error);
          set(state => ({
            syncQueue: state.syncQueue.map(queueItem =>
              queueItem.id === item.id
                ? { ...queueItem, retryCount: queueItem.retryCount + 1 }
                : queueItem
            )
          }));
        }
      }

      // Process deletes
      for (const item of deletes) {
        try {
          await apiService.deleteOrder(item.documentId);
          get().removeFromSyncQueue(item.id);
        } catch (error) {
          console.error('Failed to sync order delete:', error);
          set(state => ({
            syncQueue: state.syncQueue.map(queueItem =>
              queueItem.id === item.id
                ? { ...queueItem, retryCount: queueItem.retryCount + 1 }
                : queueItem
            )
          }));
        }
      }

      // Refresh local orders
      const orderStore = useOrderStore.getState();
      await orderStore.loadOrders();
    } catch (error) {
      console.error('Order sync failed:', error);
      throw error;
    }
  },

  syncProducts: async () => {
    const { syncQueue } = get();
    const productItems = syncQueue.filter(item => item.collection === 'products');
    
    if (productItems.length === 0) return;

    try {
      // Group by operation type
      const creates = productItems.filter(item => item.operation === 'create');
      const updates = productItems.filter(item => item.operation === 'update');
      const deletes = productItems.filter(item => item.operation === 'delete');

      // Process creates
      for (const item of creates) {
        try {
          await apiService.createProduct(item.data);
          get().removeFromSyncQueue(item.id);
        } catch (error) {
          console.error('Failed to sync product create:', error);
          set(state => ({
            syncQueue: state.syncQueue.map(queueItem =>
              queueItem.id === item.id
                ? { ...queueItem, retryCount: queueItem.retryCount + 1 }
                : queueItem
            )
          }));
        }
      }

      // Process updates
      for (const item of updates) {
        try {
          await apiService.updateProduct(item.documentId, item.data);
          get().removeFromSyncQueue(item.id);
        } catch (error) {
          console.error('Failed to sync product update:', error);
          set(state => ({
            syncQueue: state.syncQueue.map(queueItem =>
              queueItem.id === item.id
                ? { ...queueItem, retryCount: queueItem.retryCount + 1 }
                : queueItem
            )
          }));
        }
      }

      // Process deletes
      for (const item of deletes) {
        try {
          await apiService.deleteProduct(item.documentId);
          get().removeFromSyncQueue(item.id);
        } catch (error) {
          console.error('Failed to sync product delete:', error);
          set(state => ({
            syncQueue: state.syncQueue.map(queueItem =>
              queueItem.id === item.id
                ? { ...queueItem, retryCount: queueItem.retryCount + 1 }
                : queueItem
            )
          }));
        }
      }

      // Refresh local products
      const productStore = useProductStore.getState();
      await productStore.loadProducts();
    } catch (error) {
      console.error('Product sync failed:', error);
      throw error;
    }
  },

  syncCustomers: async () => {
    const { syncQueue } = get();
    const customerItems = syncQueue.filter(item => item.collection === 'customers');
    
    if (customerItems.length === 0) return;

    try {
      // Group by operation type
      const creates = customerItems.filter(item => item.operation === 'create');
      const updates = customerItems.filter(item => item.operation === 'update');
      const deletes = customerItems.filter(item => item.operation === 'delete');

      // Process creates
      for (const item of creates) {
        try {
          await apiService.createCustomer(item.data);
          get().removeFromSyncQueue(item.id);
        } catch (error) {
          console.error('Failed to sync customer create:', error);
          set(state => ({
            syncQueue: state.syncQueue.map(queueItem =>
              queueItem.id === item.id
                ? { ...queueItem, retryCount: queueItem.retryCount + 1 }
                : queueItem
            )
          }));
        }
      }

      // Process updates
      for (const item of updates) {
        try {
          await apiService.updateCustomer(item.documentId, item.data);
          get().removeFromSyncQueue(item.id);
        } catch (error) {
          console.error('Failed to sync customer update:', error);
          set(state => ({
            syncQueue: state.syncQueue.map(queueItem =>
              queueItem.id === item.id
                ? { ...queueItem, retryCount: queueItem.retryCount + 1 }
                : queueItem
            )
          }));
        }
      }

      // Process deletes
      for (const item of deletes) {
        try {
          await apiService.deleteCustomer(item.documentId);
          get().removeFromSyncQueue(item.id);
        } catch (error) {
          console.error('Failed to sync customer delete:', error);
          set(state => ({
            syncQueue: state.syncQueue.map(queueItem =>
              queueItem.id === item.id
                ? { ...queueItem, retryCount: queueItem.retryCount + 1 }
                : queueItem
            )
          }));
        }
      }

      // Refresh local customers
      const customerStore = useCustomerStore.getState();
      await customerStore.fetchCustomers();
    } catch (error) {
      console.error('Customer sync failed:', error);
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },

  retryFailedItems: async () => {
    const { syncQueue } = get();
    const failedItems = syncQueue.filter(item => item.retryCount > 0);
    
    if (failedItems.length === 0) return;

    // Reset retry count for failed items
    set(state => ({
      syncQueue: state.syncQueue.map(item =>
        item.retryCount > 0 ? { ...item, retryCount: 0 } : item
      )
    }));

    // Retry sync
    await get().syncNow();
  }
}));
