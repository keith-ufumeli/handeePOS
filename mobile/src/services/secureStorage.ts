import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Service to handle secure storage of sensitive data like tokens.
 * Uses expo-secure-store on native platforms and AsyncStorage on web.
 */
class SecureStorageService {
  private isWeb: boolean;

  constructor() {
    this.isWeb = Platform.OS === 'web';
  }

  /**
   * Save a value to secure storage
   * @param key Storage key
   * @param value Value to store
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (this.isWeb) {
        await AsyncStorage.setItem(key, value);
      } else {
        await SecureStore.setItemAsync(key, value);
      }
    } catch (error) {
      console.error(`[SecureStorage] Error setting item ${key}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve a value from secure storage
   * @param key Storage key
   * @returns The stored value or null if not found
   */
  async getItem(key: string): Promise<string | null> {
    try {
      if (this.isWeb) {
        return await AsyncStorage.getItem(key);
      } else {
        return await SecureStore.getItemAsync(key);
      }
    } catch (error) {
      console.error(`[SecureStorage] Error getting item ${key}:`, error);
      return null;
    }
  }

  /**
   * Remove a value from secure storage
   * @param key Storage key
   */
  async removeItem(key: string): Promise<void> {
    try {
      if (this.isWeb) {
        await AsyncStorage.removeItem(key);
      } else {
        await SecureStore.deleteItemAsync(key);
      }
    } catch (error) {
      console.error(`[SecureStorage] Error removing item ${key}:`, error);
      throw error;
    }
  }
}

export default new SecureStorageService();
