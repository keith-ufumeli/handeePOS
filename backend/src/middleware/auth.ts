import { Request, Response, NextFunction } from 'express';
import authService from '@/services/authService';
import logger from '@/utils/logger';

/**
 * Authentication middleware
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = authService.extractTokenFromHeader(req.headers.authorization);
    const decoded = authService.verifyAccessToken(token);
    
    // Attach user info to request
    (req as any).user = decoded;
    
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      message: error instanceof Error ? error.message : 'Authentication failed'
    });
  }
};

/**
 * Authorization middleware - check if user has required permissions
 */
export const authorize = (permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    const hasPermission = authService.hasAnyPermission(user.permissions, permissions);

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
      return;
    }

    next();
  };
};

/**
 * Check if user has access to specific store
 */
export const checkStoreAccess = (req: Request, res: Response, next: NextFunction): void => {
  const user = (req as any).user;
  
  if (!user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }

  const storeId = req.params['storeId'] || req.body['storeId'];
  
  if (!storeId) {
    res.status(400).json({
      success: false,
      message: 'Store ID is required'
    });
    return;
  }

  // Check if user has access to this store
  if (user['storeId'] !== storeId) {
    res.status(403).json({
      success: false,
      message: 'Access denied to this store'
    });
    return;
  }

  next();
};
