import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../services/apiService';

export interface StoreSettings {
  _id: string;
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
    headerText: string;
    footerText: string;
    showLogo: boolean;
    logoUrl?: string;
    showTaxBreakdown: boolean;
    showLoyaltyPoints: boolean;
    paperSize: string;
    fontSize: string;
    showQRCode: boolean;
    qrCodeData?: string;
  };
  taxSettings: {
    defaultTaxRate: number;
    taxInclusive: boolean;
    taxName: string;
    taxNumber?: string;
    showTaxOnReceipt: boolean;
  };
  businessHours: {
    [key: string]: {
      isOpen: boolean;
      openTime: string;
      closeTime: string;
      breakStart?: string;
      breakEnd?: string;
    };
  };
  features: {
    loyaltyProgram: boolean;
    multiStore: boolean;
    advancedReports: boolean;
    inventoryTracking: boolean;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SystemInfo {
  version: string;
  environment: string;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  nodeVersion: string;
  platform: string;
  timestamp: string;
}

export interface TestReceipt {
  storeName: string;
  address: string;
  phoneNumber?: string;
  orderNumber: string;
  date: string;
  items: {
    name: string;
    quantity: number;
    price: number;
    total: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  receiptSettings: StoreSettings['receiptSettings'];
}

interface SettingsStore {
  storeSettings: StoreSettings | null;
  systemInfo: SystemInfo | null;
  testReceipt: TestReceipt | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;

  // Actions
  fetchStoreSettings: () => Promise<void>;
  updateStoreSettings: (settings: Partial<StoreSettings>) => Promise<void>;
  updateReceiptSettings: (settings: Partial<StoreSettings['receiptSettings']>) => Promise<void>;
  updateTaxSettings: (settings: Partial<StoreSettings['taxSettings']>) => Promise<void>;
  updateBusinessHours: (hours: StoreSettings['businessHours']) => Promise<void>;
  fetchSystemInfo: () => Promise<void>;
  testReceiptPrinter: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  clearError: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      storeSettings: null,
      systemInfo: null,
      testReceipt: null,
      loading: false,
      refreshing: false,
      error: null,

      fetchStoreSettings: async () => {
        set({ loading: true, error: null });
        try {
          const response = await apiService.getStoreSettings();
          set({
            storeSettings: response.data,
            loading: false
          });
        } catch (error: any) {
          // If we have cached settings, don't clear them on error (offline mode)
          const currentSettings = get().storeSettings;
          const errorMessage = error.message || 'Failed to fetch store settings';

          if (currentSettings) {
            console.warn('[SETTINGS_STORE] Failed to fetch settings, using cached version:', errorMessage);
            set({
              loading: false,
              // Don't set error if we have cached data to avoid showing error UI
              // error: errorMessage 
            });
          } else {
            set({
              error: errorMessage,
              loading: false
            });
          }
        }
      },

      updateStoreSettings: async (settings: Partial<StoreSettings>) => {
        set({ loading: true, error: null });
        try {
          const response = await apiService.updateStoreSettings(settings);
          set({
            storeSettings: response.data,
            loading: false
          });
        } catch (error: any) {
          set({
            error: error.message || 'Failed to update store settings',
            loading: false
          });
          throw error;
        }
      },

      updateReceiptSettings: async (settings: Partial<StoreSettings['receiptSettings']>) => {
        set({ loading: true, error: null });
        try {
          const response = await apiService.updateReceiptSettings(settings);
          const updatedSettings = response.data;

          set(state => ({
            storeSettings: state.storeSettings ? {
              ...state.storeSettings,
              receiptSettings: updatedSettings
            } : null,
            loading: false
          }));
        } catch (error: any) {
          set({
            error: error.message || 'Failed to update receipt settings',
            loading: false
          });
          throw error;
        }
      },

      updateTaxSettings: async (settings: Partial<StoreSettings['taxSettings']>) => {
        set({ loading: true, error: null });
        try {
          const response = await apiService.updateTaxSettings(settings);
          const updatedSettings = response.data;

          set(state => ({
            storeSettings: state.storeSettings ? {
              ...state.storeSettings,
              taxSettings: updatedSettings
            } : null,
            loading: false
          }));
        } catch (error: any) {
          set({
            error: error.message || 'Failed to update tax settings',
            loading: false
          });
          throw error;
        }
      },

      updateBusinessHours: async (hours: StoreSettings['businessHours']) => {
        set({ loading: true, error: null });
        try {
          const response = await apiService.updateBusinessHours(hours);
          const updatedHours = response.data;

          set(state => ({
            storeSettings: state.storeSettings ? {
              ...state.storeSettings,
              businessHours: updatedHours
            } : null,
            loading: false
          }));
        } catch (error: any) {
          set({
            error: error.message || 'Failed to update business hours',
            loading: false
          });
          throw error;
        }
      },

      fetchSystemInfo: async () => {
        try {
          const response = await apiService.getSystemInfo();
          set({ systemInfo: response.data });
        } catch (error: any) {
          set({ error: error.message || 'Failed to fetch system information' });
        }
      },

      testReceiptPrinter: async () => {
        set({ loading: true, error: null });
        try {
          const response = await apiService.testReceiptPrinter();
          set({
            testReceipt: response.data,
            loading: false
          });
        } catch (error: any) {
          set({
            error: error.message || 'Failed to generate test receipt',
            loading: false
          });
        }
      },

      refreshSettings: async () => {
        set({ refreshing: true });
        try {
          await get().fetchStoreSettings();
          set({ refreshing: false });
        } catch (error: any) {
          set({
            error: error.message || 'Failed to refresh settings',
            refreshing: false
          });
        }
      },

      clearError: () => {
        set({ error: null });
      }
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        storeSettings: state.storeSettings,
      }),
    }
  )
);
