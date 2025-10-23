import { Router } from 'express';
import { authLimiter } from '@/middleware/rateLimiter';
import { authenticate } from '@/middleware/auth';
import authController from '@/controllers/authController';
import { 
  validateLogin, 
  validateRefreshToken, 
  validateChangePassword 
} from '@/middleware/validation';

const router = Router();

// Apply authentication rate limiting
router.use(authLimiter);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', validateLogin, authController.login);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh JWT token
 * @access  Public
 */
router.post('/refresh-token', validateRefreshToken, authController.refreshToken);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, authController.getProfile);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password', authenticate, validateChangePassword, authController.changePassword);

export default router;
