import { Router } from 'express';
import { authenticate, authorize } from '@/middleware/auth';
import { OrderController } from '@/controllers/orderController';
import { CustomerController } from '@/controllers/customerController';
import { validateRequest } from '@/middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();

// Apply authentication to all order routes
router.use(authenticate);

// Order routes
/**
 * @route   GET /api/orders
 * @desc    Get all orders with filters and pagination
 * @access  Private
 */
router.get('/', OrderController.getOrders as any);

/**
 * @route   GET /api/orders/stats
 * @desc    Get order statistics
 * @access  Private
 */
router.get('/stats', OrderController.getOrderStats as any);

/**
 * @route   GET /api/orders/payment-breakdown
 * @desc    Get payment method breakdown
 * @access  Private
 */
router.get('/payment-breakdown', OrderController.getPaymentBreakdown as any);

/**
 * @route   GET /api/orders/:id
 * @desc    Get single order
 * @access  Private
 */
router.get('/:id',
  [
    param('id').isMongoId().withMessage('Invalid order ID')
  ],
  validateRequest,
  OrderController.getOrder as any
);

/**
 * @route   POST /api/orders
 * @desc    Create order
 * @access  Private (Sales permission)
 */
router.post('/',
  authorize(['sales']),
  [
    body('items').isArray({ min: 1 }).withMessage('Order must have at least one item'),
    body('items.*.productId').isMongoId().withMessage('Valid product ID is required'),
    body('items.*.productName').notEmpty().withMessage('Product name is required'),
    body('items.*.sku').notEmpty().withMessage('SKU is required'),
    body('items.*.quantity').isNumeric().withMessage('Valid quantity is required'),
    body('items.*.unitPrice').isNumeric().withMessage('Valid unit price is required'),
    body('items.*.subtotal').isNumeric().withMessage('Valid subtotal is required'),
    body('customerId').optional().isMongoId().withMessage('Valid customer ID is required'),
    body('customNote').optional().isString().withMessage('Custom note must be a string'),
    body('payments').optional().isArray().withMessage('Payments must be an array'),
    body('payments.*.method').optional().isIn(['cash', 'card', 'mobile_money']).withMessage('Invalid payment method'),
    body('payments.*.amount').optional().isNumeric().withMessage('Valid payment amount is required'),
    body('deviceId').optional().isString().withMessage('Device ID must be a string')
  ],
  validateRequest,
  OrderController.createOrder as any
);

/**
 * @route   PUT /api/orders/:id/status
 * @desc    Update order status
 * @access  Private (Sales permission)
 */
router.put('/:id/status',
  authorize(['sales']),
  [
    param('id').isMongoId().withMessage('Invalid order ID'),
    body('status').isIn(['pending', 'completed', 'cancelled', 'refunded']).withMessage('Invalid status')
  ],
  validateRequest,
  OrderController.updateOrderStatus as any
);

/**
 * @route   DELETE /api/orders/:id
 * @desc    Cancel order
 * @access  Private (Sales permission)
 */
router.delete('/:id',
  authorize(['sales']),
  [
    param('id').isMongoId().withMessage('Invalid order ID')
  ],
  validateRequest,
  OrderController.cancelOrder as any
);

// Customer routes
/**
 * @route   GET /api/orders/customers
 * @desc    Get all customers
 * @access  Private
 */
router.get('/customers', CustomerController.getCustomers as any);

/**
 * @route   GET /api/orders/customers/search
 * @desc    Search customers
 * @access  Private
 */
router.get('/customers/search',
  [
    query('query').notEmpty().withMessage('Search query is required')
  ],
  validateRequest,
  CustomerController.searchCustomers as any
);

/**
 * @route   GET /api/orders/customers/stats
 * @desc    Get customer statistics
 * @access  Private
 */
router.get('/customers/stats', CustomerController.getCustomerStats as any);

/**
 * @route   GET /api/orders/customers/:id
 * @desc    Get single customer
 * @access  Private
 */
router.get('/customers/:id',
  [
    param('id').isMongoId().withMessage('Invalid customer ID')
  ],
  validateRequest,
  CustomerController.getCustomer as any
);

/**
 * @route   POST /api/orders/customers
 * @desc    Create customer
 * @access  Private (Sales permission)
 */
router.post('/customers',
  authorize(['sales']),
  [
    body('name').notEmpty().withMessage('Customer name is required'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('phoneNumber').optional().isString().withMessage('Phone number must be a string'),
    body('address.street').optional().isString().withMessage('Street must be a string'),
    body('address.city').optional().isString().withMessage('City must be a string'),
    body('address.country').optional().isString().withMessage('Country must be a string'),
    body('address.postalCode').optional().isString().withMessage('Postal code must be a string'),
    body('notes').optional().isString().withMessage('Notes must be a string')
  ],
  validateRequest,
  CustomerController.createCustomer as any
);

/**
 * @route   PUT /api/orders/customers/:id
 * @desc    Update customer
 * @access  Private (Sales permission)
 */
router.put('/customers/:id',
  authorize(['sales']),
  [
    param('id').isMongoId().withMessage('Invalid customer ID')
  ],
  validateRequest,
  CustomerController.updateCustomer as any
);

/**
 * @route   DELETE /api/orders/customers/:id
 * @desc    Delete customer
 * @access  Private (Admin permission)
 */
router.delete('/customers/:id',
  authorize(['sales']),
  [
    param('id').isMongoId().withMessage('Invalid customer ID')
  ],
  validateRequest,
  CustomerController.deleteCustomer as any
);

/**
 * @route   PUT /api/orders/customers/:id/loyalty
 * @desc    Update customer loyalty points
 * @access  Private (Sales permission)
 */
router.put('/customers/:id/loyalty',
  authorize(['sales']),
  [
    param('id').isMongoId().withMessage('Invalid customer ID'),
    body('points').isNumeric().withMessage('Valid points value is required'),
    body('operation').optional().isIn(['add', 'subtract']).withMessage('Operation must be add or subtract')
  ],
  validateRequest,
  CustomerController.updateLoyaltyPoints as any
);

export default router;
