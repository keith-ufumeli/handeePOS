import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../services/apiService';
import syncService from '../services/syncService';

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
  login: (email: string, password: string) => Promise<void>;
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

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await apiService.login(email, password);
          
          if (response.success) {
            const { accessToken, user } = response.data;
            
            // Set auth token for API service and sync service
            apiService.setAuthToken(accessToken);
            syncService.setAuthToken(accessToken);
            
            set({
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } else {
            set({
              error: response.message || 'Login failed',
              isLoading: false,
            });
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Login failed',
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
          syncService.setAuthToken('');
          
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      refreshToken: async () => {
        try {
          const response = await apiService.refreshToken();
          
          if (response.success) {
            const { accessToken } = response.data;
            
            // Update auth token
            apiService.setAuthToken(accessToken);
            syncService.setAuthToken(accessToken);
          } else {
            // Token refresh failed, logout user
            get().logout();
          }
        } catch (error) {
          console.error('Token refresh error:', error);
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
