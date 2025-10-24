import { Router } from 'express';
import { authenticate, authorize } from '@/middleware/auth';
import { ProductController } from '@/controllers/productController';
import { CategoryController } from '@/controllers/categoryController';
import { validateRequest } from '@/middleware/validation';
import { body, param, query } from 'express-validator';

const router = Router();

// Apply authentication to all product routes
router.use(authenticate);

// Product routes
/**
 * @route   GET /api/products
 * @desc    Get all products with search, filter, and pagination
 * @access  Private
 */
router.get('/', ProductController.getProducts);

/**
 * @route   GET /api/products/low-stock
 * @desc    Get low stock products
 * @access  Private
 */
router.get('/low-stock', ProductController.getLowStockProducts);

/**
 * @route   GET /api/products/search
 * @desc    Search products by barcode
 * @access  Private
 */
router.get('/search', 
  [
    query('barcode').notEmpty().withMessage('Barcode is required')
  ],
  validateRequest,
  ProductController.searchByBarcode
);

/**
 * @route   GET /api/products/:id
 * @desc    Get single product
 * @access  Private
 */
router.get('/:id', 
  [
    param('id').isMongoId().withMessage('Invalid product ID')
  ],
  validateRequest,
  ProductController.getProduct
);

/**
 * @route   POST /api/products
 * @desc    Create product
 * @access  Private (Manager, Admin)
 */
router.post('/', 
  authorize(['products']),
  [
    body('name').notEmpty().withMessage('Product name is required'),
    body('sku').notEmpty().withMessage('SKU is required'),
    body('categoryId').isMongoId().withMessage('Valid category ID is required'),
    body('price').isNumeric().withMessage('Price must be a number'),
    body('cost').isNumeric().withMessage('Cost must be a number'),
    body('stockQuantity').isNumeric().withMessage('Stock quantity must be a number'),
    body('lowStockThreshold').isNumeric().withMessage('Low stock threshold must be a number')
  ],
  validateRequest,
  ProductController.createProduct
);

/**
 * @route   PUT /api/products/:id
 * @desc    Update product
 * @access  Private (Manager, Admin)
 */
router.put('/:id', 
  authorize(['products']),
  [
    param('id').isMongoId().withMessage('Invalid product ID')
  ],
  validateRequest,
  ProductController.updateProduct
);

/**
 * @route   DELETE /api/products/:id
 * @desc    Delete product
 * @access  Private (Admin)
 */
router.delete('/:id', 
  authorize(['products']),
  [
    param('id').isMongoId().withMessage('Invalid product ID')
  ],
  validateRequest,
  ProductController.deleteProduct
);

/**
 * @route   PUT /api/products/:id/stock
 * @desc    Update product stock
 * @access  Private (Manager, Admin)
 */
router.put('/:id/stock',
  authorize(['products']),
  [
    param('id').isMongoId().withMessage('Invalid product ID'),
    body('stockQuantity').isNumeric().withMessage('Stock quantity must be a number'),
    body('reason').optional().isString().withMessage('Reason must be a string')
  ],
  validateRequest,
  ProductController.updateStock
);

// Category routes
/**
 * @route   GET /api/products/categories
 * @desc    Get all categories
 * @access  Private
 */
router.get('/categories', CategoryController.getCategories);

/**
 * @route   GET /api/products/categories/:id
 * @desc    Get single category
 * @access  Private
 */
router.get('/categories/:id',
  [
    param('id').isMongoId().withMessage('Invalid category ID')
  ],
  validateRequest,
  CategoryController.getCategory
);

/**
 * @route   POST /api/products/categories
 * @desc    Create category
 * @access  Private (Manager, Admin)
 */
router.post('/categories',
  authorize(['products']),
  [
    body('name').notEmpty().withMessage('Category name is required'),
    body('description').optional().isString().withMessage('Description must be a string')
  ],
  validateRequest,
  CategoryController.createCategory
);

/**
 * @route   PUT /api/products/categories/:id
 * @desc    Update category
 * @access  Private (Manager, Admin)
 */
router.put('/categories/:id',
  authorize(['products']),
  [
    param('id').isMongoId().withMessage('Invalid category ID')
  ],
  validateRequest,
  CategoryController.updateCategory
);

/**
 * @route   DELETE /api/products/categories/:id
 * @desc    Delete category
 * @access  Private (Admin)
 */
router.delete('/categories/:id',
  authorize(['products']),
  [
    param('id').isMongoId().withMessage('Invalid category ID')
  ],
  validateRequest,
  CategoryController.deleteCategory
);

export default router;
