import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import secureStorage from './secureStorage';
import { config } from '../config';

const API_BASE_URL = __DEV__
  ? (Platform.OS === 'ios' ? config.apiUrl : 'https://handeepos.onrender.com')
  : 'https://your-production-api.com';

// Allow time for Render.com cold start (~30–60s on free tier)
const REQUEST_TIMEOUT_MS = 60000;

const AUTH_TOKEN_KEY = config.authTokenKey;
const REFRESH_TOKEN_KEY = 'refresh_token';
const LAST_ONLINE_KEY = 'last_online_timestamp';

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
  private refreshToken: string | null = null;
  private tokenRestorePromise: Promise<void> | null = null;
  private isRefreshing = false;
  private refreshSubscribers: ((token: string) => void)[] = [];
  private sessionExpiredCallback: (() => void) | null = null;
  private lastOnlineTime: Date | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    // Restore token from storage on initialization
    this.tokenRestorePromise = this.restoreToken();
  }

  setSessionExpiredCallback(callback: () => void) {
    this.sessionExpiredCallback = callback;
  }

  // Ensure token is restored before making requests
  private async ensureTokenRestored() {
    if (this.tokenRestorePromise) {
      await this.tokenRestorePromise;
      this.tokenRestorePromise = null;
    }
  }

  async setAuthToken(token: string, refreshToken?: string) {
    this.authToken = token;

    // Persist access token to secure storage
    if (token) {
      try {
        await secureStorage.setItem(AUTH_TOKEN_KEY, token);
        console.log('[API_SERVICE] Access token saved to secure storage');
      } catch (error) {
        console.error('[API_SERVICE] Failed to save access token to storage:', error);
      }
    } else {
      // Clear access token from storage
      try {
        await secureStorage.removeItem(AUTH_TOKEN_KEY);
        console.log('[API_SERVICE] Access token removed from storage');
      } catch (error) {
        console.error('[API_SERVICE] Failed to remove access token from storage:', error);
      }
    }

    // Persist refresh token if provided
    if (refreshToken !== undefined) {
      this.refreshToken = refreshToken;
      if (refreshToken) {
        try {
          await secureStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
          console.log('[API_SERVICE] Refresh token saved to secure storage');
        } catch (error) {
          console.error('[API_SERVICE] Failed to save refresh token to storage:', error);
        }
      } else {
        // Clear refresh token from storage
        try {
          await secureStorage.removeItem(REFRESH_TOKEN_KEY);
          console.log('[API_SERVICE] Refresh token removed from storage');
        } catch (error) {
          console.error('[API_SERVICE] Failed to remove refresh token from storage:', error);
        }
      }
    }
  }

  async restoreToken() {
    try {
      console.log('[API_SERVICE] Restoring tokens from secure storage');

      // Restore access token
      const token = await secureStorage.getItem(AUTH_TOKEN_KEY);
      if (token) {
        this.authToken = token;
        console.log('[API_SERVICE] Access token restored from storage', {
          tokenLength: token.length,
          tokenPrefix: token.substring(0, 20) + '...'
        });
      } else {
        console.log('[API_SERVICE] No access token found in storage');
      }

      // Restore refresh token
      const refreshToken = await secureStorage.getItem(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        this.refreshToken = refreshToken;
        console.log('[API_SERVICE] Refresh token restored from storage');
      } else {
        console.log('[API_SERVICE] No refresh token found in storage');
      }

      // Restore last online time
      const lastOnlineStr = await secureStorage.getItem(LAST_ONLINE_KEY);
      if (lastOnlineStr) {
        this.lastOnlineTime = new Date(lastOnlineStr);
        console.log('[API_SERVICE] Last online time restored:', this.lastOnlineTime);
      }
    } catch (error) {
      console.error('[API_SERVICE] Failed to restore tokens from storage:', error);
    }
  }

  private onRefreshed(token: string) {
    this.refreshSubscribers.forEach((callback) => callback(token));
    this.refreshSubscribers = [];
  }

  private addRefreshSubscriber(callback: (token: string) => void) {
    this.refreshSubscribers.push(callback);
  }

  private async makeRequest<T = any>(
    endpoint: string,
    options: RequestInit = {},
    isRetry = false
  ): Promise<T> {
    // Ensure token is restored before making the request
    await this.ensureTokenRestored();
    
    // Double-check token is available (in case it was set after ensureTokenRestored)
    if (!this.authToken) {
      // Try restoring one more time
      await this.restoreToken();
    }
    
    // For authenticated endpoints (not auth endpoints), ensure we have a token
    const isAuthEndpoint = endpoint.includes('/auth/');
    if (!isAuthEndpoint && !this.authToken) {
      const errorMessage = `Cannot make authenticated request to ${endpoint} without auth token. Please log in again.`;
      console.error('[API_SERVICE]', errorMessage);
      throw new Error(errorMessage);
    }
    
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
      ...options.headers,
    };

    // Warn if making authenticated request without token
    if (!this.authToken && !isAuthEndpoint) {
      console.warn('[API_SERVICE] Making request without auth token:', endpoint);
    }

    console.log('[API_SERVICE] Making HTTP request', {
      url,
      method: options.method || 'GET',
      hasAuthToken: !!this.authToken,
      isRetry
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const err = new Error('Request timed out');
        (err as any).name = 'AbortError';
        reject(err);
      }, REQUEST_TIMEOUT_MS);
    });

    try {
      const response = await Promise.race([
        fetch(url, { ...options, headers }),
        timeoutPromise,
      ]);

      // Update last online time on successful connection
      if (response.status !== 0) { // 0 means network error
        this.lastOnlineTime = new Date();
        try {
          await secureStorage.setItem(LAST_ONLINE_KEY, this.lastOnlineTime.toISOString());
        } catch (error) {
          console.warn('[API_SERVICE] Failed to save last online time:', error);
        }
      }

      // Handle 401 Unauthorized (Token Expired)
      if (response.status === 401 && !isAuthEndpoint && !isRetry) {
        console.log('[API_SERVICE] 401 Unauthorized received. Attempting refresh...');
        
        if (this.isRefreshing) {
          // If already refreshing, wait for the new token
          return new Promise((resolve) => {
            this.addRefreshSubscriber((token) => {
              // Retry the request with the new token
              resolve(
                this.makeRequest<T>(endpoint, options, true)
              );
            });
          });
        }

        this.isRefreshing = true;

        try {
          // Check network status before refreshing
          const netInfo = await NetInfo.fetch();
          if (!netInfo.isConnected) {
            console.warn('[API_SERVICE] Offline, cannot refresh token.');
            throw new Error('Offline: Cannot refresh token');
          }

          // Call refresh token endpoint (with stored refresh token)
          const refreshResponse = await this.refreshTokenRequest();

          if (refreshResponse.success && refreshResponse.data?.accessToken) {
            const newAccessToken = refreshResponse.data.accessToken;
            const newRefreshToken = refreshResponse.data.refreshToken; // Rotated refresh token

            // Update both tokens (rotation)
            await this.setAuthToken(newAccessToken, newRefreshToken);
            this.isRefreshing = false;
            this.onRefreshed(newAccessToken);

            // Retry original request
            return this.makeRequest<T>(endpoint, options, true);
          } else {
            console.error('[API_SERVICE] Token refresh failed');
            this.isRefreshing = false;
            await this.setAuthToken('', ''); // Clear both tokens
            this.sessionExpiredCallback?.();
            throw new Error('Session expired. Please login again.');
          }
        } catch (refreshError) {
          this.isRefreshing = false;
          console.error('[API_SERVICE] Error during token refresh:', refreshError);
          await this.setAuthToken('', ''); // Clear both tokens
          this.sessionExpiredCallback?.();
          throw refreshError;
        }
      }

      console.log('[API_SERVICE] HTTP response received', {
        url,
        status: response.status,
        ok: response.ok
      });

      if (!response.ok) {
        const errorData: any = await response.json().catch(() => ({}));
        const errorMessage = errorData?.message || errorData?.error || `HTTP ${response.status}: ${response.statusText}`;
        
        console.error('[API_SERVICE] HTTP error response', {
          status: response.status,
          errorData,
          endpoint
        });
        
        // Check if error is due to invalid storeId format (400 error)
        if (response.status === 400 && (
          errorMessage.includes('Invalid store ID format') || 
          errorMessage.includes('Invalid storeId format') ||
          errorMessage.includes('Store ID not found')
        )) {
          console.error('[API_SERVICE] Token contains invalid storeId. User must log out and log back in.');
        }
        
        throw new Error(errorMessage);
      }

      const data: T = await response.json() as T;
      return data;
    } catch (error) {
      // Enhanced error logging for network errors
      const errorDetails: any = {
        url,
        errorMessage: error instanceof Error ? error.message : String(error),
      };

      // For TypeErrors (often network errors)
      if (error instanceof TypeError) {
        errorDetails.isNetworkError = true;
      }
      const isAbort = error instanceof Error && (error as any).name === 'AbortError';

      console.error('[API_SERVICE] Request error:', JSON.stringify(errorDetails, null, 2));

      // Create a more descriptive error message
      let errorMessage = 'Network request failed';
      if (isAbort) {
        errorMessage = 'Request timed out. The server may be starting up—please try again in a moment.';
      } else if (error instanceof TypeError && error.message.includes('Network request failed')) {
        errorMessage = `Cannot connect to server at ${url}. If the server was idle, it may be starting up—try again in a moment. Otherwise check your connection.`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      const enhancedError = new Error(errorMessage);
      if (error instanceof Error && error.stack) {
        enhancedError.stack = error.stack;
      }
      throw enhancedError;
    }
  }

  // Auth endpoints
  async register(data: { fullName: string; email: string; password: string }) {
    return this.makeRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(email: string, password: string, rememberMe: boolean = false) {
    console.log('[API_SERVICE] Login request initiated');

    try {
      const requestBody = { email, password, rememberMe };
      const response = await this.makeRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      // Store both tokens after successful login
      if (response.success && response.data?.tokens) {
        await this.setAuthToken(
          response.data.tokens.accessToken,
          response.data.tokens.refreshToken
        );
      }

      return response;
    } catch (error) {
      console.error('[API_SERVICE] Login request failed:', error);
      throw error;
    }
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
    try {
      // Send refresh token to backend for revocation
      return await this.makeRequest('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({
          refreshToken: this.refreshToken,
          logoutAllDevices: false,
        }),
      });
    } finally {
      await this.setAuthToken('', ''); // Clear both tokens
    }
  }

  /**
   * Internal refresh token request (used by makeRequest)
   * Uses raw fetch to avoid circular dependency
   */
  private async refreshTokenRequest(): Promise<ApiResponse> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const url = `${this.baseUrl}/api/auth/refresh-token`;
    const headers = {
      'Content-Type': 'application/json',
    };

    console.log('[API_SERVICE] Calling refresh token endpoint');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(errorData?.message || 'Token refresh failed');
      }

      const data = (await response.json()) as ApiResponse;
      return data;
    } catch (error) {
      console.error('[API_SERVICE] Refresh token request failed:', error);
      throw error;
    }
  }

  /**
   * Public refresh token method (can be called manually)
   */
  async refreshAuthToken() {
    try {
      const response = await this.refreshTokenRequest();

      if (response.success && response.data?.accessToken) {
        const newAccessToken = response.data.accessToken;
        const newRefreshToken = response.data.refreshToken;

        // Update both tokens
        await this.setAuthToken(newAccessToken, newRefreshToken);
      }

      return response;
    } catch (error) {
      console.error('[API_SERVICE] Manual token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Check if we're within offline grace period
   */
  isWithinOfflineGracePeriod(): boolean {
    if (!this.lastOnlineTime) {
      return false; // No last online time recorded
    }

    const GRACE_PERIOD_DAYS = 7;
    const gracePeriodMs = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
    const timeSinceLastOnline = Date.now() - this.lastOnlineTime.getTime();

    return timeSinceLastOnline <= gracePeriodMs;
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

  // Order endpoints
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

  async post<T = any>(endpoint: string, data?: any, headers?: Record<string, string>): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers,
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
