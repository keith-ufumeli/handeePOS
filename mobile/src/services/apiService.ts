import { Platform } from 'react-native';

const API_BASE_URL = __DEV__ 
  ? (Platform.OS === 'ios' ? 'http://localhost:3000' : 'http://10.0.2.2:3000')
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
  async login(email: string, password: string) {
    return this.makeRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
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
}

export default new ApiService();
