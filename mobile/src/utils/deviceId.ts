import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'handeepos_device_id';

/**
 * Returns a stable device identifier for this install.
 * Persisted in AsyncStorage; created on first call.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.length > 0) {
      return existing;
    }
  } catch {
    // ignore read errors
  }
  const newId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  try {
    await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
  } catch {
    // return id even if persist failed
  }
  return newId;
}
