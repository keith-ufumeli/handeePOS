# HandeePOS Backend

Express.js backend server for the HandeePOS point-of-sale system.

## 🏗️ Architecture

This backend provides a RESTful API for the HandeePOS mobile application, featuring:

- **Authentication & Authorization**: JWT-based auth with role-based permissions
- **Multi-Store Support**: Isolated data per store with proper access controls
- **Offline Sync**: Queue-based synchronization for offline-first mobile app
- **Real-time Updates**: WebSocket support for live inventory updates
- **Payment Integration**: Support for multiple payment gateways
- **Comprehensive Reporting**: Analytics and business intelligence

## 🛠️ Technology Stack

- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with refresh tokens
- **Real-time**: Socket.io for WebSocket connections
- **Validation**: Joi for request validation
- **Security**: Helmet, CORS, rate limiting
- **Logging**: Winston
- **Testing**: Jest with Supertest

## 📁 Project Structure

```
backend/
├── src/
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Custom middleware
│   ├── models/         # Database models
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── utils/          # Utility functions
│   ├── types/          # TypeScript type definitions
│   └── app.ts          # Express app configuration
├── tests/              # Test files
├── docs/               # API documentation
├── scripts/            # Database scripts and utilities
├── .env.example        # Environment variables template
├── .gitignore          # Git ignore patterns
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
└── README.md          # This file
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database Setup**
   ```bash
   # Start MongoDB (if running locally)
   mongod
   
   # Or configure MongoDB Atlas connection in .env
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3000` (or your configured PORT).

## 🔧 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues
- `npm run type-check` - Run TypeScript type checking

## 🔐 Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/handeePOS
# or for MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/handeePOS

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Payment Gateways
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email Configuration (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# File Upload
MAX_FILE_SIZE=10485760  # 10MB
UPLOAD_PATH=./uploads

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=http://localhost:3000
```

## 📚 API Documentation

### Authentication Endpoints

- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh-token` - Refresh JWT token
- `POST /api/auth/change-password` - Change user password

### Products Endpoints

- `GET /api/products` - List all products
- `GET /api/products/:id` - Get single product
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `GET /api/products/search` - Search products
- `POST /api/products/bulk-import` - Bulk import products

### Orders Endpoints

- `GET /api/orders` - List orders
- `GET /api/orders/:id` - Get single order
- `POST /api/orders` - Create order
- `PUT /api/orders/:id/refund` - Process refund
- `GET /api/orders/stats` - Get sales statistics

### Inventory Endpoints

- `GET /api/inventory/:productId` - Get stock level
- `POST /api/inventory/adjust` - Adjust stock
- `GET /api/inventory/adjustments` - Get adjustment history
- `GET /api/inventory/valuation` - Get inventory valuation

### Customers Endpoints

- `GET /api/customers` - List customers
- `GET /api/customers/:id` - Get customer details
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `GET /api/customers/search` - Search customers

### Reports Endpoints

- `GET /api/reports/sales` - Sales reports
- `GET /api/reports/products` - Product performance
- `GET /api/reports/payments` - Payment method breakdown
- `GET /api/reports/staff-performance` - Staff performance

### Sync Endpoints

- `POST /api/sync/pull` - Pull server changes
- `POST /api/sync/push` - Push local changes
- `GET /api/sync/status` - Check sync status

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Granular permissions per user role
- **Rate Limiting**: Prevent API abuse
- **Input Validation**: Comprehensive request validation
- **CORS Protection**: Configured cross-origin resource sharing
- **Helmet Security**: Security headers protection
- **Password Hashing**: bcrypt for secure password storage

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 📊 Monitoring & Logging

- **Winston Logger**: Structured logging with different levels
- **Error Tracking**: Comprehensive error handling and logging
- **Performance Monitoring**: Request timing and performance metrics
- **Health Checks**: Server health and database connectivity

## 🚀 Deployment

### Production Build

```bash
npm run build
npm start
```

### Docker Deployment

```bash
# Build Docker image
docker build -t handeepos-backend .

# Run container
docker run -p 3000:3000 handeepos-backend
```

### Environment-Specific Configuration

- **Development**: Hot reload, detailed logging
- **Staging**: Production-like with test data
- **Production**: Optimized performance, security hardening

## 🔄 Database Migrations

```bash
# Run migrations
npm run migrate

# Rollback migrations
npm run migrate:rollback
```

## 📈 Performance Optimization

- **Database Indexing**: Optimized queries with proper indexes
- **Caching**: Redis for frequently accessed data
- **Connection Pooling**: Efficient database connections
- **Compression**: Gzip compression for responses
- **Pagination**: Efficient data pagination

## 🤝 Contributing

1. Follow the existing code style
2. Write tests for new features
3. Update documentation
4. Ensure all tests pass
5. Submit a pull request

## 📞 Support

For backend-specific issues:
- Check the logs for error details
- Review the API documentation
- Create an issue in the repository

---

**HandeePOS Backend** - Powering the future of point-of-sale systems.
