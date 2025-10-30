import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../services/apiService';
import SyncService from '../services/syncService';
import { config } from '../config';

// Create sync service instance with error handling
let syncService: SyncService | null = null;
try {
  syncService = new SyncService(config.apiUrl);
} catch (error) {
  console.warn('Failed to initialize sync service:', error);
}

export interface User {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  storeId: string;
  permissions: string[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string, rememberMe = false) => {
        console.log('[AUTH_STORE] Login called', {
          email,
          rememberMe,
          hasPassword: !!password
        });

        set({ isLoading: true, error: null });
        
        try {
          console.log('[AUTH_STORE] Calling apiService.login');
          const response = await apiService.login(email, password, rememberMe);
          console.log('[AUTH_STORE] API response received', {
            success: response.success,
            hasData: !!response.data,
            message: response.message
          });
          
          if (response.success) {
            const { user, tokens } = response.data;
            
            console.log('[AUTH_STORE] Login successful, parsing response', {
              hasTokens: !!tokens,
              hasAccessToken: !!tokens?.accessToken,
              hasRefreshToken: !!tokens?.refreshToken,
              hasUser: !!user,
              userId: user?.id,
              userEmail: user?.email,
              userFullName: user?.fullName
            });
            
            // Extract access token from tokens object
            const accessToken = tokens?.accessToken;
            if (accessToken) {
              apiService.setAuthToken(accessToken);
              syncService?.setAuthToken(accessToken);
              console.log('[AUTH_STORE] Access token set successfully');
            } else {
              console.warn('[AUTH_STORE] No access token found in tokens object');
            }
            
            // Map user object to match our User interface
            const mappedUser: User = {
              userId: user.id,
              email: user.email,
              fullName: user.fullName,
              role: user.role,
              storeId: user.storeId?._id || user.storeId?.toString() || user.storeId || '',
              permissions: user.permissions || []
            };
            
            console.log('[AUTH_STORE] User mapped:', {
              userId: mappedUser.userId,
              email: mappedUser.email,
              role: mappedUser.role,
              storeId: mappedUser.storeId
            });
            
            set({
              user: mappedUser,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });

            console.log('[AUTH_STORE] Auth state updated successfully');
          } else {
            console.warn('[AUTH_STORE] Login failed', {
              message: response.message,
              error: response.error
            });
            set({
              error: response.message || 'Login failed',
              isLoading: false,
            });
          }
        } catch (error) {
          // Enhanced error logging with full details
          const errorInfo: any = {
            errorMessage: error instanceof Error ? error.message : String(error),
            errorType: error instanceof Error ? error.constructor.name : typeof error,
          };

          if (error instanceof Error) {
            errorInfo.errorName = error.name;
            errorInfo.errorStack = error.stack?.substring(0, 1000); // First 1000 chars
            
            // Extract all enumerable properties
            const errorProps: any = {};
            for (const key in error) {
              if (Object.prototype.hasOwnProperty.call(error, key)) {
                try {
                  errorProps[key] = (error as any)[key];
                } catch {
                  errorProps[key] = '[Unable to serialize]';
                }
              }
            }
            errorInfo.errorProperties = errorProps;
          }

          console.error('[AUTH_STORE] Login exception:', JSON.stringify(errorInfo, null, 2));
          console.error('[AUTH_STORE] Raw error:', error);
          
          // Try to get more specific error message
          let errorMessage = 'Login failed';
          if (error instanceof Error) {
            if (error.message.includes('Network request failed')) {
              errorMessage = 'Cannot connect to server. Please check your network connection and ensure the backend server is running.';
            } else {
              errorMessage = error.message;
            }
          }
          
          set({
            error: errorMessage,
            isLoading: false,
          });
        }
      },

      logout: async () => {
        set({ isLoading: true });
        
        try {
          await apiService.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          // Clear auth token
          apiService.setAuthToken('');
          syncService?.setAuthToken('');
          
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      refreshToken: async () => {
        console.log('[AUTH_STORE] Refresh token called');
        try {
          console.log('[AUTH_STORE] Calling apiService.refreshToken');
          const response = await apiService.refreshToken();
          console.log('[AUTH_STORE] Refresh token response received', {
            success: response.success,
            hasAccessToken: !!response.data?.accessToken
          });
          
          if (response.success) {
            const { accessToken } = response.data;
            
            if (accessToken) {
              // Update auth token
              apiService.setAuthToken(accessToken);
              syncService?.setAuthToken(accessToken);
              console.log('[AUTH_STORE] Token refreshed successfully');
            } else {
              console.warn('[AUTH_STORE] No access token in refresh response');
              get().logout();
            }
          } else {
            console.warn('[AUTH_STORE] Token refresh failed, logging out');
            // Token refresh failed, logout user
            get().logout();
          }
        } catch (error) {
          console.error('[AUTH_STORE] Token refresh exception:', {
            error: error instanceof Error ? error.message : String(error),
            errorType: error instanceof Error ? error.constructor.name : typeof error,
            stack: error instanceof Error ? error.stack : undefined
          });
          get().logout();
        }
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
