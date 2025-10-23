import { Router } from 'express';
import { generalLimiter } from '@/middleware/rateLimiter';

const router = Router();

// Apply rate limiting to all routes
router.use(generalLimiter);

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'HandeePOS Backend is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API info route
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'HandeePOS Backend API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      products: '/api/products',
      orders: '/api/orders',
      customers: '/api/customers',
      reports: '/api/reports',
      sync: '/api/sync'
    }
  });
});

export default router;
