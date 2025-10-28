import { create } from 'zustand';
import apiService from '../services/apiService';

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

  fetchCustomers: async (page = 1, limit = 50) => {
    set({ loading: true, error: null });
    try {
      const response = await apiService.get(`/customers?page=${page}&limit=${limit}`);
      set({ 
        customers: response.data.customers,
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
      const response = await apiService.get(`/customers/search?query=${encodeURIComponent(query)}`);
      set({ 
        customers: response.data,
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
      const response = await apiService.get(`/customers/${id}`);
      return response.data;
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch customer' });
      return null;
    }
  },

  createCustomer: async (customerData: Partial<Customer>) => {
    set({ loading: true, error: null });
    try {
      const response = await apiService.post('/customers', customerData);
      const newCustomer = response.data;
      
      set(state => ({
        customers: [newCustomer, ...state.customers],
        loading: false
      }));
      
      return newCustomer;
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to create customer',
        loading: false 
      });
      throw error;
    }
  },

  updateCustomer: async (id: string, customerData: Partial<Customer>) => {
    set({ loading: true, error: null });
    try {
      const response = await apiService.put(`/customers/${id}`, customerData);
      const updatedCustomer = response.data;
      
      set(state => ({
        customers: state.customers.map(customer => 
          customer._id === id ? updatedCustomer : customer
        ),
        loading: false
      }));
      
      return updatedCustomer;
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to update customer',
        loading: false 
      });
      throw error;
    }
  },

  deleteCustomer: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await apiService.delete(`/customers/${id}`);
      
      set(state => ({
        customers: state.customers.filter(customer => customer._id !== id),
        loading: false
      }));
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to delete customer',
        loading: false 
      });
      throw error;
    }
  },

  getCustomerStats: async () => {
    try {
      const response = await apiService.get('/customers/stats');
      set({ 
        customerStats: response.data.stats,
        tierBreakdown: response.data.tierBreakdown 
      });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch customer statistics' });
    }
  },

  updateLoyaltyPoints: async (id: string, points: number, operation: 'add' | 'subtract') => {
    set({ loading: true, error: null });
    try {
      const response = await apiService.put(`/customers/${id}/loyalty`, {
        points,
        operation
      });
      
      const updatedCustomer = response.data;
      
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
      const response = await apiService.get('/customers');
      set({ 
        customers: response.data.customers,
        refreshing: false 
      });
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to refresh customers',
        refreshing: false 
      });
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  clearError: () => {
    set({ error: null });
  }
}));
