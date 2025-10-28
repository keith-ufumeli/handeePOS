import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { IUser } from '@/models/User';
import logger from '@/utils/logger';

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

class AuthService {
  private readonly JWT_SECRET = process.env['JWT_SECRET'] || 'your-secret-key';
  private readonly JWT_REFRESH_SECRET = process.env['JWT_REFRESH_SECRET'] || 'your-refresh-secret-key';
  private readonly ACCESS_TOKEN_EXPIRES_IN = '15m';
  private readonly ACCESS_TOKEN_EXPIRES_IN_REMEMBERED = '1d';
  private readonly REFRESH_TOKEN_EXPIRES_IN = '7d';
  private readonly REFRESH_TOKEN_EXPIRES_IN_REMEMBERED = '30d';

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
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate access token
   */
  generateAccessToken(payload: TokenPayload, rememberMe: boolean = false): string {
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: rememberMe ? this.ACCESS_TOKEN_EXPIRES_IN_REMEMBERED : this.ACCESS_TOKEN_EXPIRES_IN,
      issuer: 'handeepos-api',
      audience: 'handeepos-mobile'
    });
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(payload: TokenPayload, rememberMe: boolean = false): string {
    return jwt.sign(payload, this.JWT_REFRESH_SECRET, {
      expiresIn: rememberMe ? this.REFRESH_TOKEN_EXPIRES_IN_REMEMBERED : this.REFRESH_TOKEN_EXPIRES_IN,
      issuer: 'handeepos-api',
      audience: 'handeepos-mobile'
    });
  }

  /**
   * Generate both access and refresh tokens
   */
  generateTokens(user: IUser, rememberMe: boolean = false): AuthTokens {
    const payload: TokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      storeId: user.storeId.toString(),
      permissions: user.permissions
    };

    return {
      accessToken: this.generateAccessToken(payload, rememberMe),
      refreshToken: this.generateRefreshToken(payload, rememberMe)
    };
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as TokenPayload;
      return decoded;
    } catch (error) {
      logger.error('Access token verification failed:', error);
      throw new Error('Invalid access token');
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.JWT_REFRESH_SECRET) as TokenPayload;
      return decoded;
    } catch (error) {
      logger.error('Refresh token verification failed:', error);
      throw new Error('Invalid refresh token');
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
  async generatePasswordResetToken(user: IUser): Promise<string> {
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
}

export default new AuthService();
