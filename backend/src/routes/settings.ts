import { Router } from 'express';
import { SettingsController } from '@/controllers/settingsController';
import { authenticate } from '@/middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Allow admin, manager, or explicit settings permission
router.use((req, res, next): void => {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ success: false, message: 'Authentication required' });
    return;
  }
  const hasAccess =
    user.role === 'admin' ||
    user.role === 'manager' ||
    user.permissions?.includes('settings');
  if (!hasAccess) {
    res.status(403).json({ success: false, message: 'Insufficient permissions' });
    return;
  }
  next();
});

// Store settings
router.get('/store', SettingsController.getStoreSettings as any);
router.put('/store', SettingsController.updateStoreSettings as any);

// Receipt settings
router.put('/receipt', SettingsController.updateReceiptSettings as any);

// Tax settings
router.put('/tax', SettingsController.updateTaxSettings as any);

// Business hours
router.put('/business-hours', SettingsController.updateBusinessHours as any);

// System information
router.get('/system', SettingsController.getSystemInfo as any);

// Test receipt printer
router.post('/test-receipt', SettingsController.testReceiptPrinter as any);

export default router;
