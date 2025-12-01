import { Request, Response } from 'express';
import User from '@/models/User';
import authService from '@/services/authService';
import logger from '@/utils/logger';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';

export class AuthController {
  /**
   * User registration
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { fullName, email, password } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
        return;
      }

      // Hash password
      const passwordHash = await authService.hashPassword(password);

      // Create new user
      const user = await User.create({
        email: email.toLowerCase(),
        passwordHash,
        fullName,
        role: 'user', // Default role
        permissions: ['basic_access'], // Default permissions
        isActive: true
      });

      logger.info(`New user registered: ${user.email}`);

      // Generate tokens
      const tokens = authService.generateTokens(user);

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: {
          user: {
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            permissions: user.permissions
          },
          tokens
        }
      });

    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * User login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      logger.info('[AUTH] Login request received', {
        email: req.body.email,
        rememberMe: req.body.rememberMe,
        ip: req.ip,
        userAgent: req.get('user-agent')
      });

      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        logger.warn('[AUTH] Login validation failed', { errors: errors.array() });
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const { email, password, rememberMe = false } = req.body;
      logger.info('[AUTH] Processing login for email:', email.toLowerCase());

      // Find user by email
      const user = await User.findOne({ 
        email: email.toLowerCase(),
        isActive: true 
      }).populate('storeId');

      if (!user) {
        logger.warn('[AUTH] Login failed - user not found or inactive', { email: email.toLowerCase() });
        res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
        return;
      }

      logger.info('[AUTH] User found, verifying password', { userId: user._id, email: user.email });

      // Verify password
      const isPasswordValid = await authService.comparePassword(password, user.passwordHash);
      if (!isPasswordValid) {
        logger.warn('[AUTH] Login failed - invalid password', { userId: user._id, email: user.email });
        res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
        return;
      }

      logger.info('[AUTH] Password verified, generating tokens', { userId: user._id, rememberMe });

      // Generate tokens with remember me option
      const tokens = authService.generateTokens(user, rememberMe);
      logger.info('[AUTH] Tokens generated successfully', {
        userId: user._id,
        hasAccessToken: !!tokens.accessToken,
        hasRefreshToken: !!tokens.refreshToken
      });

      // Store refresh token in database for rotation tracking
      const expiresIn = rememberMe
        ? process.env['JWT_REFRESH_EXPIRES_IN_REMEMBERED'] || '180d'
        : process.env['JWT_REFRESH_EXPIRES_IN'] || '90d';

      const deviceName = req.get('x-device-name');
      const platform = req.get('x-device-platform');
      const appVersion = req.get('x-app-version');
      const deviceInfo = {
        ...(deviceName && { deviceName }),
        ...(platform && { platform }),
        ...(appVersion && { appVersion }),
      };

      await authService.storeRefreshToken(
        tokens.refreshToken,
        new mongoose.Types.ObjectId(user._id),
        expiresIn,
        deviceInfo,
        req.ip,
        req.get('user-agent')
      );

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      logger.info('[AUTH] User logged in successfully', {
        userId: user._id,
        email: user.email,
        role: user.role,
        storeId: user.storeId?._id || user.storeId
      });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            storeId: user.storeId,
            permissions: user.permissions,
            lastLogin: user.lastLogin
          },
          store: user.storeId,
          tokens
        }
      });

    } catch (error) {
      logger.error('[AUTH] Login error:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        email: req.body?.email
      });
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Refresh access token with token rotation
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      logger.info('[AUTH] Refresh token request received', {
        hasRefreshToken: !!req.body.refreshToken,
        ip: req.ip
      });

      const { refreshToken } = req.body;

      if (!refreshToken) {
        logger.warn('[AUTH] Refresh token missing in request');
        res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
        return;
      }

      logger.info('[AUTH] Validating and rotating refresh token');

      // Validate and rotate refresh token (security best practice)
      const deviceName = req.get('x-device-name');
      const platform = req.get('x-device-platform');
      const appVersion = req.get('x-app-version');
      const deviceInfo = {
        ...(deviceName && { deviceName }),
        ...(platform && { platform }),
        ...(appVersion && { appVersion }),
      };

      const rotatedTokens = await authService.validateAndRotateRefreshToken(
        refreshToken,
        deviceInfo,
        req.ip,
        req.get('user-agent')
      );

      logger.info('[AUTH] Token refreshed and rotated successfully', {
        isRemembered: rotatedTokens.isRemembered
      });

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: rotatedTokens.accessToken,
          refreshToken: rotatedTokens.refreshToken, // Return new refresh token
        }
      });

    } catch (error) {
      logger.error('[AUTH] Token refresh error:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      res.status(401).json({
        success: false,
        message: error instanceof Error ? error.message : 'Invalid refresh token'
      });
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;

      const user = await User.findById(userId)
        .populate('storeId')
        .select('-passwordHash');

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          user: {
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            phoneNumber: user.phoneNumber,
            role: user.role,
            storeId: user.storeId,
            permissions: user.permissions,
            lastLogin: user.lastLogin,
            createdAt: user.createdAt
          },
          store: user.storeId
        }
      });

    } catch (error) {
      logger.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * User logout (revoke refresh tokens)
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const { refreshToken, logoutAllDevices } = req.body;

      logger.info(`User ${(req as any).user.email} logging out`, {
        logoutAllDevices: !!logoutAllDevices
      });

      if (logoutAllDevices) {
        // Revoke all refresh tokens for this user
        await authService.revokeAllRefreshTokensForUser(
          new mongoose.Types.ObjectId(userId),
          'User logout from all devices'
        );
      } else if (refreshToken) {
        // Revoke only the current refresh token
        await authService.revokeRefreshToken(refreshToken, 'User logout');
      }

      res.status(200).json({
        success: true,
        message: 'Logout successful'
      });

    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Request password reset
   */
  async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      // Find user by email
      const user = await User.findOne({ 
        email: email.toLowerCase(),
        isActive: true 
      });

      if (!user) {
        // For security, don't reveal if email exists
        res.status(200).json({
          success: true,
          message: 'If your email is registered, you will receive a password reset link'
        });
        return;
      }

      // Generate reset token
      const resetToken = await authService.generatePasswordResetToken(user);

      // Save reset token and expiry
      user.resetToken = resetToken;
      user.resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour
      await user.save();

      // Send reset email
      await authService.sendPasswordResetEmail(user.email, resetToken);

      logger.info(`Password reset requested for user ${user.email}`);

      res.status(200).json({
        success: true,
        message: 'If your email is registered, you will receive a password reset link'
      });

    } catch (error) {
      logger.error('Password reset request error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, password } = req.body;

      // Find user by reset token and check expiry
      const user = await User.findOne({
        resetToken: token,
        resetTokenExpiry: { $gt: new Date() },
        isActive: true
      });

      if (!user) {
        res.status(400).json({
          success: false,
          message: 'Invalid or expired reset token'
        });
        return;
      }

      // Hash new password
      const passwordHash = await authService.hashPassword(password);

      // Update user password and clear reset token
      user.passwordHash = passwordHash;
      user.resetToken = undefined;
      user.resetTokenExpiry = undefined;
      await user.save();

      logger.info(`Password reset successful for user ${user.email}`);

      res.status(200).json({
        success: true,
        message: 'Password reset successful'
      });

    } catch (error) {
      logger.error('Password reset error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Change password
   */
  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      const userId = (req as any).user.userId;
      const { currentPassword, newPassword } = req.body;

      // Find user
      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Verify current password
      const isCurrentPasswordValid = await authService.comparePassword(
        currentPassword, 
        user.passwordHash
      );

      if (!isCurrentPasswordValid) {
        res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
        return;
      }

      // Hash new password
      const newPasswordHash = await authService.hashPassword(newPassword);
      user.passwordHash = newPasswordHash;
      await user.save();

      logger.info(`Password changed for user ${user.email}`);

      res.status(200).json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      logger.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

export default new AuthController();