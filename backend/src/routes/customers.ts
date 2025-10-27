import { Router } from 'express';
import { CustomerController } from '@/controllers/customerController';
import { authenticate, authorize } from '@/middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Apply customers permission requirement
router.use(authorize(['customers']));

// Customer CRUD operations
router.get('/', CustomerController.getCustomers as any);
router.get('/search', CustomerController.searchCustomers as any);
router.get('/stats', CustomerController.getCustomerStats as any);
router.get('/:id', CustomerController.getCustomer as any);
router.post('/', CustomerController.createCustomer as any);
router.put('/:id', CustomerController.updateCustomer as any);
router.delete('/:id', CustomerController.deleteCustomer as any);

// Loyalty points
router.put('/:id/loyalty', CustomerController.updateLoyaltyPoints as any);

export default router;
