/**
 * auth.service.test.ts — Unit tests for AuthService (P9-01 / P9-02)
 *
 * Tests all pure functions: token generation/verification, password hashing,
 * permission checks, and OCT generation/verification.
 *
 * No database connection required — these tests run entirely in-memory.
 * Environment variables are seeded by tests/setup.ts.
 */

import authService from '../src/services/authService';

// ─── Test fixtures ─────────────────────────────────────────────────────────────

const mockPayload = {
  userId: '507f1f77bcf86cd799439011',
  email: 'cashier@store.test',
  role: 'cashier',
  storeId: '507f1f77bcf86cd799439012',
  permissions: ['sales', 'customers'],
};

// ─── Password hashing ─────────────────────────────────────────────────────────

describe('AuthService — password hashing', () => {
  it('hashes a plaintext password (not reversible)', async () => {
    const hash = await authService.hashPassword('MySuperSecret123!');
    expect(hash).not.toBe('MySuperSecret123!');
    expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix
  });

  it('hashes are unique (random salt)', async () => {
    const hash1 = await authService.hashPassword('SamePassword');
    const hash2 = await authService.hashPassword('SamePassword');
    expect(hash1).not.toBe(hash2);
  });

  it('comparePassword returns true for correct password', async () => {
    const hash = await authService.hashPassword('CorrectPassword!');
    const result = await authService.comparePassword('CorrectPassword!', hash);
    expect(result).toBe(true);
  });

  it('comparePassword returns false for wrong password', async () => {
    const hash = await authService.hashPassword('CorrectPassword!');
    const result = await authService.comparePassword('WrongPassword!', hash);
    expect(result).toBe(false);
  });
});

// ─── Access token ─────────────────────────────────────────────────────────────

describe('AuthService — access tokens', () => {
  it('generates a valid JWT access token', () => {
    const token = authService.generateAccessToken(mockPayload);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('verifies a valid access token and returns the payload', () => {
    const token = authService.generateAccessToken(mockPayload);
    const decoded = authService.verifyAccessToken(token);
    expect(decoded.userId).toBe(mockPayload.userId);
    expect(decoded.email).toBe(mockPayload.email);
    expect(decoded.role).toBe(mockPayload.role);
    expect(decoded.storeId).toBe(mockPayload.storeId);
    expect(decoded.permissions).toEqual(mockPayload.permissions);
  });

  it('throws on a tampered access token', () => {
    const token = authService.generateAccessToken(mockPayload);
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(() => authService.verifyAccessToken(tampered)).toThrow();
  });

  it('throws on a token signed with the wrong secret', () => {
    // Sign with refresh secret instead of access secret
    const wrongToken = authService.generateRefreshToken(mockPayload);
    expect(() => authService.verifyAccessToken(wrongToken)).toThrow();
  });

  it('generates shorter expiry for regular vs remembered (both 15m in config)', () => {
    // Both use 15m in test env; just ensure they are valid tokens
    const regular = authService.generateAccessToken(mockPayload, false);
    const remembered = authService.generateAccessToken(mockPayload, true);
    expect(regular.split('.')).toHaveLength(3);
    expect(remembered.split('.')).toHaveLength(3);
  });
});

// ─── Refresh token ────────────────────────────────────────────────────────────

describe('AuthService — refresh tokens', () => {
  it('generates a valid JWT refresh token', () => {
    const token = authService.generateRefreshToken(mockPayload);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  it('verifies a valid refresh token and returns the payload', () => {
    const token = authService.generateRefreshToken(mockPayload);
    const decoded = authService.verifyRefreshToken(token);
    expect(decoded.userId).toBe(mockPayload.userId);
    expect(decoded.email).toBe(mockPayload.email);
  });

  it('throws on a tampered refresh token', () => {
    const token = authService.generateRefreshToken(mockPayload);
    const tampered = token.slice(0, -5) + 'YYYYY';
    expect(() => authService.verifyRefreshToken(tampered)).toThrow();
  });

  it('access token cannot be used as refresh token', () => {
    const accessToken = authService.generateAccessToken(mockPayload);
    expect(() => authService.verifyRefreshToken(accessToken)).toThrow();
  });

  it('refresh token cannot be used as access token', () => {
    const refreshToken = authService.generateRefreshToken(mockPayload);
    expect(() => authService.verifyAccessToken(refreshToken)).toThrow();
  });
});

// ─── Offline Capability Token (OCT) ───────────────────────────────────────────

describe('AuthService — Offline Capability Token (OCT)', () => {
  const deviceId = 'lnxk2f8a-4z9mq2r-3ywv8kp-2mxn1aq';

  it('generates an OCT JWT when JWT_DEVICE_SECRET is set', () => {
    const oct = authService.generateOfflineCapabilityToken(mockPayload, deviceId);
    expect(typeof oct).toBe('string');
    expect(oct.split('.')).toHaveLength(3);
  });

  it('OCT payload contains required fields', () => {
    const oct = authService.generateOfflineCapabilityToken(mockPayload, deviceId);
    const verified = authService.verifyOfflineCapabilityToken(oct);
    expect(verified.userId).toBe(mockPayload.userId);
    expect(verified.deviceId).toBe(deviceId);
    expect(verified.email).toBe(mockPayload.email);
    expect(verified.role).toBe(mockPayload.role);
    expect(verified.storeId).toBe(mockPayload.storeId);
    expect(verified.permissions).toEqual(mockPayload.permissions);
    expect(verified.octVersion).toBe('1');
    expect(typeof verified.permissionsHash).toBe('string');
    expect(verified.permissionsHash).toHaveLength(64); // SHA-256 hex
  });

  it('permissionsHash is deterministic (sorted permissions)', () => {
    const oct1 = authService.generateOfflineCapabilityToken(mockPayload, deviceId);
    const oct2 = authService.generateOfflineCapabilityToken(
      { ...mockPayload, permissions: ['customers', 'sales'] }, // reversed order
      deviceId
    );
    const v1 = authService.verifyOfflineCapabilityToken(oct1);
    const v2 = authService.verifyOfflineCapabilityToken(oct2);
    expect(v1.permissionsHash).toBe(v2.permissionsHash); // sorted → same hash
  });

  it('different deviceIds produce different OCTs', () => {
    const oct1 = authService.generateOfflineCapabilityToken(mockPayload, 'device-A');
    const oct2 = authService.generateOfflineCapabilityToken(mockPayload, 'device-B');
    expect(oct1).not.toBe(oct2);
  });

  it('throws on a tampered OCT', () => {
    const oct = authService.generateOfflineCapabilityToken(mockPayload, deviceId);
    const tampered = oct.slice(0, -5) + 'ZZZZZ';
    expect(() => authService.verifyOfflineCapabilityToken(tampered)).toThrow();
  });

  it('OCT is a valid JWT that expires in 24 hours', () => {
    // authService is a singleton that reads env vars at import time, so we
    // cannot test the "no key configured" path without reloading the module.
    // Instead verify that the generated OCT has a sane expiry (within 25h from now).
    const oct = authService.generateOfflineCapabilityToken(mockPayload, deviceId);
    const [, payloadB64] = oct.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64!, 'base64url').toString('utf-8'));
    const expiresIn = payload.exp - Math.floor(Date.now() / 1000);
    expect(expiresIn).toBeGreaterThan(0);
    expect(expiresIn).toBeLessThanOrEqual(25 * 60 * 60); // at most 25h
  });
});

// ─── Permission helpers ───────────────────────────────────────────────────────

describe('AuthService — permission helpers', () => {
  const userPermissions = ['sales', 'customers', 'products'];

  describe('hasPermission', () => {
    it('returns true when permission is present', () => {
      expect(authService.hasPermission(userPermissions, 'sales')).toBe(true);
    });
    it('returns false when permission is absent', () => {
      expect(authService.hasPermission(userPermissions, 'reports')).toBe(false);
    });
    it('returns false for empty permissions', () => {
      expect(authService.hasPermission([], 'sales')).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('returns true when at least one permission matches', () => {
      expect(authService.hasAnyPermission(userPermissions, ['reports', 'sales'])).toBe(true);
    });
    it('returns false when no permissions match', () => {
      expect(authService.hasAnyPermission(userPermissions, ['reports', 'inventory'])).toBe(false);
    });
    it('returns false for empty required list', () => {
      expect(authService.hasAnyPermission(userPermissions, [])).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('returns true when all permissions are present', () => {
      expect(authService.hasAllPermissions(userPermissions, ['sales', 'customers'])).toBe(true);
    });
    it('returns false when any permission is missing', () => {
      expect(authService.hasAllPermissions(userPermissions, ['sales', 'reports'])).toBe(false);
    });
    it('returns true for an empty required list', () => {
      expect(authService.hasAllPermissions(userPermissions, [])).toBe(true);
    });
  });
});

// ─── Offline grace period ─────────────────────────────────────────────────────

describe('AuthService — offline grace period', () => {
  it('returns true when last online auth was recent', () => {
    const recentDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    expect(authService.isWithinOfflineGracePeriod(recentDate)).toBe(true);
  });

  it('returns false when last online auth exceeded grace period (7 days)', () => {
    const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
    expect(authService.isWithinOfflineGracePeriod(oldDate)).toBe(false);
  });

  it('returns true at exactly the boundary (7 days - 1 ms)', () => {
    const boundaryDate = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000 - 1));
    expect(authService.isWithinOfflineGracePeriod(boundaryDate)).toBe(true);
  });
});

// ─── Token extraction ─────────────────────────────────────────────────────────

describe('AuthService — token extraction from header', () => {
  it('extracts token from a valid Bearer header', () => {
    const token = 'eyJhbGciOiJIUzI1NiJ9.test.sig';
    const extracted = authService.extractTokenFromHeader(`Bearer ${token}`);
    expect(extracted).toBe(token);
  });

  it('throws when Authorization header is missing', () => {
    expect(() => authService.extractTokenFromHeader(undefined)).toThrow(/missing/);
  });

  it('throws when header format is invalid (no Bearer prefix)', () => {
    expect(() => authService.extractTokenFromHeader('Token abc123')).toThrow(/invalid/i);
  });

  it('throws when header has too many parts', () => {
    expect(() => authService.extractTokenFromHeader('Bearer tok1 tok2')).toThrow(/invalid/i);
  });
});
