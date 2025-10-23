import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { sendError } from '@/utils/response';
import { TokenPayload } from '@/types';

/**
 * Authentication middleware
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendError(res, 'Access denied. No token provided.', 401);
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      sendError(res, 'Access denied. No token provided.', 401);
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      sendError(res, 'JWT secret not configured.', 500);
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as TokenPayload;
    req.token = decoded;
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      sendError(res, 'Invalid token.', 401);
      return;
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      sendError(res, 'Token expired.', 401);
      return;
    }
    
    sendError(res, 'Token verification failed.', 401);
  }
};

/**
 * Authorization middleware - check if user has required permissions
 */
export const authorize = (permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.token) {
      sendError(res, 'Authentication required.', 401);
      return;
    }

    const userPermissions = req.token.permissions || [];
    const hasPermission = permissions.some(permission => 
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      sendError(res, 'Insufficient permissions.', 403);
      return;
    }

    next();
  };
};

/**
 * Check if user has access to specific store
 */
export const checkStoreAccess = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.token) {
    sendError(res, 'Authentication required.', 401);
    return;
  }

  const storeId = req.params.storeId || req.body.storeId;
  
  if (!storeId) {
    sendError(res, 'Store ID is required.', 400);
    return;
  }

  // Check if user has access to this store
  // This will be implemented when we add user models
  // For now, we'll allow access if user is authenticated
  next();
};
