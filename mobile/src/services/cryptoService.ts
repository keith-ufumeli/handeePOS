/**
 * cryptoService.ts — OCT encryption / decryption + signature verification
 *
 * Uses the Web Crypto API (globalThis.crypto.subtle), available in:
 *   - React Native 0.71+ (Hermes)
 *   - Expo SDK 50+
 *
 * Algorithms:
 *   - PBKDF2 (100k iterations) → AES-256-GCM  — for encrypting OCTs at rest
 *   - ECDSA P-256 (ES256)                      — for verifying OCT server signatures (P8-02)
 *
 * Wire format (base64): [12-byte IV | AES-GCM ciphertext + 16-byte auth tag]
 *
 * P8-02: OCT_SIGNING_PUBLIC_KEY_JWK
 *   The server's ECDSA public key in JWK format.
 *   Generate a keypair with: cd backend && npx ts-node scripts/generate-oct-keys.ts
 *   Then replace the null below with the JWK output and commit the mobile change.
 *   The private key stays in the backend .env (OCT_EC_PRIVATE_KEY_PEM).
 *   When null, ECDSA verification is skipped (HMAC mode / key not yet deployed).
 */

/**
 * Embedded ECDSA P-256 public key for verifying OCT server signatures.
 *
 * HOW TO SET THIS:
 *   1. Run: cd backend && npx ts-node scripts/generate-oct-keys.ts
 *   2. Copy the JWK block printed to console.
 *   3. Replace `null` below with the JWK object.
 *   4. Set OCT_EC_PRIVATE_KEY_PEM + OCT_EC_PUBLIC_KEY_PEM in backend .env.
 *
 * While null, OCTs are verified via the server during PENDING_SYNC only (HMAC mode).
 */
const OCT_SIGNING_PUBLIC_KEY_JWK: JsonWebKey | null = null;

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

// ─── P8-02: OCT Signature Verification ────────────────────────────────────────

/**
 * Verify the ECDSA P-256 signature of an Offline Capability Token.
 *
 * A JWT has three base64url-encoded segments: header.payload.signature
 * The signature covers `{header}.{payload}` (as ASCII bytes).
 *
 * Returns:
 *   - `true`  — signature is valid, or no public key is embedded (soft pass)
 *   - `false` — signature verification explicitly failed (tampered token)
 *
 * This function NEVER throws. Callers should treat `false` as a hard failure
 * (transition to INVALIDATED) and `true` as a pass.
 */
export async function verifyOCTSignature(octJwt: string): Promise<boolean> {
  if (!OCT_SIGNING_PUBLIC_KEY_JWK) {
    // No embedded public key — HMAC mode or key not yet deployed.
    // Skip client-side ECDSA verification (server validates on PENDING_SYNC).
    return true;
  }

  if (!isCryptoAvailable()) {
    console.warn('[CryptoService] Web Crypto unavailable — cannot verify OCT signature');
    return true;
  }

  try {
    const parts = octJwt.split('.');
    if (parts.length !== 3) return false;

    const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

    // The signed data is the ASCII bytes of "header.payload"
    const signedData = encode(`${headerB64}.${payloadB64}`);

    // JWT uses base64url encoding for the signature
    const signatureBytes = base64UrlToBuf(signatureB64);

    // Import the embedded public key as an ECDSA P-256 key
    const publicKey = await globalThis.crypto.subtle.importKey(
      'jwk',
      OCT_SIGNING_PUBLIC_KEY_JWK,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );

    // ES256 signatures are DER-encoded; JWT uses raw (r || s) format — convert
    const rawSignature = derSignatureToRaw(signatureBytes);

    const isValid = await globalThis.crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      rawSignature,
      signedData
    );

    if (!isValid) {
      console.warn('[CryptoService] OCT signature verification failed — token may be tampered');
    }

    return isValid;
  } catch (err) {
    console.error('[CryptoService] OCT signature verification error:', err);
    return false;
  }
}

/**
 * Convert a base64url string to a Uint8Array.
 * JWT uses base64url (no padding, + → -, / → _).
 */
function base64UrlToBuf(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return base64ToBuf(padded);
}

/**
 * Convert a DER-encoded ECDSA signature to the raw (r || s) format expected by Web Crypto.
 *
 * JSON Web Algorithms (RFC 7518) specifies that ES256 signatures in JWTs use
 * the raw (r || s) format (two 32-byte big-endian integers, concatenated).
 * Node.js/OpenSSL produces DER-encoded signatures. Web Crypto requires raw format.
 *
 * If the input is already 64 bytes (raw format from some issuers), returns as-is.
 */
function derSignatureToRaw(der: Uint8Array): Uint8Array {
  // Raw format is always exactly 64 bytes for P-256
  if (der.length === 64) return der;

  // Parse DER SEQUENCE { INTEGER r, INTEGER s }
  // Format: 0x30 [len] 0x02 [rLen] [r bytes] 0x02 [sLen] [s bytes]
  try {
    let offset = 2; // skip 0x30 and sequence length
    if (der[offset] !== 0x02) throw new Error('Invalid DER: expected INTEGER tag for r');
    offset++;
    const rLen = der[offset]!;
    offset++;
    // Strip leading 0x00 padding byte (added when high bit of r is set)
    const rStart = rLen === 33 ? offset + 1 : offset;
    const r = der.slice(rStart, rStart + 32);
    offset += rLen;

    if (der[offset] !== 0x02) throw new Error('Invalid DER: expected INTEGER tag for s');
    offset++;
    const sLen = der[offset]!;
    offset++;
    const sStart = sLen === 33 ? offset + 1 : offset;
    const s = der.slice(sStart, sStart + 32);

    const raw = new Uint8Array(64);
    raw.set(r, 0);
    raw.set(s, 32);
    return raw;
  } catch {
    // If parsing fails, return as-is and let Web Crypto reject it
    return der;
  }
}
