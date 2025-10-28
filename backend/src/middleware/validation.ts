import { body, ValidationChain, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { sendValidationError } from '@/utils/response';

/**
 * Login validation rules
 */
export const validateLogin: ValidationChain[] = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .toLowerCase(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('rememberMe')
    .optional()
    .isBoolean()
    .withMessage('Remember me must be a boolean value')
];

/**
 * Refresh token validation rules
 */
export const validateRefreshToken: ValidationChain[] = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
    .isString()
    .withMessage('Refresh token must be a string')
];

/**
 * Change password validation rules
 */
/**
 * Password recovery request validation rules
 */
export const validateForgotPassword: ValidationChain[] = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .toLowerCase()
];

/**
 * Password reset validation rules
 */
export const validateResetPassword: ValidationChain[] = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required')
    .isString()
    .withMessage('Reset token must be a string'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
];

/**
 * Change password validation rules
 */
export const validateChangePassword: ValidationChain[] = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from current password');
      }
      return true;
    })
];

/**
 * User registration validation rules
 */
export const validateRegister: ValidationChain[] = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .toLowerCase(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('fullName')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .trim(),
  
  body('phoneNumber')
    .optional()
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number')
];

/**
 * Store creation validation rules
 */
export const validateStoreCreation: ValidationChain[] = [
  body('name')
    .isLength({ min: 2, max: 100 })
    .withMessage('Store name must be between 2 and 100 characters')
    .trim(),
  
  body('address.street')
    .isLength({ min: 5, max: 200 })
    .withMessage('Street address must be between 5 and 200 characters')
    .trim(),
  
  body('address.city')
    .isLength({ min: 2, max: 50 })
    .withMessage('City must be between 2 and 50 characters')
    .trim(),
  
  body('address.country')
    .isLength({ min: 2, max: 50 })
    .withMessage('Country must be between 2 and 50 characters')
    .trim(),
  
  body('address.postalCode')
    .isLength({ min: 3, max: 20 })
    .withMessage('Postal code must be between 3 and 20 characters')
    .trim(),
  
  body('currency')
    .isIn(['USD', 'EUR', 'GBP', 'ZAR', 'KES', 'NGN', 'GHS', 'ZWL'])
    .withMessage('Currency must be one of: USD, EUR, GBP, ZAR, KES, NGN, GHS, ZWL'),
  
  body('timezone')
    .isString()
    .withMessage('Timezone must be a string')
    .trim(),
  
  body('phoneNumber')
    .optional()
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number'),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .toLowerCase()
];

/**
 * Validation middleware to check for validation errors
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages: Record<string, string[]> = {};
    
    errors.array().forEach((error: any) => {
      const field = error.path || error.param;
      if (!errorMessages[field]) {
        errorMessages[field] = [];
      }
      errorMessages[field].push(error.msg);
    });
    
    sendValidationError(res, errorMessages);
    return;
  }
  
  next();
};