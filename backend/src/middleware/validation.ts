import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { sendValidationError } from '@/utils/response';

/**
 * Validation middleware factory
 */
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errors: Record<string, string[]> = {};
      
      error.details.forEach((detail) => {
        const key = detail.path.join('.');
        if (!errors[key]) {
          errors[key] = [];
        }
        errors[key].push(detail.message);
      });
      
      sendValidationError(res, errors);
      return;
    }
    
    next();
  };
};

/**
 * Query validation middleware
 */
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.query, { abortEarly: false });
    
    if (error) {
      const errors: Record<string, string[]> = {};
      
      error.details.forEach((detail) => {
        const key = detail.path.join('.');
        if (!errors[key]) {
          errors[key] = [];
        }
        errors[key].push(detail.message);
      });
      
      sendValidationError(res, errors);
      return;
    }
    
    next();
  };
};

/**
 * Params validation middleware
 */
export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.params, { abortEarly: false });
    
    if (error) {
      const errors: Record<string, string[]> = {};
      
      error.details.forEach((detail) => {
        const key = detail.path.join('.');
        if (!errors[key]) {
          errors[key] = [];
        }
        errors[key].push(detail.message);
      });
      
      sendValidationError(res, errors);
      return;
    }
    
    next();
  };
};
