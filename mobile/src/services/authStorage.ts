/**
 * authStorage.ts
 *
 * Per-user namespaced storage for all auth-related secrets.
 *
 * Key schema (all keys stored in OS Secure Store):
 *   hpos_auth_{userId}_refresh      — encrypted refresh token
 *   hpos_auth_{userId}_oct          — encrypted Offline Capability Token
 *   hpos_auth_{userId}_salt         — PBKDF2 salt (base64) for OCT encryption key
 *   hpos_auth_{userId}_attempts     — consecutive failed offline login attempts (int as string)
 *   hpos_auth_{userId}_lock_until   — ISO timestamp; offline login blocked until this time
 *   hpos_auth_{userId}_last_online  — ISO timestamp of last confirmed online auth
 *
 * Device-level (shared across all users on this device):
 *   hpos_known_users                — JSON array of userIds with prior auth records
 *
 * Key character set: [a-zA-Z0-9._-] — safe for expo-secure-store on all platforms.
 * Max key length: 128 chars. MongoDB ObjectId userIds are 24 hex chars,
 * so the longest key ("hpos_auth_{24chars}_lock_until") = 39 chars — well within limit.
 *
 * NOTE: Encryption of the OCT and the refresh token is implemented in P4.
 *       These helpers work with whatever string values are provided; they do
 *       not perform encryption themselves.
 */

import secureStorage from './secureStorage';

// ─── Key builders ─────────────────────────────────────────────────────────────

const KNOWN_USERS_KEY = 'hpos_known_users';

function userKey(userId: string, field: string): string {
  return `hpos_auth_${userId}_${field}`;
}

// ─── Known-users index ─────────────────────────────────────────────────────────

/**
 * Returns all userIds that have prior auth records on this device.
 * Used to populate the login screen's user selector on a shared POS tablet.
 */
export async function getKnownUsers(): Promise<string[]> {
  const raw = await secureStorage.getItem(KNOWN_USERS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

/**
 * Adds a userId to the known-users index (idempotent).
 */
export async function addKnownUser(userId: string): Promise<void> {
  const users = await getKnownUsers();
  if (!users.includes(userId)) {
    await secureStorage.setItem(KNOWN_USERS_KEY, JSON.stringify([...users, userId]));
  }
}

/**
 * Removes a userId from the known-users index.
 * Call this when completely wiping a user's session from the device.
 */
export async function removeKnownUser(userId: string): Promise<void> {
  const users = await getKnownUsers();
  const updated = users.filter((id) => id !== userId);
  await secureStorage.setItem(KNOWN_USERS_KEY, JSON.stringify(updated));
}

// ─── Refresh token ─────────────────────────────────────────────────────────────

/**
 * Stores the (encrypted) refresh token for a user.
 * In P4 this will receive an AES-256-encrypted ciphertext; for now it
 * accepts the raw token string so earlier phases can function end-to-end.
 */
export async function setUserRefreshToken(userId: string, token: string): Promise<void> {
  await secureStorage.setItem(userKey(userId, 'refresh'), token);
}

export async function getUserRefreshToken(userId: string): Promise<string | null> {
  return secureStorage.getItem(userKey(userId, 'refresh'));
}

export async function clearUserRefreshToken(userId: string): Promise<void> {
  await secureStorage.removeItem(userKey(userId, 'refresh'));
}

// ─── Offline Capability Token (OCT) ───────────────────────────────────────────

/**
 * Stores the (encrypted) OCT for a user.
 * In P4 this will be the AES-256 ciphertext produced by encrypting the raw
 * OCT JWT with a PBKDF2-derived key from the user's password.
 */
export async function setUserOfflineToken(userId: string, encryptedOCT: string): Promise<void> {
  await secureStorage.setItem(userKey(userId, 'oct'), encryptedOCT);
}

export async function getUserOfflineToken(userId: string): Promise<string | null> {
  return secureStorage.getItem(userKey(userId, 'oct'));
}

export async function clearUserOfflineToken(userId: string): Promise<void> {
  await secureStorage.removeItem(userKey(userId, 'oct'));
}

// ─── PBKDF2 salt ───────────────────────────────────────────────────────────────

/**
 * Stores the per-user-per-device PBKDF2 salt used to derive the OCT
 * encryption key from the user's password. Generated once per device
 * and never transmitted to the server.
 */
export async function setUserOfflineSalt(userId: string, salt: string): Promise<void> {
  await secureStorage.setItem(userKey(userId, 'salt'), salt);
}

export async function getUserOfflineSalt(userId: string): Promise<string | null> {
  return secureStorage.getItem(userKey(userId, 'salt'));
}

// ─── Offline attempt counter ───────────────────────────────────────────────────

/**
 * Number of consecutive failed offline login attempts.
 * Capped at MAX_OFFLINE_ATTEMPTS in the offline login flow (P6).
 */
export async function setUserOfflineAttempts(userId: string, count: number): Promise<void> {
  await secureStorage.setItem(userKey(userId, 'attempts'), String(count));
}

export async function getUserOfflineAttempts(userId: string): Promise<number> {
  const raw = await secureStorage.getItem(userKey(userId, 'attempts'));
  return raw ? parseInt(raw, 10) : 0;
}

export async function incrementUserOfflineAttempts(userId: string): Promise<number> {
  const current = await getUserOfflineAttempts(userId);
  const next = current + 1;
  await setUserOfflineAttempts(userId, next);
  return next;
}

export async function resetUserOfflineAttempts(userId: string): Promise<void> {
  await secureStorage.removeItem(userKey(userId, 'attempts'));
}

// ─── Lockout timestamp ─────────────────────────────────────────────────────────

/**
 * ISO timestamp string. Offline login is blocked until this time has passed.
 * Set after MAX_OFFLINE_ATTEMPTS consecutive failures; cleared on success
 * or after the lockout duration expires.
 */
export async function setUserOfflineLockUntil(userId: string, isoTimestamp: string): Promise<void> {
  await secureStorage.setItem(userKey(userId, 'lock_until'), isoTimestamp);
}

export async function getUserOfflineLockUntil(userId: string): Promise<string | null> {
  return secureStorage.getItem(userKey(userId, 'lock_until'));
}

/**
 * Returns true if the user is currently in a lockout period.
 */
export async function isUserOfflineLocked(userId: string): Promise<boolean> {
  const lockUntil = await getUserOfflineLockUntil(userId);
  if (!lockUntil) return false;
  return new Date(lockUntil) > new Date();
}

export async function clearUserOfflineLock(userId: string): Promise<void> {
  await secureStorage.removeItem(userKey(userId, 'lock_until'));
}

// ─── Last online auth timestamp ────────────────────────────────────────────────

/**
 * ISO timestamp of the most recent successful online authentication for
 * this user on this device. Its presence is the eligibility signal that
 * proves the device has a prior auth record and is allowed offline login.
 */
export async function setUserLastOnlineAuth(userId: string, isoTimestamp: string): Promise<void> {
  await secureStorage.setItem(userKey(userId, 'last_online'), isoTimestamp);
}

export async function getUserLastOnlineAuth(userId: string): Promise<string | null> {
  return secureStorage.getItem(userKey(userId, 'last_online'));
}

/**
 * Returns true if this userId has a prior online auth record on this device.
 * Used as the first eligibility check in the offline login flow.
 */
export async function hasUserPriorAuth(userId: string): Promise<boolean> {
  const lastOnline = await getUserLastOnlineAuth(userId);
  return lastOnline !== null;
}

// ─── Per-user display profile ──────────────────────────────────────────────────

/**
 * Minimal non-sensitive profile stored per user for the shared device user selector (P7-01).
 * Stored alongside other per-user keys in Secure Store.
 */
export interface UserProfile {
  email: string;
  fullName: string;
}

/**
 * Stores the display profile for a user (email + fullName).
 * Called after a successful online login so the user selector can show
 * human-readable identities without loading them from the server.
 */
export async function setUserProfile(userId: string, profile: UserProfile): Promise<void> {
  await secureStorage.setItem(userKey(userId, 'profile'), JSON.stringify(profile));
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const raw = await secureStorage.getItem(userKey(userId, 'profile'));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

// ─── Session teardown ──────────────────────────────────────────────────────────

/**
 * Removes all per-user auth keys from Secure Store.
 * Used on logout, INVALIDATED state, or admin-forced session wipe.
 * Does NOT remove the userId from the known-users index — that is the
 * caller's responsibility (call removeKnownUser if a full device wipe
 * is intended).
 */
export async function clearUserSession(userId: string): Promise<void> {
  const fields = ['refresh', 'oct', 'salt', 'attempts', 'lock_until', 'last_online', 'profile'];
  await Promise.all(fields.map((field) => secureStorage.removeItem(userKey(userId, field))));
}
