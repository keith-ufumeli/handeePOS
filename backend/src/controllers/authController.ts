import { Request, Response } from 'express';
import User from '@/models/User';
import authService from '@/services/authService';
import logger from '@/utils/logger';
import { validationResult } from 'express-validator';

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

      const { email, password, rememberMe = false } = req.body;

      // Find user by email
      const user = await User.findOne({ 
        email: email.toLowerCase(),
        isActive: true 
      }).populate('storeId');

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
        return;
      }

      // Verify password
      const isPasswordValid = await authService.comparePassword(password, user.passwordHash);
      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
        return;
      }

      // Generate tokens with remember me option
      const tokens = authService.generateTokens(user, rememberMe);

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      logger.info(`User ${user.email} logged in successfully`);

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
      logger.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
        return;
      }

      // Verify refresh token
      const payload = authService.verifyRefreshToken(refreshToken);

      // Find user to ensure they still exist and are active
      const user = await User.findById(payload.userId).populate('storeId');
      if (!user || !user.isActive) {
        res.status(401).json({
          success: false,
          message: 'User not found or inactive'
        });
        return;
      }

      // Generate new access token
      const newAccessToken = authService.generateAccessToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        storeId: user.storeId?.toString() || '',
        permissions: user.permissions
      });

      logger.info(`Token refreshed for user ${user.email}`);

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: newAccessToken
        }
      });

    } catch (error) {
      logger.error('Token refresh error:', error);
      res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
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
   * User logout (client-side token invalidation)
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      // In a stateless JWT system, logout is handled client-side
      // by removing tokens from storage
      // For enhanced security, you could implement a token blacklist
      
      logger.info(`User ${(req as any).user.email} logged out`);

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