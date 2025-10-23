import { Response } from 'express';
import { ApiResponse, PaginatedResponse } from '@/types';

/**
 * Send a success response
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  message: string = 'Success',
  statusCode: number = 200
): void => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
  };
  res.status(statusCode).json(response);
};

/**
 * Send an error response
 */
export const sendError = (
  res: Response,
  message: string = 'Internal Server Error',
  statusCode: number = 500,
  error?: string
): void => {
  const response: ApiResponse = {
    success: false,
    message,
    error,
  };
  res.status(statusCode).json(response);
};

/**
 * Send a paginated response
 */
export const sendPaginated = <T>(
  res: Response,
  data: T[],
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  },
  message: string = 'Success'
): void => {
  const response: PaginatedResponse<T> = {
    success: true,
    data,
    message,
    pagination,
  };
  res.status(200).json(response);
};

/**
 * Send a validation error response
 */
export const sendValidationError = (
  res: Response,
  errors: Record<string, string[]>
): void => {
  const response: ApiResponse = {
    success: false,
    message: 'Validation failed',
    error: 'Validation Error',
    data: errors,
  };
  res.status(400).json(response);
};
