import secureStorage from '../services/secureStorage';

// Key is short and matches expo-secure-store allowed chars: [a-zA-Z0-9._-]
const DEVICE_ID_KEY = 'hpos_device_id';

/**
 * Returns a stable device identifier for this install.
 *
 * Stored in OS Secure Store (Keychain on iOS, Keystore on Android) so it
 * survives app restarts but is scoped to this installation. The device ID
 * is not sensitive by itself but keeping it in Secure Store avoids it being
 * readable from standard storage backups.
 *
 * Format: timestamp_base36 - random_a - random_b - random_c
 * e.g. "lnxk2f8a-4z9mq2r-3ywv8kp-2mxn1aq"
 */
export async function getOrCreateDeviceId(): Promise<string> {
  try {
    const existing = await secureStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.length > 0) {
      return existing;
    }
  } catch {
    // ignore read errors — we'll generate a new ID below
  }

  const timestamp = Date.now().toString(36);
  const r = () => Math.random().toString(36).substring(2, 9);
  const newId = `${timestamp}-${r()}-${r()}-${r()}`;

  try {
    await secureStorage.setItem(DEVICE_ID_KEY, newId);
  } catch {
    // persist failed — return the generated ID anyway so the caller can proceed
  }

  return newId;
}
