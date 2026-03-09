import { Router } from 'express';
import { ReportController } from '@/controllers/reportController';
import { authenticate } from '@/middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Apply reports permission requirement (allow reports or basic_access)
router.use((req, res, next): void => {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
    return;
  }
  
  // Allow if user has reports permission or basic_access
  const hasPermission = user.permissions?.includes('reports') || 
                        user.permissions?.includes('basic_access') ||
                        user.role === 'admin' || 
                        user.role === 'manager';
  
  if (!hasPermission) {
    res.status(403).json({
      success: false,
      message: 'Insufficient permissions'
    });
    return;
  }
  
  next();
});

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

// Export report (CSV or JSON)
router.get('/export', ReportController.exportReport as any);

export default router;
