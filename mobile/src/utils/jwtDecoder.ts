/**
 * JWT Token Decoder Utility
 * Decodes JWT tokens without verification (for client-side use)
 */

export interface DecodedToken {
  userId: string;
  email: string;
  role: string;
  storeId: string;
  permissions: string[];
  iat?: number;
  exp?: number;
}

/**
 * Decode JWT token payload (without verification)
 * Note: This only decodes the payload, it does NOT verify the signature
 */
export function decodeJWT(token: string): DecodedToken | null {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('[JWT_DECODER] Invalid JWT format');
      return null;
    }

    // Decode base64url encoded payload
    const payload = parts[1];
    
    // Replace base64url characters with base64 characters
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    
    // Add padding if needed
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    
    // Decode base64 - use atob if available (web), otherwise use Buffer (React Native)
    let decoded: string;
    if (typeof atob !== 'undefined') {
      decoded = atob(padded);
    } else if (typeof Buffer !== 'undefined') {
      decoded = Buffer.from(padded, 'base64').toString('utf-8');
    } else {
      throw new Error('No base64 decoder available');
    }
    
    // Parse JSON
    const parsed = JSON.parse(decoded) as DecodedToken;
    
    return parsed;
  } catch (error) {
    console.error('[JWT_DECODER] Error decoding JWT:', error);
    return null;
  }
}

/**
 * Extract storeId from JWT token
 */
export function extractStoreIdFromToken(token: string): string | null {
  const decoded = decodeJWT(token);
  if (!decoded || !decoded.storeId) {
    return null;
  }
  
  // Validate storeId format
  if (!/^[0-9a-fA-F]{24}$/.test(decoded.storeId)) {
    console.warn('[JWT_DECODER] Invalid storeId format in token:', decoded.storeId);
    return null;
  }
  
  return decoded.storeId;
}

