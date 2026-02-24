import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { IUser } from '@/models/User';
import RefreshToken, { IRefreshToken } from '@/models/RefreshToken';
import logger from '@/utils/logger';
import mongoose from 'mongoose';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  storeId: string;
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Offline Capability Token payload.
 * Issued by the server and signed with JWT_DEVICE_SECRET.
 * The mobile client encrypts this before storage (P4).
 */
export interface OctPayload {
  userId: string;
  deviceId: string;
  email: string;
  role: string;
  storeId: string;
  permissions: string[];
  /** SHA-256 of JSON.stringify(permissions.sort()) — detects permission changes offline */
  permissionsHash: string;
  octVersion: string;
}

class AuthService {
  private readonly JWT_SECRET = process.env['JWT_SECRET'] || 'your-secret-key';
  private readonly JWT_REFRESH_SECRET = process.env['JWT_REFRESH_SECRET'] || 'your-refresh-secret-key';
  private readonly JWT_DEVICE_SECRET = process.env['JWT_DEVICE_SECRET'];
  // Short-lived access tokens — offline access is handled by the Offline Capability Token (OCT), not long-lived JWTs
  private readonly ACCESS_TOKEN_EXPIRES_IN = process.env['JWT_EXPIRES_IN'] || '15m';
  private readonly ACCESS_TOKEN_EXPIRES_IN_REMEMBERED = process.env['JWT_EXPIRES_IN_REMEMBERED'] || '15m';
  private readonly REFRESH_TOKEN_EXPIRES_IN = process.env['JWT_REFRESH_EXPIRES_IN'] || '7d';
  private readonly REFRESH_TOKEN_EXPIRES_IN_REMEMBERED = process.env['JWT_REFRESH_EXPIRES_IN_REMEMBERED'] || '30d';
  // OCT: 24 hours — bounds the revocation risk window to one business day
  private readonly OCT_EXPIRES_IN = process.env['JWT_OCT_EXPIRES_IN'] || '24h';
  private readonly DEVICE_TOKEN_EXPIRES_IN = process.env['JWT_DEVICE_EXPIRES_IN'] || '365d';
  private readonly OFFLINE_GRACE_PERIOD_DAYS = 7;

  /**
   * Hash password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Compare password with hash
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    logger.info('[AUTH_SERVICE] Comparing password');
    try {
      const isValid = await bcrypt.compare(password, hash);
      logger.info('[AUTH_SERVICE] Password comparison result:', { isValid });
      return isValid;
    } catch (error) {
      logger.error('[AUTH_SERVICE] Password comparison error:', error);
      throw error;
    }
  }

  /**
   * Generate access token
   */
  generateAccessToken(payload: TokenPayload, rememberMe: boolean = false): string {
    const expiresIn = rememberMe ? this.ACCESS_TOKEN_EXPIRES_IN_REMEMBERED : this.ACCESS_TOKEN_EXPIRES_IN;
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn,
      issuer: 'handeepos-api',
      audience: 'handeepos-mobile'
    } as SignOptions);
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(payload: TokenPayload, rememberMe: boolean = false): string {
    const expiresIn = rememberMe ? this.REFRESH_TOKEN_EXPIRES_IN_REMEMBERED : this.REFRESH_TOKEN_EXPIRES_IN;
    return jwt.sign(payload, this.JWT_REFRESH_SECRET, {
      expiresIn,
      issuer: 'handeepos-api',
      audience: 'handeepos-mobile'
    } as SignOptions);
  }

  /**
   * Generate both access and refresh tokens
   */
  generateTokens(user: IUser, rememberMe: boolean = false): AuthTokens {
    logger.info('[AUTH_SERVICE] Generating tokens', {
      userId: user._id.toString(),
      email: user.email,
      rememberMe,
      storeIdType: typeof user.storeId,
      storeIdValue: user.storeId
    });

    // Extract storeId properly - handle both ObjectId and populated Store document
    let storeIdString: string;
    if (!user.storeId) {
      throw new Error('Store ID is required');
    } else if (typeof user.storeId === 'object' && '_id' in user.storeId) {
      // Handle populated Store document
      storeIdString = (user.storeId as any)._id.toString();
    } else if (typeof user.storeId === 'object' && 'toString' in user.storeId) {
      // Handle ObjectId instance
      storeIdString = (user.storeId as any).toString();
    } else if (typeof user.storeId === 'string') {
      // Handle string (shouldn't happen but be safe)
      storeIdString = user.storeId;
    } else {
      throw new Error('Invalid storeId format');
    }

    // Validate storeId is a valid MongoDB ObjectId format
    if (!/^[0-9a-fA-F]{24}$/.test(storeIdString)) {
      logger.error('[AUTH_SERVICE] Invalid storeId format in token generation', {
        storeIdString,
        storeIdType: typeof user.storeId,
        storeIdValue: user.storeId
      });
      throw new Error('Invalid storeId format');
    }

    const payload: TokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      storeId: storeIdString,
      permissions: user.permissions
    };

    try {
      const accessToken = this.generateAccessToken(payload, rememberMe);
      const refreshToken = this.generateRefreshToken(payload, rememberMe);
      
      logger.info('[AUTH_SERVICE] Tokens generated successfully', {
        accessTokenLength: accessToken.length,
        refreshTokenLength: refreshToken.length,
        expiresIn: rememberMe ? this.ACCESS_TOKEN_EXPIRES_IN_REMEMBERED : this.ACCESS_TOKEN_EXPIRES_IN
      });

      return {
        accessToken,
        refreshToken
      };
    } catch (error) {
      logger.error('[AUTH_SERVICE] Token generation error:', error);
      throw error;
    }
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): TokenPayload {
    logger.info('[AUTH_SERVICE] Verifying access token');
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as TokenPayload;
      logger.info('[AUTH_SERVICE] Access token verified successfully', {
        userId: decoded.userId,
        email: decoded.email
      });
      return decoded;
    } catch (error) {
      logger.error('[AUTH_SERVICE] Access token verification failed:', {
        error: error instanceof Error ? error.message : String(error),
        tokenLength: token.length
      });
      throw new Error('Invalid access token');
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): TokenPayload {
    logger.info('[AUTH_SERVICE] Verifying refresh token');
    try {
      const decoded = jwt.verify(token, this.JWT_REFRESH_SECRET) as TokenPayload;
      logger.info('[AUTH_SERVICE] Refresh token verified successfully', {
        userId: decoded.userId,
        email: decoded.email
      });
      return decoded;
    } catch (error) {
      logger.error('[AUTH_SERVICE] Refresh token verification failed:', {
        error: error instanceof Error ? error.message : String(error),
        tokenLength: token.length
      });
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Generate device token
   */
  generateDeviceToken(payload: TokenPayload): string {
    if (!this.JWT_DEVICE_SECRET) {
      throw new Error('JWT_DEVICE_SECRET is not configured');
    }
    logger.info('[AUTH_SERVICE] Generating device token', {
      userId: payload.userId,
      email: payload.email
    });
    return jwt.sign(payload, this.JWT_DEVICE_SECRET, {
      expiresIn: this.DEVICE_TOKEN_EXPIRES_IN,
      issuer: 'handeepos-api',
      audience: 'handeepos-mobile'
    } as SignOptions);
  }

  /**
   * Verify device token
   */
  verifyDeviceToken(token: string): TokenPayload {
    if (!this.JWT_DEVICE_SECRET) {
      throw new Error('JWT_DEVICE_SECRET is not configured');
    }
    logger.info('[AUTH_SERVICE] Verifying device token');
    try {
      const decoded = jwt.verify(token, this.JWT_DEVICE_SECRET) as TokenPayload;
      logger.info('[AUTH_SERVICE] Device token verified successfully', {
        userId: decoded.userId,
        email: decoded.email
      });
      return decoded;
    } catch (error) {
      logger.error('[AUTH_SERVICE] Device token verification failed:', {
        error: error instanceof Error ? error.message : String(error),
        tokenLength: token.length
      });
      throw new Error('Invalid device token');
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader: string | undefined): string {
    if (!authHeader) {
      throw new Error('Authorization header is missing');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new Error('Invalid authorization header format');
    }

    return parts[1] || '';
  }

  /**
   * Check if user has required permission
   */
  hasPermission(userPermissions: string[], requiredPermission: string): boolean {
    return userPermissions.includes(requiredPermission);
  }

  /**
   * Check if user has any of the required permissions
   */
  hasAnyPermission(userPermissions: string[], requiredPermissions: string[]): boolean {
    return requiredPermissions.some(permission => 
      userPermissions.includes(permission)
    );
  }

  /**
   * Check if user has all required permissions
   */
  hasAllPermissions(userPermissions: string[], requiredPermissions: string[]): boolean {
    return requiredPermissions.every(permission => 
      userPermissions.includes(permission)
    );
  }

  /**
   * Generate password reset token
   */
  async generatePasswordResetToken(_user: IUser): Promise<string> {
    const resetToken = crypto.randomBytes(32).toString('hex');
    return resetToken;
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    // TODO: Implement email sending logic
    // For now, just log the reset link
    const resetLink = `${process.env['FRONTEND_URL']}/reset-password?token=${token}`;
    logger.info(`Password reset link for ${email}: ${resetLink}`);
  }

  /**
   * Store refresh token in database
   */
  async storeRefreshToken(
    token: string,
    userId: mongoose.Types.ObjectId,
    expiresIn: string,
    deviceInfo?: {
      deviceId?: string;
      deviceName?: string;
      platform?: string;
      appVersion?: string;
    },
    ipAddress?: string,
    userAgent?: string
  ): Promise<IRefreshToken> {
    // Parse expiration time
    const expiresAt = this.parseExpirationTime(expiresIn);

    const refreshToken = await RefreshToken.create({
      token,
      userId,
      deviceInfo,
      expiresAt,
      ipAddress,
      userAgent,
    });

    logger.info('[AUTH_SERVICE] Refresh token stored', {
      tokenId: refreshToken._id,
      userId,
      expiresAt,
    });

    return refreshToken;
  }

  /**
   * Validate and rotate refresh token
   * Returns new tokens if valid, throws error if invalid/revoked
   */
  async validateAndRotateRefreshToken(
    token: string,
    deviceInfo?: {
      deviceId?: string;
      deviceName?: string;
      platform?: string;
      appVersion?: string;
    },
    ipAddress?: string,
    userAgent?: string
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    isRemembered: boolean;
    payload: TokenPayload;
    resolvedDeviceId: string | undefined;
  }> {
    logger.info('[AUTH_SERVICE] Validating and rotating refresh token');

    // Verify JWT signature and expiration
    const payload = this.verifyRefreshToken(token);

    // Check if token exists in database and is valid
    const storedToken = await RefreshToken.findOne({ token, isRevoked: false });

    if (!storedToken) {
      logger.warn('[AUTH_SERVICE] Refresh token not found or revoked', { userId: payload.userId });
      throw new Error('Invalid or revoked refresh token');
    }

    if (!storedToken.isValid()) {
      logger.warn('[AUTH_SERVICE] Refresh token expired', {
        tokenId: storedToken._id,
        expiresAt: storedToken.expiresAt,
      });
      throw new Error('Refresh token expired');
    }

    // Update last used time
    storedToken.lastUsedAt = new Date();
    await storedToken.save();

    // Determine if this was a "remember me" token based on expiration.
    // Threshold sits between normal (7d) and remembered (30d) lifetimes.
    const daysUntilExpiry = Math.floor(
      (storedToken.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    const isRemembered = daysUntilExpiry > 10;

    // Generate new tokens
    const newRefreshToken = this.generateRefreshToken(payload, isRemembered);
    const newAccessToken = this.generateAccessToken(payload, isRemembered);

    // Store new refresh token
    const expiresIn = isRemembered
      ? this.REFRESH_TOKEN_EXPIRES_IN_REMEMBERED
      : this.REFRESH_TOKEN_EXPIRES_IN;
    await this.storeRefreshToken(
      newRefreshToken,
      new mongoose.Types.ObjectId(payload.userId),
      expiresIn,
      deviceInfo,
      ipAddress,
      userAgent
    );

    // Revoke old token (rotation)
    await storedToken.revoke('Token rotated', newRefreshToken);

    logger.info('[AUTH_SERVICE] Refresh token rotated successfully', {
      userId: payload.userId,
      oldTokenId: storedToken._id,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      isRemembered,
      payload,
      resolvedDeviceId: deviceInfo?.deviceId ?? storedToken.deviceInfo?.deviceId,
    };
  }

  /**
   * Revoke refresh token
   */
  async revokeRefreshToken(token: string, reason: string = 'User logout'): Promise<void> {
    const storedToken = await RefreshToken.findOne({ token });
    if (storedToken && !storedToken.isRevoked) {
      await storedToken.revoke(reason);
      logger.info('[AUTH_SERVICE] Refresh token revoked', {
        tokenId: storedToken._id,
        reason,
      });
    }
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllRefreshTokensForUser(
    userId: mongoose.Types.ObjectId,
    reason: string = 'User logout from all devices'
  ): Promise<number> {
    const count = await RefreshToken.revokeAllForUser(userId, reason);
    logger.info('[AUTH_SERVICE] All refresh tokens revoked for user', {
      userId,
      count,
      reason,
    });
    return count;
  }

  /**
   * Clean up expired refresh tokens
   */
  async cleanupExpiredTokens(): Promise<number> {
    const count = await RefreshToken.cleanupExpiredTokens();
    logger.info('[AUTH_SERVICE] Expired refresh tokens cleaned up', { count });
    return count;
  }

  /**
   * Parse expiration time string to Date
   */
  private parseExpirationTime(expiresIn: string): Date {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error('Invalid expiration format');
    }

    const value = parseInt(match[1] || '0', 10);
    const unit = match[2];

    const now = Date.now();
    let milliseconds = 0;

    switch (unit) {
      case 's':
        milliseconds = value * 1000;
        break;
      case 'm':
        milliseconds = value * 60 * 1000;
        break;
      case 'h':
        milliseconds = value * 60 * 60 * 1000;
        break;
      case 'd':
        milliseconds = value * 24 * 60 * 60 * 1000;
        break;
    }

    return new Date(now + milliseconds);
  }

  /**
   * Generate an Offline Capability Token (OCT).
   *
   * The OCT is a short-lived JWT (24h) signed with JWT_DEVICE_SECRET, bound to
   * a specific userId + deviceId pair. The mobile client encrypts it at rest
   * using a key derived from the user's password (PBKDF2 — handled in P4).
   *
   * Fails gracefully if JWT_DEVICE_SECRET is not configured: callers should
   * treat a missing OCT as "offline login unavailable on this device".
   */
  generateOfflineCapabilityToken(payload: TokenPayload, deviceId: string): string {
    if (!this.JWT_DEVICE_SECRET) {
      throw new Error('JWT_DEVICE_SECRET is not configured — OCT cannot be issued');
    }

    const permissionsHash = crypto
      .createHash('sha256')
      .update(JSON.stringify([...payload.permissions].sort()))
      .digest('hex');

    const octPayload: OctPayload = {
      userId: payload.userId,
      deviceId,
      email: payload.email,
      role: payload.role,
      storeId: payload.storeId,
      permissions: payload.permissions,
      permissionsHash,
      octVersion: '1',
    };

    logger.info('[AUTH_SERVICE] Generating OCT', { userId: payload.userId, deviceId });

    return jwt.sign(octPayload, this.JWT_DEVICE_SECRET, {
      expiresIn: this.OCT_EXPIRES_IN,
      issuer: 'handeepos-api',
      audience: 'handeepos-mobile',
    } as SignOptions);
  }

  /**
   * Verify an Offline Capability Token (OCT).
   * Used by the session/validate endpoint and the PENDING_SYNC flow.
   */
  verifyOfflineCapabilityToken(token: string): OctPayload {
    if (!this.JWT_DEVICE_SECRET) {
      throw new Error('JWT_DEVICE_SECRET is not configured');
    }
    try {
      return jwt.verify(token, this.JWT_DEVICE_SECRET, {
        issuer: 'handeepos-api',
        audience: 'handeepos-mobile',
      }) as OctPayload;
    } catch (error) {
      logger.error('[AUTH_SERVICE] OCT verification failed:', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Invalid or expired offline capability token');
    }
  }

  /**
   * Check if offline grace period is still valid
   * Used for POS systems that may be offline for extended periods
   */
  isWithinOfflineGracePeriod(lastOnlineDate: Date): boolean {
    const gracePeriodMs = this.OFFLINE_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
    const timeSinceLastOnline = Date.now() - lastOnlineDate.getTime();
    return timeSinceLastOnline <= gracePeriodMs;
  }
}

export default new AuthService();
