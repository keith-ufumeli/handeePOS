import { Router } from 'express';
import { ReportController } from '@/controllers/reportController';
import { authenticate, authorize } from '@/middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Apply reports permission requirement
router.use(authorize(['reports']));

// Daily sales summary
router.get('/daily-summary', ReportController.getDailySalesSummary as any);

// Sales report for date range
router.get('/sales', ReportController.getSalesReport as any);

// Product performance report
router.get('/products', ReportController.getProductPerformance as any);

// Inventory valuation report
router.get('/inventory', ReportController.getInventoryValuation as any);

// Customer analytics
router.get('/customers', ReportController.getCustomerAnalytics as any);

export default router;
