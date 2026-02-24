/**
 * cryptoService.ts — OCT encryption / decryption
 *
 * Uses the Web Crypto API (globalThis.crypto.subtle), available in:
 *   - React Native 0.71+ (Hermes)
 *   - Expo SDK 50+
 *
 * Algorithm: PBKDF2 key derivation → AES-256-GCM encryption.
 *
 * The user's plaintext password is the sole trust anchor for offline access.
 * It is never stored anywhere — it is used only in-memory during the
 * login and offline login flows, then discarded.
 *
 * Wire format (base64): [12-byte IV | AES-GCM ciphertext + 16-byte auth tag]
 * The IV is random per encryption and prepended to the ciphertext, so
 * decryption needs only the password and the salt (stored in Secure Store).
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function encode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function decode(buf: ArrayBuffer): string {
  return new TextDecoder().decode(buf);
}

function bufToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToBuf(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns true if AES-GCM encryption is available in the current runtime.
 * On Hermes (RN 0.71+) and modern JSC this is always true.
 * Log a warning in __DEV__ if not — offline login encryption will be skipped.
 */
export function isCryptoAvailable(): boolean {
  return (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.subtle !== 'undefined'
  );
}

/**
 * Generate a 16-byte cryptographically random salt.
 *
 * Call once per user-device pair after a successful online login.
 * Store the result in Secure Store via authStorage.setUserOfflineSalt().
 *
 * Returns a base64 string for safe storage.
 */
export function generateSalt(): string {
  if (!isCryptoAvailable()) {
    throw new Error('[CryptoService] Web Crypto API not available — cannot generate salt');
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return bufToBase64(bytes);
}

/**
 * Derive an AES-256-GCM CryptoKey from a user password using PBKDF2.
 *
 * Parameters follow NIST SP 800-132 (2024) recommendations:
 *   - SHA-256 PRF
 *   - 100 000 iterations
 *   - 256-bit output
 *
 * The derived key is non-extractable and usable only for AES-GCM
 * encrypt/decrypt — it never leaves the JS engine.
 */
async function deriveKey(password: string, saltBase64: string): Promise<CryptoKey> {
  const subtle = globalThis.crypto.subtle;

  const passwordKey = await subtle.importKey(
    'raw',
    encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: base64ToBuf(saltBase64),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt an OCT JWT string using AES-256-GCM.
 *
 * @param octJwt     Plain JWT string from the server's login/refresh response.
 * @param password   The user's plaintext password (in-memory, never stored).
 * @param saltBase64 The per-user-per-device PBKDF2 salt from Secure Store.
 * @returns          Base64-encoded [IV (12 bytes) | ciphertext + auth tag].
 */
export async function encryptOCT(
  octJwt: string,
  password: string,
  saltBase64: string
): Promise<string> {
  if (!isCryptoAvailable()) {
    throw new Error('[CryptoService] Web Crypto API not available — cannot encrypt OCT');
  }

  const subtle = globalThis.crypto.subtle;
  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);

  const key = await deriveKey(password, saltBase64);
  const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, key, encode(octJwt));

  // Prepend IV: [iv (12 bytes)][ciphertext + auth tag (n + 16 bytes)]
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);

  return bufToBase64(combined);
}

/**
 * Decrypt an AES-256-GCM encrypted OCT blob.
 *
 * AES-GCM provides authenticated encryption — if the password is wrong or
 * the stored blob has been tampered with, decryption throws. Callers MUST
 * treat a thrown error as an incorrect password (increment attempt counter).
 *
 * @param encryptedBase64  The value from authStorage.getUserOfflineToken().
 * @param password         The user's plaintext password entered at login.
 * @param saltBase64       The per-user-per-device PBKDF2 salt from Secure Store.
 * @returns                The plain OCT JWT string.
 * @throws                 If the password is wrong or the ciphertext is corrupted.
 */
export async function decryptOCT(
  encryptedBase64: string,
  password: string,
  saltBase64: string
): Promise<string> {
  if (!isCryptoAvailable()) {
    throw new Error('[CryptoService] Web Crypto API not available — cannot decrypt OCT');
  }

  const subtle = globalThis.crypto.subtle;
  const combined = base64ToBuf(encryptedBase64);

  if (combined.byteLength <= 12) {
    throw new Error('[CryptoService] Encrypted OCT is malformed (too short)');
  }

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const key = await deriveKey(password, saltBase64);

  let plaintext: ArrayBuffer;
  try {
    plaintext = await subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  } catch {
    // AES-GCM throws DOMException on auth-tag mismatch — wrong password or tampered data.
    throw new Error('Decryption failed: incorrect password or corrupted session data');
  }

  return decode(plaintext);
}
