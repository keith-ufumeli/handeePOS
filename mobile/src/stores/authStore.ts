import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../services/apiService';
import SyncService from '../services/syncService';
import { config } from '../config';
import { decodeJWT, extractStoreIdFromToken } from '../utils/jwtDecoder';

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
  isHydrated: boolean;
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
      isHydrated: false,
      error: null,

      // Initialize: restore token when store is rehydrated
      _hasHydrated: false,

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
            
            // Extract storeId from JWT token (source of truth from backend)
            // This ensures we use the exact storeId that the backend will use
            let storeId = '';
            if (accessToken) {
              const tokenStoreId = extractStoreIdFromToken(accessToken);
              if (tokenStoreId) {
                storeId = tokenStoreId;
                console.log('[AUTH_STORE] StoreId extracted from JWT token:', storeId);
              } else {
                console.warn('[AUTH_STORE] Failed to extract storeId from JWT token, falling back to API response');
                // Fallback to API response storeId
                if (user.storeId) {
                  if (typeof user.storeId === 'object') {
                    // Handle MongoDB ObjectId formats: { $oid: "..." } or { _id: "..." }
                    if ('$oid' in user.storeId) {
                      storeId = String((user.storeId as any).$oid);
                    } else if ('_id' in user.storeId) {
                      storeId = String((user.storeId as any)._id);
                    } else if ('toString' in user.storeId && typeof (user.storeId as any).toString === 'function') {
                      storeId = (user.storeId as any).toString();
                    } else {
                      const objStr = JSON.stringify(user.storeId);
                      const match = objStr.match(/"([0-9a-fA-F]{24})"/);
                      if (match) {
                        storeId = match[1];
                      } else {
                        storeId = String(user.storeId);
                      }
                    }
                  } else if (typeof user.storeId === 'string') {
                    storeId = user.storeId;
                  } else {
                    storeId = String(user.storeId);
                  }
                }
              }
            } else {
              // No token, use API response storeId
              if (user.storeId) {
                if (typeof user.storeId === 'object') {
                  if ('$oid' in user.storeId) {
                    storeId = String((user.storeId as any).$oid);
                  } else if ('_id' in user.storeId) {
                    storeId = String((user.storeId as any)._id);
                  } else {
                    storeId = String(user.storeId);
                  }
                } else if (typeof user.storeId === 'string') {
                  storeId = user.storeId;
                } else {
                  storeId = String(user.storeId);
                }
              }
            }
            
            // Validate storeId is a valid MongoDB ObjectId format (24 hex characters)
            if (storeId && !/^[0-9a-fA-F]{24}$/.test(storeId)) {
              console.warn('[AUTH_STORE] Invalid storeId format:', storeId, 'Original:', user.storeId);
              storeId = '';
            }
            
            // If storeId is still empty, decode full token for debugging
            if (!storeId && accessToken) {
              const decoded = decodeJWT(accessToken);
              console.warn('[AUTH_STORE] Token decoded for debugging:', {
                hasStoreId: !!decoded?.storeId,
                storeId: decoded?.storeId,
                storeIdType: typeof decoded?.storeId,
                userId: decoded?.userId,
                email: decoded?.email
              });
              
              // If token has invalid storeId, warn user they need to re-login
              if (decoded?.storeId && !/^[0-9a-fA-F]{24}$/.test(decoded.storeId)) {
                console.error('[AUTH_STORE] Token contains invalid storeId format. User should log out and log back in to get a new token.');
              }
            }
            
            // Validate we have a valid storeId before proceeding
            if (!storeId || !/^[0-9a-fA-F]{24}$/.test(storeId)) {
              console.error('[AUTH_STORE] Cannot proceed without valid storeId. Token may be outdated. User should log out and log back in.');
              // Still create user object but with empty storeId - backend will handle validation
            }
            
            const mappedUser: User = {
              userId: user.id,
              email: user.email,
              fullName: user.fullName,
              role: user.role,
              storeId: storeId || '', // Use empty string if invalid
              permissions: user.permissions || []
            };
            
            console.log('[AUTH_STORE] User mapped:', {
              userId: mappedUser.userId,
              email: mappedUser.email,
              role: mappedUser.role,
              storeId: mappedUser.storeId,
              storeIdLength: mappedUser.storeId?.length,
              isValidStoreId: mappedUser.storeId ? /^[0-9a-fA-F]{24}$/.test(mappedUser.storeId) : false,
              storeIdSource: accessToken && extractStoreIdFromToken(accessToken) ? 'JWT_TOKEN' : 'API_RESPONSE'
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
      onRehydrateStorage: () => (state) => {
        console.log('[AUTH_STORE] Hydration finished');
        if (state) {
          state.isHydrated = true;
        }
        
        // Restore token when store is rehydrated
        if (state?.isAuthenticated && state?.user) {
          console.log('[AUTH_STORE] Store rehydrated, restoring token');
          // Ensure token is restored when store rehydrates
          apiService.restoreToken();
        }
      },
    }
  )
);

// Register callback to handle session expiry from API service
apiService.setSessionExpiredCallback(() => {
  console.log('[AUTH_STORE] Session expired callback triggered');
  useAuthStore.getState().logout();
});

// Initialize auth state on app launch
export const initializeAuth = async () => {
  console.log('[AUTH_STORE] Initializing auth state...');
  await apiService.restoreToken();
  
  // If we have a user in state but no token in secure storage (and restoreToken didn't find one),
  // we should probably logout to be safe, OR trust the state if we support offline without token (unlikely for API calls).
  // But for now, let's assume if we are authenticated, we expect a token.
  
  // Note: restoreToken sets the token in apiService if found.
  // We can't easily check apiService.authToken here without exposing a getter, 
  // but apiService handles the token internally.
  
  // If we want to verify the session on launch:
  const state = useAuthStore.getState();
  if (state.isAuthenticated) {
    try {
      // Optionally verify token with a lightweight call, e.g. getMe()
      // But we might be offline, so we shouldn't force logout if this fails due to network.
      // apiService.getMe().catch(err => console.warn('Auth check failed', err));
    } catch (e) {
      console.warn('[AUTH_STORE] Failed to verify session on launch', e);
    }
  }
};

// Call initialization
initializeAuth();
