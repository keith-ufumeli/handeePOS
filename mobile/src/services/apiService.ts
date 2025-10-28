import { Platform } from 'react-native';
import { config } from '../config';

const API_BASE_URL = __DEV__ 
  ? (Platform.OS === 'ios' ? config.apiUrl : 'http://10.0.2.2:3000')
  : 'https://your-production-api.com';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

class ApiService {
  private baseUrl: string;
  private authToken: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  private async makeRequest<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // Auth endpoints
  async register(data: { fullName: string; email: string; password: string }) {
    return this.makeRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(email: string, password: string, rememberMe: boolean = false) {
    return this.makeRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, rememberMe }),
    });
  }

  async forgotPassword(email: string) {
    return this.makeRequest('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, password: string) {
    return this.makeRequest('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  async logout() {
    return this.makeRequest('/api/auth/logout', {
      method: 'POST',
    });
  }

  async refreshToken() {
    return this.makeRequest('/api/auth/refresh-token', {
      method: 'POST',
    });
  }

  async getMe() {
    return this.makeRequest('/api/auth/me');
  }

  // Product endpoints
  async getProducts(params: {
    search?: string;
    category?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    lowStock?: boolean;
  } = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });

    return this.makeRequest<PaginatedResponse<any>>(`/api/products?${queryParams}`);
  }

  async getProduct(id: string) {
    return this.makeRequest(`/api/products/${id}`);
  }

  async createProduct(data: any) {
    return this.makeRequest('/api/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProduct(id: string, data: any) {
    return this.makeRequest(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProduct(id: string) {
    return this.makeRequest(`/api/products/${id}`, {
      method: 'DELETE',
    });
  }

  async getLowStockProducts() {
    return this.makeRequest('/api/products/low-stock');
  }

  async searchProductByBarcode(barcode: string) {
    return this.makeRequest(`/api/products/search?barcode=${encodeURIComponent(barcode)}`);
  }

  async updateProductStock(id: string, stockQuantity: number, reason?: string) {
    return this.makeRequest(`/api/products/${id}/stock`, {
      method: 'PUT',
      body: JSON.stringify({ stockQuantity, reason }),
    });
  }

  // Category endpoints
  async getCategories() {
    return this.makeRequest('/api/products/categories');
  }

  async getCategory(id: string) {
    return this.makeRequest(`/api/products/categories/${id}`);
  }

  async createCategory(data: any) {
    return this.makeRequest('/api/products/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCategory(id: string, data: any) {
    return this.makeRequest(`/api/products/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCategory(id: string) {
    return this.makeRequest(`/api/products/categories/${id}`, {
      method: 'DELETE',
    });
  }

  // Order endpoints (to be implemented)
  async getOrders(params: {
    startDate?: string;
    endDate?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });

    return this.makeRequest<PaginatedResponse<any>>(`/api/orders?${queryParams}`);
  }

  async getOrder(id: string) {
    return this.makeRequest(`/api/orders/${id}`);
  }

  async createOrder(data: any) {
    return this.makeRequest('/api/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateOrder(id: string, data: any) {
    return this.makeRequest(`/api/orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteOrder(id: string) {
    return this.makeRequest(`/api/orders/${id}`, {
      method: 'DELETE',
    });
  }

  async getOrderStats(date?: string) {
    const params = date ? `?date=${encodeURIComponent(date)}` : '';
    return this.makeRequest(`/api/orders/stats${params}`);
  }

  // Generic HTTP methods
  async get<T = any>(endpoint: string): Promise<T> {
    return this.makeRequest<T>(endpoint);
  }

  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: 'DELETE',
    });
  }

  // Customer endpoints
  async getCustomers(params: {
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });

    return this.makeRequest<PaginatedResponse<any>>(`/api/customers?${queryParams}`);
  }

  async getCustomer(id: string) {
    return this.makeRequest(`/api/customers/${id}`);
  }

  async createCustomer(data: any) {
    return this.makeRequest('/api/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCustomer(id: string, data: any) {
    return this.makeRequest(`/api/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCustomer(id: string) {
    return this.makeRequest(`/api/customers/${id}`, {
      method: 'DELETE',
    });
  }

  async searchCustomers(query: string) {
    return this.makeRequest(`/api/customers/search?query=${encodeURIComponent(query)}`);
  }

  async getCustomerStats() {
    return this.makeRequest('/api/customers/stats');
  }

  async updateCustomerLoyaltyPoints(id: string, points: number, operation: 'add' | 'subtract') {
    return this.makeRequest(`/api/customers/${id}/loyalty`, {
      method: 'PUT',
      body: JSON.stringify({ points, operation }),
    });
  }

  // Report endpoints
  async getDailySalesSummary(date?: string) {
    const params = date ? `?date=${encodeURIComponent(date)}` : '';
    return this.makeRequest(`/api/reports/daily-summary${params}`);
  }

  async getSalesReport(startDate: string, endDate: string, groupBy = 'day') {
    return this.makeRequest(`/api/reports/sales?startDate=${startDate}&endDate=${endDate}&groupBy=${groupBy}`);
  }

  async getProductPerformance(startDate?: string, endDate?: string, sortBy = 'sales', limit = 50) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    params.append('sortBy', sortBy);
    params.append('limit', limit.toString());
    
    return this.makeRequest(`/api/reports/products?${params.toString()}`);
  }

  async getInventoryValuation() {
    return this.makeRequest('/api/reports/inventory');
  }

  async getCustomerAnalytics(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    return this.makeRequest(`/api/reports/customers?${params.toString()}`);
  }

  // Settings endpoints
  async getStoreSettings() {
    return this.makeRequest('/api/settings/store');
  }

  async updateStoreSettings(data: any) {
    return this.makeRequest('/api/settings/store', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateReceiptSettings(data: any) {
    return this.makeRequest('/api/settings/receipt', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateTaxSettings(data: any) {
    return this.makeRequest('/api/settings/tax', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateBusinessHours(data: any) {
    return this.makeRequest('/api/settings/business-hours', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getSystemInfo() {
    return this.makeRequest('/api/settings/system');
  }

  async testReceiptPrinter() {
    return this.makeRequest('/api/settings/test-receipt', {
      method: 'POST',
    });
  }
}

export default new ApiService();
