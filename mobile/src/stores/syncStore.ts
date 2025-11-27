import { create } from 'zustand';
import syncService from '../services/syncService';
import { useProductStore } from './productStore';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

interface SyncStore {
  syncStatus: SyncStatus;
  pendingCount: number;
  lastSyncTime: string | null;
  error: string | null;
  isOnline: boolean;

  // Actions
  setOnlineStatus: (isOnline: boolean) => void;
  syncAll: () => Promise<void>;
  updatePendingCount: () => Promise<void>;
  clearError: () => void;
}

export const useSyncStore = create<SyncStore>((set, get) => ({
  syncStatus: 'idle',
  pendingCount: 0,
  lastSyncTime: null,
  error: null,
  isOnline: true,

  setOnlineStatus: (isOnline: boolean) => {
    set({ isOnline });
    if (isOnline) {
      // Update pending count when coming online
      get().updatePendingCount();
      // Auto-sync if there are pending items
      get().syncAll();
    } else {
      set({ syncStatus: 'offline' });
    }
  },

  syncAll: async () => {
    const { isOnline } = get();

    if (!isOnline) {
      set({ syncStatus: 'offline' });
      return;
    }

    // Update pending count before sync
    await get().updatePendingCount();

    const { pendingCount } = get();

    // If no pending items, just update status to synced
    if (pendingCount === 0) {
      set({ syncStatus: 'synced' });
      // Auto-hide synced status after 2 seconds
      setTimeout(() => {
        if (get().syncStatus === 'synced') {
          set({ syncStatus: 'idle' });
        }
      }, 2000);
      return;
    }

    // Set status to syncing
    set({ syncStatus: 'syncing', error: null });

    try {
      console.log('[SYNC_STORE] Starting sync with', pendingCount, 'pending items');

      // Call the actual sync service
      const result = await syncService.syncAll();

      if (result.success) {
        console.log('[SYNC_STORE] Sync completed successfully');

        // Reload products and categories after successful sync
        const productStore = useProductStore.getState();
        await productStore.loadProducts(productStore.filters);
        await productStore.loadCategories();

        set({
          syncStatus: 'synced',
          lastSyncTime: new Date().toISOString(),
          pendingCount: 0,
          error: null
        });

        // Auto-hide synced status after 2 seconds
        setTimeout(() => {
          if (get().syncStatus === 'synced') {
            set({ syncStatus: 'idle' });
          }
        }, 2000);
      } else {
        console.error('[SYNC_STORE] Sync failed:', result.errors);
        set({
          syncStatus: 'error',
          error: result.errors.join(', ') || 'Sync failed'
        });

        // Update pending count to reflect any items that failed
        await get().updatePendingCount();
      }
    } catch (error: any) {
      console.error('[SYNC_STORE] Sync error:', error);
      set({
        syncStatus: 'error',
        error: error.message || 'Sync failed'
      });

      // Update pending count
      await get().updatePendingCount();
    }
  },

  updatePendingCount: async () => {
    try {
      const status = await syncService.getSyncStatus();
      set({
        pendingCount: status.pendingCount,
        lastSyncTime: status.lastSyncTime ? new Date(status.lastSyncTime).toISOString() : null
      });
    } catch (error) {
      console.error('[SYNC_STORE] Failed to update pending count:', error);
    }
  },

  clearError: () => {
    set({ error: null, syncStatus: 'idle' });
  }
}));
