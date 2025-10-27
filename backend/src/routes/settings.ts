import { Router } from 'express';
import { SettingsController } from '@/controllers/settingsController';
import { authenticate, authorize } from '@/middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Apply settings permission requirement
router.use(authorize(['settings']));

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
