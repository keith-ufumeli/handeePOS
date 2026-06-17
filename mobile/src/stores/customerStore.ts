import { create } from 'zustand';
import apiService from '../services/apiService';
import * as dbHelpers from '../database/db-helpers';
import { localCustomerToStoreCustomer } from '../database/types';
import syncService from '../services/syncService';

export interface Customer {
  _id: string;
  name: string;
  email?: string;
  phoneNumber?: string;
  address?: {
    street: string;
    city: string;
    country: string;
    postalCode: string;
  };
  totalSpent: number;
  totalOrders: number;
  lastVisit?: string;
  notes?: string;
  loyaltyPoints: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CustomerStats {
  totalCustomers: number;
  totalSpent: number;
  averageSpent: number;
  totalOrders: number;
  averageOrders: number;
  totalLoyaltyPoints: number;
}

interface TierBreakdown {
  _id: string;
  count: number;
}

interface CustomerStore {
  customers: Customer[];
  customerStats: CustomerStats | null;
  tierBreakdown: TierBreakdown[];
  loading: boolean;
  refreshing: boolean;
  searchQuery: string;
  error: string | null;
  
  // Actions
  fetchCustomers: (page?: number, limit?: number) => Promise<void>;
  searchCustomers: (query: string) => Promise<void>;
  getCustomer: (id: string) => Promise<Customer | null>;
  createCustomer: (customerData: Partial<Customer>) => Promise<Customer>;
  updateCustomer: (id: string, customerData: Partial<Customer>) => Promise<Customer>;
  deleteCustomer: (id: string) => Promise<void>;
  getCustomerStats: () => Promise<void>;
  updateLoyaltyPoints: (id: string, points: number, operation: 'add' | 'subtract') => Promise<void>;
  refreshCustomers: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  clearError: () => void;
}

export const useCustomerStore = create<CustomerStore>((set, get) => ({
  customers: [],
  customerStats: null,
  tierBreakdown: [],
  loading: false,
  refreshing: false,
  searchQuery: '',
  error: null,

  fetchCustomers: async (_page = 1, _limit = 50) => {
    set({ loading: true, error: null });
    try {
      const search = get().searchQuery?.trim();
      const list = await dbHelpers.getAllCustomers(search ? { search } : undefined);
      set({
        customers: list.map(localCustomerToStoreCustomer),
        loading: false
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to fetch customers',
        loading: false
      });
    }
  },

  searchCustomers: async (query: string) => {
    set({ loading: true, error: null });
    try {
      const list = await dbHelpers.getAllCustomers(query.trim() ? { search: query } : undefined);
      set({
        customers: list.map(localCustomerToStoreCustomer),
        loading: false
      });
    } catch (error: any) {
      set({
        error: error.message || 'Failed to search customers',
        loading: false
      });
    }
  },

  getCustomer: async (id: string) => {
    try {
      const local = await dbHelpers.getCustomerByServerId(id) ?? await dbHelpers.getCustomerById(id);
      return local ? localCustomerToStoreCustomer(local) : null;
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch customer' });
      return null;
    }
  },

  createCustomer: async (customerData: Partial<Customer>) => {
    set({ loading: true, error: null });
    try {
      const addressStr = customerData.address ? JSON.stringify(customerData.address) : undefined;
      const local = await dbHelpers.createCustomer({
        name: customerData.name!,
        email: customerData.email,
        phoneNumber: customerData.phoneNumber,
        address: addressStr,
        notes: customerData.notes,
      });
      await syncService.addToSyncQueue('create', 'customers', local.id, {
        name: local.name,
        email: local.email ?? undefined,
        phoneNumber: local.phoneNumber ?? undefined,
        address: local.address ? JSON.parse(local.address) : undefined,
        notes: local.notes ?? undefined,
      });
      const newCustomer = localCustomerToStoreCustomer(local);
      set(state => ({ customers: [newCustomer, ...state.customers], loading: false }));
      return newCustomer;
    } catch (error: any) {
      set({ error: error.message || 'Failed to create customer', loading: false });
      throw error;
    }
  },

  updateCustomer: async (id: string, customerData: Partial<Customer>) => {
    set({ loading: true, error: null });
    try {
      const local = await dbHelpers.getCustomerByServerId(id) ?? await dbHelpers.getCustomerById(id);
      if (!local) throw new Error('Customer not found');
      const addressStr = customerData.address ? JSON.stringify(customerData.address) : undefined;
      const updated = await dbHelpers.updateCustomer(local.id, {
        name: customerData.name,
        email: customerData.email,
        phoneNumber: customerData.phoneNumber,
        address: addressStr,
        notes: customerData.notes,
      });
      await syncService.addToSyncQueue('update', 'customers', local.id, {
        name: updated.name,
        email: updated.email ?? undefined,
        phoneNumber: updated.phoneNumber ?? undefined,
        address: updated.address ? (typeof updated.address === 'string' ? JSON.parse(updated.address) : updated.address) : undefined,
        notes: updated.notes ?? undefined,
        serverId: updated.serverId ?? undefined,
      });
      const newCustomer = localCustomerToStoreCustomer(updated);
      set(state => ({
        customers: state.customers.map(c => (c._id === id ? newCustomer : c)),
        loading: false
      }));
      return newCustomer;
    } catch (error: any) {
      set({ error: error.message || 'Failed to update customer', loading: false });
      throw error;
    }
  },

  deleteCustomer: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const local = await dbHelpers.getCustomerByServerId(id) ?? await dbHelpers.getCustomerById(id);
      if (!local) throw new Error('Customer not found');
      await dbHelpers.deleteCustomer(local.id);
      await syncService.addToSyncQueue('delete', 'customers', local.id, { serverId: local.serverId ?? undefined });
      set(state => ({
        customers: state.customers.filter(c => c._id !== id),
        loading: false
      }));
    } catch (error: any) {
      set({ error: error.message || 'Failed to delete customer', loading: false });
      throw error;
    }
  },

  getCustomerStats: async () => {
    try {
      const response = await apiService.getCustomerStats();
      const data = response.data ?? response;
      set({
        customerStats: data.stats ?? null,
        tierBreakdown: data.tierBreakdown ?? []
      });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch customer statistics' });
    }
  },

  updateLoyaltyPoints: async (id: string, points: number, operation: 'add' | 'subtract') => {
    set({ loading: true, error: null });
    try {
      const response = await apiService.updateCustomerLoyaltyPoints(id, points, operation);
      const updatedCustomer = response.data ?? response;

      set(state => ({
        customers: state.customers.map(customer =>
          customer._id === id ? updatedCustomer : customer
        ),
        loading: false
      }));
    } catch (error: any) {
      set({
        error: error.message || 'Failed to update loyalty points',
        loading: false
      });
      throw error;
    }
  },

  refreshCustomers: async () => {
    set({ refreshing: true });
    try {
      const search = get().searchQuery?.trim();
      const list = await dbHelpers.getAllCustomers(search ? { search } : undefined);
      set({
        customers: list.map(localCustomerToStoreCustomer),
        refreshing: false
      });
    } catch (error: any) {
      set({ error: error.message || 'Failed to refresh customers', refreshing: false });
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  clearError: () => {
    set({ error: null });
  }
}));
