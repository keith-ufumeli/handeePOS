import { create } from 'zustand';
import apiService from '../services/apiService';

export interface DailySummary {
  date: string;
  summary: {
    totalSales: number;
    totalOrders: number;
    totalItems: number;
    averageOrderValue: number;
    cashSales: number;
    cardSales: number;
    mobileMoneySales: number;
  };
  hourlyBreakdown: {
    _id: number;
    sales: number;
    orders: number;
  }[];
  topProducts: {
    _id: {
      productId: string;
      productName: string;
      sku: string;
    };
    totalQuantity: number;
    totalRevenue: number;
  }[];
}

export interface SalesReport {
  startDate: string;
  endDate: string;
  groupBy: string;
  data: {
    _id: any;
    totalSales: number;
    totalOrders: number;
    totalItems: number;
    averageOrderValue: number;
    cashSales: number;
    cardSales: number;
    mobileMoneySales: number;
  }[];
}

export interface ProductPerformance {
  startDate: string;
  endDate: string;
  sortBy: string;
  products: {
    _id: {
      productId: string;
      productName: string;
      sku: string;
    };
    totalQuantitySold: number;
    totalRevenue: number;
    orderCount: number;
    averagePrice: number;
    totalDiscount: number;
    totalTax: number;
  }[];
}

export interface InventoryValuation {
  totalProducts: number;
  totalCostValue: number;
  totalRetailValue: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  profitMargin: number;
  profitMarginPercentage: string;
}

export interface CustomerAnalytics {
  startDate: string;
  endDate: string;
  stats: {
    totalCustomers: number;
    totalLoyaltyPoints: number;
    averageSpent: number;
    averageOrders: number;
  };
  topCustomers: {
    _id: string;
    name: string;
    email?: string;
    phoneNumber?: string;
    totalSpent: number;
    totalOrders: number;
    loyaltyPoints: number;
    tier: string;
  }[];
  newCustomers: number;
}

interface ReportStore {
  dailySummary: DailySummary | null;
  salesReport: SalesReport | null;
  productPerformance: ProductPerformance | null;
  inventoryValuation: InventoryValuation | null;
  customerAnalytics: CustomerAnalytics | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  
  // Actions
  fetchDailySummary: (date?: string) => Promise<void>;
  fetchSalesReport: (startDate: string, endDate: string, groupBy?: string) => Promise<void>;
  fetchProductPerformance: (startDate?: string, endDate?: string, sortBy?: string, limit?: number) => Promise<void>;
  fetchInventoryValuation: () => Promise<void>;
  fetchCustomerAnalytics: (startDate?: string, endDate?: string) => Promise<void>;
  refreshReports: () => Promise<void>;
  clearError: () => void;
}

export const useReportStore = create<ReportStore>((set, get) => ({
  dailySummary: null,
  salesReport: null,
  productPerformance: null,
  inventoryValuation: null,
  customerAnalytics: null,
  loading: false,
  refreshing: false,
  error: null,

  fetchDailySummary: async (date?: string) => {
    set({ loading: true, error: null });
    try {
      // Add a small delay to ensure token is set after login
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const url = date ? `/api/reports/daily-summary?date=${date}` : '/api/reports/daily-summary';
      const response = await apiService.get(url);
      
      if (response.success && response.data) {
        set({ 
          dailySummary: response.data,
          loading: false 
        });
      } else {
        throw new Error(response.message || 'Failed to fetch daily summary');
      }
    } catch (error: any) {
      console.warn('[REPORT_STORE] Failed to fetch daily summary:', error);
      
      // Check if error is due to invalid storeId format
      const errorMessage = error.message || 'Failed to fetch daily summary';
      const isInvalidStoreId = errorMessage.includes('Invalid store ID format') || 
                               errorMessage.includes('Invalid storeId format');
      
      if (isInvalidStoreId) {
        console.error('[REPORT_STORE] Token contains invalid storeId. User needs to log out and log back in.');
        // Don't show this error to user - it's a token issue that requires re-login
        set({ 
          error: null, // Don't show error for invalid token - user needs to re-login
          loading: false,
          dailySummary: null
        });
      } else {
        set({ 
          error: errorMessage,
          loading: false,
          dailySummary: null
        });
      }
    }
  },

  fetchSalesReport: async (startDate: string, endDate: string, groupBy = 'day') => {
    set({ loading: true, error: null });
    try {
      const response = await apiService.get(
        `/api/reports/sales?startDate=${startDate}&endDate=${endDate}&groupBy=${groupBy}`
      );
      set({ 
        salesReport: response.data,
        loading: false 
      });
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to fetch sales report',
        loading: false 
      });
    }
  },

  fetchProductPerformance: async (startDate?: string, endDate?: string, sortBy = 'sales', limit = 50) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      params.append('sortBy', sortBy);
      params.append('limit', limit.toString());
      
      const response = await apiService.get(`/api/reports/products?${params.toString()}`);
      set({ 
        productPerformance: response.data,
        loading: false 
      });
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to fetch product performance',
        loading: false 
      });
    }
  },

  fetchInventoryValuation: async () => {
    set({ loading: true, error: null });
    try {
      const response = await apiService.get('/api/reports/inventory');
      set({ 
        inventoryValuation: response.data,
        loading: false 
      });
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to fetch inventory valuation',
        loading: false 
      });
    }
  },

  fetchCustomerAnalytics: async (startDate?: string, endDate?: string) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await apiService.get(`/api/reports/customers?${params.toString()}`);
      set({ 
        customerAnalytics: response.data,
        loading: false 
      });
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to fetch customer analytics',
        loading: false 
      });
    }
  },

  refreshReports: async () => {
    set({ refreshing: true });
    try {
      // Refresh all reports
      await Promise.all([
        get().fetchDailySummary(),
        get().fetchInventoryValuation(),
        get().fetchCustomerAnalytics()
      ]);
      set({ refreshing: false });
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to refresh reports',
        refreshing: false 
      });
    }
  },

  clearError: () => {
    set({ error: null });
  }
}));
