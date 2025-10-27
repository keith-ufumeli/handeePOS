import { Request, Response } from 'express';
import Store from '@/models/Store';
import { sendSuccess, sendError } from '@/utils/response';
import logger from '@/utils/logger';
import { TokenPayload } from '@/services/authService';

interface AuthenticatedRequest extends Omit<Request, 'user'> {
  user: TokenPayload;
}

export class SettingsController {
  /**
   * Get store settings
   */
  static async getStoreSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const storeId = req.user?.storeId;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      const store = await Store.findById(storeId).select('-__v');

      if (!store) {
        sendError(res, 'Store not found', 404);
        return;
      }

      sendSuccess(res, store);
    } catch (error) {
      logger.error('Error fetching store settings:', error);
      sendError(res, 'Failed to fetch store settings', 500);
    }
  }

  /**
   * Update store settings
   */
  static async updateStoreSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const storeId = req.user?.storeId;
      const updateData = req.body;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      // Validate required fields
      const allowedFields = [
        'name',
        'address',
        'phoneNumber',
        'email',
        'currency',
        'timezone',
        'receiptSettings',
        'taxSettings',
        'businessHours',
        'features'
      ];

      const filteredData = Object.keys(updateData)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = updateData[key];
          return obj;
        }, {} as any);

      const store = await Store.findByIdAndUpdate(
        storeId,
        { $set: filteredData },
        { new: true, runValidators: true }
      );

      if (!store) {
        sendError(res, 'Store not found', 404);
        return;
      }

      sendSuccess(res, store, 'Store settings updated successfully');
    } catch (error: any) {
      logger.error('Error updating store settings:', error);
      
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map((err: any) => err.message);
        sendError(res, `Validation error: ${errors.join(', ')}`, 400);
        return;
      }
      
      sendError(res, 'Failed to update store settings', 500);
    }
  }

  /**
   * Update receipt settings
   */
  static async updateReceiptSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const storeId = req.user?.storeId;
      const receiptSettings = req.body;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      // Validate receipt settings
      const validReceiptSettings = {
        headerText: receiptSettings.headerText || '',
        footerText: receiptSettings.footerText || '',
        showLogo: receiptSettings.showLogo || false,
        logoUrl: receiptSettings.logoUrl || '',
        showTaxBreakdown: receiptSettings.showTaxBreakdown !== false,
        showLoyaltyPoints: receiptSettings.showLoyaltyPoints !== false,
        paperSize: receiptSettings.paperSize || '80mm',
        fontSize: receiptSettings.fontSize || 'normal',
        showQRCode: receiptSettings.showQRCode || false,
        qrCodeData: receiptSettings.qrCodeData || ''
      };

      const store = await Store.findByIdAndUpdate(
        storeId,
        { $set: { receiptSettings: validReceiptSettings } },
        { new: true }
      );

      if (!store) {
        sendError(res, 'Store not found', 404);
        return;
      }

      sendSuccess(res, store.receiptSettings, 'Receipt settings updated successfully');
    } catch (error) {
      logger.error('Error updating receipt settings:', error);
      sendError(res, 'Failed to update receipt settings', 500);
    }
  }

  /**
   * Update tax settings
   */
  static async updateTaxSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const storeId = req.user?.storeId;
      const taxSettings = req.body;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      // Validate tax settings
      const validTaxSettings = {
        defaultTaxRate: Math.max(0, Math.min(100, taxSettings.defaultTaxRate || 0)),
        taxInclusive: taxSettings.taxInclusive !== false,
        taxName: taxSettings.taxName || 'VAT',
        taxNumber: taxSettings.taxNumber || '',
        showTaxOnReceipt: taxSettings.showTaxOnReceipt !== false
      };

      const store = await Store.findByIdAndUpdate(
        storeId,
        { $set: { taxSettings: validTaxSettings } },
        { new: true }
      );

      if (!store) {
        sendError(res, 'Store not found', 404);
        return;
      }

      sendSuccess(res, store.taxSettings, 'Tax settings updated successfully');
    } catch (error) {
      logger.error('Error updating tax settings:', error);
      sendError(res, 'Failed to update tax settings', 500);
    }
  }

  /**
   * Update business hours
   */
  static async updateBusinessHours(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const storeId = req.user?.storeId;
      const businessHours = req.body;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      // Validate business hours
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const validBusinessHours: any = {};

      days.forEach(day => {
        if (businessHours[day]) {
          validBusinessHours[day] = {
            isOpen: businessHours[day].isOpen || false,
            openTime: businessHours[day].openTime || '09:00',
            closeTime: businessHours[day].closeTime || '17:00',
            breakStart: businessHours[day].breakStart || null,
            breakEnd: businessHours[day].breakEnd || null
          };
        }
      });

      const store = await Store.findByIdAndUpdate(
        storeId,
        { $set: { businessHours: validBusinessHours } },
        { new: true }
      );

      if (!store) {
        sendError(res, 'Store not found', 404);
        return;
      }

      sendSuccess(res, store.businessHours, 'Business hours updated successfully');
    } catch (error) {
      logger.error('Error updating business hours:', error);
      sendError(res, 'Failed to update business hours', 500);
    }
  }

  /**
   * Get system information
   */
  static async getSystemInfo(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const systemInfo = {
        version: '1.0.0',
        environment: process.env['NODE_ENV'] || 'development',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        platform: process.platform,
        timestamp: new Date().toISOString()
      };

      sendSuccess(res, systemInfo);
    } catch (error) {
      logger.error('Error fetching system info:', error);
      sendError(res, 'Failed to fetch system information', 500);
    }
  }

  /**
   * Test receipt printer
   */
  static async testReceiptPrinter(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const storeId = req.user?.storeId;

      if (!storeId) {
        sendError(res, 'Store ID not found', 400);
        return;
      }

      const store = await Store.findById(storeId);
      if (!store) {
        sendError(res, 'Store not found', 404);
        return;
      }

      // Generate test receipt data
      const testReceipt = {
        storeName: store.name,
        address: store.address,
        phoneNumber: store.phoneNumber,
        orderNumber: 'TEST-001',
        date: new Date().toLocaleString(),
        items: [
          {
            name: 'Test Item 1',
            quantity: 1,
            price: 10.00,
            total: 10.00
          },
          {
            name: 'Test Item 2',
            quantity: 2,
            price: 5.00,
            total: 10.00
          }
        ],
        subtotal: 20.00,
        tax: 2.00,
        total: 22.00,
        paymentMethod: 'Cash',
        receiptSettings: store.receiptSettings
      };

      sendSuccess(res, testReceipt, 'Test receipt generated successfully');
    } catch (error) {
      logger.error('Error generating test receipt:', error);
      sendError(res, 'Failed to generate test receipt', 500);
    }
  }
}
