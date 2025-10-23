import { Request, Response, NextFunction } from 'express';
import logger from '@/utils/logger';
import { sendError } from '@/utils/response';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

/**
 * Global error handling middleware
 */
export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error(`Error: ${error.message}`, {
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404, isOperational: true } as AppError;
  }

  // Mongoose duplicate key
  if (err.name === 'MongoError' && (err as any).code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400, isOperational: true } as AppError;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values((err as any).errors)
      .map((val: any) => val.message)
      .join(', ');
    error = { message, statusCode: 400, isOperational: true } as AppError;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401, isOperational: true } as AppError;
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401, isOperational: true } as AppError;
  }

  sendError(
    res,
    error.message || 'Server Error',
    error.statusCode || 500,
    process.env['NODE_ENV'] === 'development' ? error.stack : undefined
  );
};

/**
 * Handle 404 errors
 */
export const notFound = (_req: Request, _res: Response, next: NextFunction): void => {
  const error = new Error(`Not found - ${_req.originalUrl}`) as AppError;
  error.statusCode = 404;
  next(error);
};
