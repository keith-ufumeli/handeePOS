import swaggerJsdoc from 'swagger-jsdoc';
import { SwaggerDefinition } from 'swagger-jsdoc';

const swaggerDefinition: SwaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'HandeePOS API',
    version: '1.0.0',
    description: 'API documentation for HandeePOS Point of Sale system',
    contact: {
      name: 'HandeePOS Team',
      email: 'support@handeepos.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server'
    },
    {
      url: 'https://handeepos.onrender.com',
      description: 'Production server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            description: 'User ID'
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address'
          },
          fullName: {
            type: 'string',
            description: 'User full name'
          },
          role: {
            type: 'string',
            enum: ['admin', 'manager', 'cashier', 'inventory'],
            description: 'User role'
          },
          storeId: {
            type: 'string',
            description: 'Store ID'
          },
          permissions: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'User permissions'
          },
          isActive: {
            type: 'boolean',
            description: 'User active status'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp'
          }
        }
      },
      Store: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            description: 'Store ID'
          },
          name: {
            type: 'string',
            description: 'Store name'
          },
          address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' },
              country: { type: 'string' },
              postalCode: { type: 'string' }
            }
          },
          currency: {
            type: 'string',
            enum: ['USD', 'EUR', 'GBP', 'ZAR', 'KES', 'NGN', 'GHS', 'ZWL'],
            description: 'Store currency'
          },
          timezone: {
            type: 'string',
            description: 'Store timezone'
          },
          isActive: {
            type: 'boolean',
            description: 'Store active status'
          }
        }
      },
      ApiResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'Response success status'
          },
          message: {
            type: 'string',
            description: 'Response message'
          },
          data: {
            type: 'object',
            description: 'Response data'
          },
          error: {
            type: 'string',
            description: 'Error message (if any)'
          }
        }
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address'
          },
          password: {
            type: 'string',
            minLength: 6,
            description: 'User password'
          }
        }
      },
      LoginResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean'
          },
          message: {
            type: 'string'
          },
          data: {
            type: 'object',
            properties: {
              user: {
                $ref: '#/components/schemas/User'
              },
              store: {
                $ref: '#/components/schemas/Store'
              },
              tokens: {
                type: 'object',
                properties: {
                  accessToken: {
                    type: 'string',
                    description: 'JWT access token'
                  },
                  refreshToken: {
                    type: 'string',
                    description: 'JWT refresh token'
                  }
                }
              }
            }
          }
        }
      },
      RefreshTokenRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: {
            type: 'string',
            description: 'JWT refresh token'
          }
        }
      },
      ChangePasswordRequest: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: {
            type: 'string',
            description: 'Current password'
          },
          newPassword: {
            type: 'string',
            minLength: 6,
            description: 'New password'
          }
        }
      },
      Product: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            description: 'Product ID'
          },
          storeId: {
            type: 'string',
            description: 'Store ID'
          },
          name: {
            type: 'string',
            description: 'Product name',
            maxLength: 200
          },
          sku: {
            type: 'string',
            description: 'Product SKU',
            maxLength: 50
          },
          barcode: {
            type: 'string',
            description: 'Product barcode',
            maxLength: 50
          },
          categoryId: {
            type: 'string',
            description: 'Category ID'
          },
          price: {
            type: 'number',
            description: 'Product price',
            minimum: 0
          },
          cost: {
            type: 'number',
            description: 'Product cost',
            minimum: 0
          },
          taxRate: {
            type: 'number',
            description: 'Tax rate percentage',
            minimum: 0,
            maximum: 100,
            default: 0
          },
          stockQuantity: {
            type: 'number',
            description: 'Current stock quantity',
            minimum: 0,
            default: 0
          },
          lowStockThreshold: {
            type: 'number',
            description: 'Low stock threshold',
            minimum: 0,
            default: 5
          },
          unit: {
            type: 'string',
            description: 'Product unit',
            maxLength: 20,
            default: 'pcs'
          },
          images: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Product images'
          },
          isActive: {
            type: 'boolean',
            description: 'Product active status',
            default: true
          },
          syncVersion: {
            type: 'number',
            description: 'Sync version for offline support',
            default: 1
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp'
          }
        }
      },
      Category: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            description: 'Category ID'
          },
          storeId: {
            type: 'string',
            description: 'Store ID'
          },
          name: {
            type: 'string',
            description: 'Category name',
            maxLength: 100
          },
          description: {
            type: 'string',
            description: 'Category description',
            maxLength: 500
          },
          isActive: {
            type: 'boolean',
            description: 'Category active status',
            default: true
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp'
          }
        }
      },
      OrderItem: {
        type: 'object',
        required: ['productId', 'productName', 'sku', 'quantity', 'unitPrice', 'subtotal'],
        properties: {
          productId: {
            type: 'string',
            description: 'Product ID'
          },
          productName: {
            type: 'string',
            description: 'Product name'
          },
          sku: {
            type: 'string',
            description: 'Product SKU'
          },
          quantity: {
            type: 'number',
            description: 'Item quantity',
            minimum: 1
          },
          unitPrice: {
            type: 'number',
            description: 'Unit price',
            minimum: 0
          },
          discount: {
            type: 'number',
            description: 'Item discount',
            minimum: 0,
            default: 0
          },
          tax: {
            type: 'number',
            description: 'Item tax',
            minimum: 0,
            default: 0
          },
          subtotal: {
            type: 'number',
            description: 'Item subtotal',
            minimum: 0
          }
        }
      },
      PaymentMethod: {
        type: 'object',
        required: ['method', 'amount'],
        properties: {
          method: {
            type: 'string',
            enum: ['cash', 'card', 'mobile_money'],
            description: 'Payment method'
          },
          amount: {
            type: 'number',
            description: 'Payment amount',
            minimum: 0
          },
          reference: {
            type: 'string',
            description: 'Payment reference'
          }
        }
      },
      Order: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            description: 'Order ID'
          },
          orderNumber: {
            type: 'string',
            description: 'Order number'
          },
          storeId: {
            type: 'string',
            description: 'Store ID'
          },
          cashierId: {
            type: 'string',
            description: 'Cashier ID'
          },
          customerId: {
            type: 'string',
            description: 'Customer ID'
          },
          items: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/OrderItem'
            },
            description: 'Order items'
          },
          subtotal: {
            type: 'number',
            description: 'Order subtotal',
            minimum: 0
          },
          taxAmount: {
            type: 'number',
            description: 'Total tax amount',
            minimum: 0
          },
          discountAmount: {
            type: 'number',
            description: 'Total discount amount',
            minimum: 0
          },
          total: {
            type: 'number',
            description: 'Order total',
            minimum: 0
          },
          payments: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/PaymentMethod'
            },
            description: 'Payment methods'
          },
          status: {
            type: 'string',
            enum: ['pending', 'completed', 'cancelled', 'refunded'],
            description: 'Order status',
            default: 'pending'
          },
          customNote: {
            type: 'string',
            description: 'Custom order note',
            maxLength: 500
          },
          syncStatus: {
            type: 'string',
            enum: ['synced', 'pending', 'failed'],
            description: 'Sync status',
            default: 'pending'
          },
          deviceId: {
            type: 'string',
            description: 'Device ID'
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp'
          },
          completedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Completion timestamp'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp'
          }
        }
      },
      Customer: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            description: 'Customer ID'
          },
          storeId: {
            type: 'string',
            description: 'Store ID'
          },
          name: {
            type: 'string',
            description: 'Customer name',
            maxLength: 100
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Customer email'
          },
          phoneNumber: {
            type: 'string',
            description: 'Customer phone number'
          },
          address: {
            type: 'object',
            properties: {
              street: {
                type: 'string',
                maxLength: 200
              },
              city: {
                type: 'string',
                maxLength: 50
              },
              country: {
                type: 'string',
                maxLength: 50
              },
              postalCode: {
                type: 'string',
                maxLength: 20
              }
            }
          },
          totalSpent: {
            type: 'number',
            description: 'Total amount spent',
            minimum: 0,
            default: 0
          },
          totalOrders: {
            type: 'number',
            description: 'Total number of orders',
            minimum: 0,
            default: 0
          },
          lastVisit: {
            type: 'string',
            format: 'date-time',
            description: 'Last visit date'
          },
          notes: {
            type: 'string',
            description: 'Customer notes',
            maxLength: 1000
          },
          loyaltyPoints: {
            type: 'number',
            description: 'Loyalty points',
            minimum: 0,
            default: 0
          },
          tier: {
            type: 'string',
            enum: ['bronze', 'silver', 'gold', 'platinum'],
            description: 'Customer tier',
            default: 'bronze'
          },
          isActive: {
            type: 'boolean',
            description: 'Customer active status',
            default: true
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp'
          }
        }
      },
      CreateProductRequest: {
        type: 'object',
        required: ['name', 'sku', 'categoryId', 'price', 'cost', 'stockQuantity', 'lowStockThreshold'],
        properties: {
          name: {
            type: 'string',
            description: 'Product name',
            maxLength: 200
          },
          sku: {
            type: 'string',
            description: 'Product SKU',
            maxLength: 50
          },
          barcode: {
            type: 'string',
            description: 'Product barcode',
            maxLength: 50
          },
          categoryId: {
            type: 'string',
            description: 'Category ID'
          },
          price: {
            type: 'number',
            description: 'Product price',
            minimum: 0
          },
          cost: {
            type: 'number',
            description: 'Product cost',
            minimum: 0
          },
          taxRate: {
            type: 'number',
            description: 'Tax rate percentage',
            minimum: 0,
            maximum: 100
          },
          stockQuantity: {
            type: 'number',
            description: 'Stock quantity',
            minimum: 0
          },
          lowStockThreshold: {
            type: 'number',
            description: 'Low stock threshold',
            minimum: 0
          },
          unit: {
            type: 'string',
            description: 'Product unit',
            maxLength: 20
          },
          images: {
            type: 'array',
            items: {
              type: 'string'
            },
            description: 'Product images'
          }
        }
      },
      CreateOrderRequest: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['productId', 'productName', 'sku', 'quantity', 'unitPrice', 'subtotal'],
              properties: {
                productId: {
                  type: 'string',
                  description: 'Product ID'
                },
                productName: {
                  type: 'string',
                  description: 'Product name'
                },
                sku: {
                  type: 'string',
                  description: 'Product SKU'
                },
                quantity: {
                  type: 'number',
                  description: 'Item quantity',
                  minimum: 1
                },
                unitPrice: {
                  type: 'number',
                  description: 'Unit price',
                  minimum: 0
                },
                subtotal: {
                  type: 'number',
                  description: 'Item subtotal',
                  minimum: 0
                }
              }
            },
            minItems: 1,
            description: 'Order items'
          },
          customerId: {
            type: 'string',
            description: 'Customer ID'
          },
          customNote: {
            type: 'string',
            description: 'Custom order note',
            maxLength: 500
          },
          payments: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/PaymentMethod'
            },
            description: 'Payment methods'
          },
          deviceId: {
            type: 'string',
            description: 'Device ID'
          }
        }
      },
      CreateCustomerRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            description: 'Customer name',
            maxLength: 100
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'Customer email'
          },
          phoneNumber: {
            type: 'string',
            description: 'Customer phone number'
          },
          address: {
            type: 'object',
            properties: {
              street: {
                type: 'string',
                maxLength: 200
              },
              city: {
                type: 'string',
                maxLength: 50
              },
              country: {
                type: 'string',
                maxLength: 50
              },
              postalCode: {
                type: 'string',
                maxLength: 20
              }
            }
          },
          notes: {
            type: 'string',
            description: 'Customer notes',
            maxLength: 1000
          }
        }
      },
      CreateCategoryRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            description: 'Category name',
            maxLength: 100
          },
          description: {
            type: 'string',
            description: 'Category description',
            maxLength: 500
          }
        }
      },
      UpdateStockRequest: {
        type: 'object',
        required: ['stockQuantity'],
        properties: {
          stockQuantity: {
            type: 'number',
            description: 'New stock quantity',
            minimum: 0
          },
          reason: {
            type: 'string',
            description: 'Reason for stock update'
          }
        }
      },
      UpdateOrderStatusRequest: {
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'completed', 'cancelled', 'refunded'],
            description: 'New order status'
          }
        }
      },
      UpdateLoyaltyPointsRequest: {
        type: 'object',
        required: ['points'],
        properties: {
          points: {
            type: 'number',
            description: 'Points to add or subtract'
          },
          operation: {
            type: 'string',
            enum: ['add', 'subtract'],
            description: 'Operation type',
            default: 'add'
          }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'Response success status',
            example: false
          },
          message: {
            type: 'string',
            description: 'Error message'
          },
          error: {
            type: 'string',
            description: 'Detailed error information'
          },
          details: {
            type: 'object',
            description: 'Additional error details'
          }
        }
      },
      ValidationError: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'Response success status',
            example: false
          },
          message: {
            type: 'string',
            description: 'Validation error message',
            example: 'Validation failed'
          },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: {
                  type: 'string',
                  description: 'Field name'
                },
                message: {
                  type: 'string',
                  description: 'Error message'
                },
                value: {
                  type: 'string',
                  description: 'Invalid value'
                }
              }
            },
            description: 'Validation errors'
          }
        }
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ],
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check endpoint',
        description: 'Check if the API is running and get system status',
        responses: {
          '200': {
            description: 'API is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: {
                      type: 'string',
                      example: 'OK'
                    },
                    timestamp: {
                      type: 'string',
                      format: 'date-time'
                    },
                    uptime: {
                      type: 'number',
                      description: 'Server uptime in seconds'
                    },
                    environment: {
                      type: 'string',
                      example: 'development'
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'User login',
        description: 'Authenticate user and return access tokens',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/LoginRequest'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/LoginResponse'
                }
              }
            }
          },
          '400': {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/api/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Refresh access token',
        description: 'Get new access token using refresh token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RefreshTokenRequest'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Token refreshed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                    data: {
                      type: 'object',
                      properties: {
                        accessToken: { type: 'string' },
                        refreshToken: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': {
            description: 'Invalid refresh token',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/api/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'User logout',
        description: 'Logout user and invalidate tokens',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Logout successful',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiResponse'
                }
              }
            }
          }
        }
      }
    },
    '/api/auth/change-password': {
      post: {
        tags: ['Authentication'],
        summary: 'Change password',
        description: 'Change user password',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ChangePasswordRequest'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Password changed successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiResponse'
                }
              }
            }
          },
          '400': {
            description: 'Invalid current password',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/api/products': {
      get: {
        tags: ['Products'],
        summary: 'Get all products',
        description: 'Retrieve all products with search, filter, and pagination',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'page',
            in: 'query',
            description: 'Page number',
            schema: { type: 'integer', minimum: 1, default: 1 }
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Items per page',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
          },
          {
            name: 'search',
            in: 'query',
            description: 'Search term for name, SKU, or barcode',
            schema: { type: 'string' }
          },
          {
            name: 'categoryId',
            in: 'query',
            description: 'Filter by category ID',
            schema: { type: 'string' }
          },
          {
            name: 'isActive',
            in: 'query',
            description: 'Filter by active status',
            schema: { type: 'boolean' }
          }
        ],
        responses: {
          '200': {
            description: 'Products retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            products: {
                              type: 'array',
                              items: { $ref: '#/components/schemas/Product' }
                            },
                            pagination: {
                              type: 'object',
                              properties: {
                                page: { type: 'integer' },
                                limit: { type: 'integer' },
                                total: { type: 'integer' },
                                pages: { type: 'integer' }
                              }
                            }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Products'],
        summary: 'Create product',
        description: 'Create a new product',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateProductRequest'
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Product created successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/Product'
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ValidationError'
                }
              }
            }
          }
        }
      }
    },
    '/api/products/low-stock': {
      get: {
        tags: ['Products'],
        summary: 'Get low stock products',
        description: 'Retrieve products that are below their low stock threshold',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Low stock products retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Product' }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    '/api/products/search': {
      get: {
        tags: ['Products'],
        summary: 'Search products by barcode',
        description: 'Search for a product using its barcode',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'barcode',
            in: 'query',
            required: true,
            description: 'Product barcode',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Product found',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/Product'
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '404': {
            description: 'Product not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/api/products/{id}': {
      get: {
        tags: ['Products'],
        summary: 'Get product by ID',
        description: 'Retrieve a single product by its ID',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Product ID',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Product retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/Product'
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '404': {
            description: 'Product not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      },
      put: {
        tags: ['Products'],
        summary: 'Update product',
        description: 'Update an existing product',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Product ID',
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateProductRequest'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Product updated successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/Product'
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '404': {
            description: 'Product not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      },
      delete: {
        tags: ['Products'],
        summary: 'Delete product',
        description: 'Delete a product',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Product ID',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Product deleted successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiResponse'
                }
              }
            }
          },
          '404': {
            description: 'Product not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/api/products/{id}/stock': {
      put: {
        tags: ['Products'],
        summary: 'Update product stock',
        description: 'Update the stock quantity of a product',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Product ID',
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateStockRequest'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Stock updated successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/Product'
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '404': {
            description: 'Product not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/api/products/categories': {
      get: {
        tags: ['Categories'],
        summary: 'Get all categories',
        description: 'Retrieve all product categories',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Categories retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Category' }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Categories'],
        summary: 'Create category',
        description: 'Create a new product category',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateCategoryRequest'
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Category created successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/Category'
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    '/api/products/categories/{id}': {
      get: {
        tags: ['Categories'],
        summary: 'Get category by ID',
        description: 'Retrieve a single category by its ID',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Category ID',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Category retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/Category'
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      },
      put: {
        tags: ['Categories'],
        summary: 'Update category',
        description: 'Update an existing category',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Category ID',
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateCategoryRequest'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Category updated successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/Category'
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      },
      delete: {
        tags: ['Categories'],
        summary: 'Delete category',
        description: 'Delete a category',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Category ID',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Category deleted successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiResponse'
                }
              }
            }
          }
        }
      }
    },
    '/api/orders': {
      get: {
        tags: ['Orders'],
        summary: 'Get all orders',
        description: 'Retrieve all orders with filters and pagination',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'page',
            in: 'query',
            description: 'Page number',
            schema: { type: 'integer', minimum: 1, default: 1 }
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Items per page',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
          },
          {
            name: 'status',
            in: 'query',
            description: 'Filter by order status',
            schema: { type: 'string', enum: ['pending', 'completed', 'cancelled', 'refunded'] }
          },
          {
            name: 'startDate',
            in: 'query',
            description: 'Start date filter (ISO 8601)',
            schema: { type: 'string', format: 'date-time' }
          },
          {
            name: 'endDate',
            in: 'query',
            description: 'End date filter (ISO 8601)',
            schema: { type: 'string', format: 'date-time' }
          }
        ],
        responses: {
          '200': {
            description: 'Orders retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            orders: {
                              type: 'array',
                              items: { $ref: '#/components/schemas/Order' }
                            },
                            pagination: {
                              type: 'object',
                              properties: {
                                page: { type: 'integer' },
                                limit: { type: 'integer' },
                                total: { type: 'integer' },
                                pages: { type: 'integer' }
                              }
                            }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Orders'],
        summary: 'Create order',
        description: 'Create a new order',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateOrderRequest'
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Order created successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/Order'
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ValidationError'
                }
              }
            }
          }
        }
      }
    },
    '/api/orders/stats': {
      get: {
        tags: ['Orders'],
        summary: 'Get order statistics',
        description: 'Retrieve order statistics and metrics',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'startDate',
            in: 'query',
            description: 'Start date for statistics (ISO 8601)',
            schema: { type: 'string', format: 'date-time' }
          },
          {
            name: 'endDate',
            in: 'query',
            description: 'End date for statistics (ISO 8601)',
            schema: { type: 'string', format: 'date-time' }
          }
        ],
        responses: {
          '200': {
            description: 'Order statistics retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            totalOrders: { type: 'integer' },
                            totalRevenue: { type: 'number' },
                            averageOrderValue: { type: 'number' },
                            totalTax: { type: 'number' },
                            totalDiscount: { type: 'number' }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    '/api/orders/payment-breakdown': {
      get: {
        tags: ['Orders'],
        summary: 'Get payment method breakdown',
        description: 'Retrieve payment method statistics',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'startDate',
            in: 'query',
            description: 'Start date for breakdown (ISO 8601)',
            schema: { type: 'string', format: 'date-time' }
          },
          {
            name: 'endDate',
            in: 'query',
            description: 'End date for breakdown (ISO 8601)',
            schema: { type: 'string', format: 'date-time' }
          }
        ],
        responses: {
          '200': {
            description: 'Payment breakdown retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              method: { type: 'string' },
                              totalAmount: { type: 'number' },
                              transactionCount: { type: 'integer' }
                            }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    '/api/orders/{id}': {
      get: {
        tags: ['Orders'],
        summary: 'Get order by ID',
        description: 'Retrieve a single order by its ID',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Order ID',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Order retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/Order'
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '404': {
            description: 'Order not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      },
      delete: {
        tags: ['Orders'],
        summary: 'Cancel order',
        description: 'Cancel an existing order',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Order ID',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Order cancelled successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiResponse'
                }
              }
            }
          },
          '404': {
            description: 'Order not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/api/orders/{id}/status': {
      put: {
        tags: ['Orders'],
        summary: 'Update order status',
        description: 'Update the status of an order',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Order ID',
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateOrderStatusRequest'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Order status updated successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/Order'
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '404': {
            description: 'Order not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/api/customers': {
      get: {
        tags: ['Customers'],
        summary: 'Get all customers',
        description: 'Retrieve all customers with search and pagination',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'page',
            in: 'query',
            description: 'Page number',
            schema: { type: 'integer', minimum: 1, default: 1 }
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Items per page',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 }
          },
          {
            name: 'search',
            in: 'query',
            description: 'Search term for name, email, or phone',
            schema: { type: 'string' }
          },
          {
            name: 'tier',
            in: 'query',
            description: 'Filter by customer tier',
            schema: { type: 'string', enum: ['bronze', 'silver', 'gold', 'platinum'] }
          }
        ],
        responses: {
          '200': {
            description: 'Customers retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            customers: {
                              type: 'array',
                              items: { $ref: '#/components/schemas/Customer' }
                            },
                            pagination: {
                              type: 'object',
                              properties: {
                                page: { type: 'integer' },
                                limit: { type: 'integer' },
                                total: { type: 'integer' },
                                pages: { type: 'integer' }
                              }
                            }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Customers'],
        summary: 'Create customer',
        description: 'Create a new customer',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateCustomerRequest'
              }
            }
          }
        },
        responses: {
          '201': {
            description: 'Customer created successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/Customer'
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '400': {
            description: 'Validation error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ValidationError'
                }
              }
            }
          }
        }
      }
    },
    '/api/customers/search': {
      get: {
        tags: ['Customers'],
        summary: 'Search customers',
        description: 'Search customers by name, email, or phone number',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'query',
            in: 'query',
            required: true,
            description: 'Search query',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Customers found',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Customer' }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    '/api/customers/stats': {
      get: {
        tags: ['Customers'],
        summary: 'Get customer statistics',
        description: 'Retrieve customer statistics and analytics',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Customer statistics retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            totalCustomers: { type: 'integer' },
                            totalSpent: { type: 'number' },
                            averageSpent: { type: 'number' },
                            totalOrders: { type: 'integer' },
                            averageOrders: { type: 'number' },
                            totalLoyaltyPoints: { type: 'number' }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    '/api/customers/{id}': {
      get: {
        tags: ['Customers'],
        summary: 'Get customer by ID',
        description: 'Retrieve a single customer by its ID',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Customer ID',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Customer retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/Customer'
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '404': {
            description: 'Customer not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      },
      put: {
        tags: ['Customers'],
        summary: 'Update customer',
        description: 'Update an existing customer',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Customer ID',
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateCustomerRequest'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Customer updated successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/Customer'
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '404': {
            description: 'Customer not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      },
      delete: {
        tags: ['Customers'],
        summary: 'Delete customer',
        description: 'Delete a customer',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Customer ID',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Customer deleted successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiResponse'
                }
              }
            }
          },
          '404': {
            description: 'Customer not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/api/customers/{id}/loyalty': {
      put: {
        tags: ['Customers'],
        summary: 'Update customer loyalty points',
        description: 'Add or subtract loyalty points for a customer',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Customer ID',
            schema: { type: 'string' }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/UpdateLoyaltyPointsRequest'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Loyalty points updated successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/Customer'
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '404': {
            description: 'Customer not found',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    },
    '/api/reports/daily-summary': {
      get: {
        tags: ['Reports'],
        summary: 'Get daily sales summary',
        description: 'Retrieve daily sales summary report',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'date',
            in: 'query',
            description: 'Date for summary (ISO 8601)',
            schema: { type: 'string', format: 'date' }
          }
        ],
        responses: {
          '200': {
            description: 'Daily summary retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            date: { type: 'string', format: 'date' },
                            totalOrders: { type: 'integer' },
                            totalRevenue: { type: 'number' },
                            averageOrderValue: { type: 'number' },
                            totalTax: { type: 'number' },
                            totalDiscount: { type: 'number' }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    '/api/reports/sales': {
      get: {
        tags: ['Reports'],
        summary: 'Get sales report',
        description: 'Retrieve sales report for a date range',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'startDate',
            in: 'query',
            required: true,
            description: 'Start date (ISO 8601)',
            schema: { type: 'string', format: 'date' }
          },
          {
            name: 'endDate',
            in: 'query',
            required: true,
            description: 'End date (ISO 8601)',
            schema: { type: 'string', format: 'date' }
          }
        ],
        responses: {
          '200': {
            description: 'Sales report retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            period: {
                              type: 'object',
                              properties: {
                                startDate: { type: 'string', format: 'date' },
                                endDate: { type: 'string', format: 'date' }
                              }
                            },
                            summary: {
                              type: 'object',
                              properties: {
                                totalOrders: { type: 'integer' },
                                totalRevenue: { type: 'number' },
                                averageOrderValue: { type: 'number' },
                                totalTax: { type: 'number' },
                                totalDiscount: { type: 'number' }
                              }
                            },
                            dailyBreakdown: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  date: { type: 'string', format: 'date' },
                                  orders: { type: 'integer' },
                                  revenue: { type: 'number' }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    '/api/reports/products': {
      get: {
        tags: ['Reports'],
        summary: 'Get product performance report',
        description: 'Retrieve product performance analytics',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'startDate',
            in: 'query',
            required: true,
            description: 'Start date (ISO 8601)',
            schema: { type: 'string', format: 'date' }
          },
          {
            name: 'endDate',
            in: 'query',
            required: true,
            description: 'End date (ISO 8601)',
            schema: { type: 'string', format: 'date' }
          }
        ],
        responses: {
          '200': {
            description: 'Product performance report retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              productId: { type: 'string' },
                              productName: { type: 'string' },
                              sku: { type: 'string' },
                              quantitySold: { type: 'integer' },
                              totalRevenue: { type: 'number' },
                              averagePrice: { type: 'number' }
                            }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    '/api/reports/inventory': {
      get: {
        tags: ['Reports'],
        summary: 'Get inventory valuation report',
        description: 'Retrieve inventory valuation and stock levels',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Inventory valuation report retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            totalValue: { type: 'number' },
                            totalItems: { type: 'integer' },
                            lowStockItems: { type: 'integer' },
                            outOfStockItems: { type: 'integer' },
                            products: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  productId: { type: 'string' },
                                  productName: { type: 'string' },
                                  sku: { type: 'string' },
                                  stockQuantity: { type: 'integer' },
                                  cost: { type: 'number' },
                                  value: { type: 'number' },
                                  isLowStock: { type: 'boolean' }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    '/api/reports/customers': {
      get: {
        tags: ['Reports'],
        summary: 'Get customer analytics',
        description: 'Retrieve customer analytics and insights',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'startDate',
            in: 'query',
            required: true,
            description: 'Start date (ISO 8601)',
            schema: { type: 'string', format: 'date' }
          },
          {
            name: 'endDate',
            in: 'query',
            required: true,
            description: 'End date (ISO 8601)',
            schema: { type: 'string', format: 'date' }
          }
        ],
        responses: {
          '200': {
            description: 'Customer analytics retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            totalCustomers: { type: 'integer' },
                            newCustomers: { type: 'integer' },
                            returningCustomers: { type: 'integer' },
                            averageOrderValue: { type: 'number' },
                            customerTiers: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  tier: { type: 'string' },
                                  count: { type: 'integer' },
                                  totalSpent: { type: 'number' }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    '/api/settings/store': {
      get: {
        tags: ['Settings'],
        summary: 'Get store settings',
        description: 'Retrieve store configuration settings',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Store settings retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/Store'
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      },
      put: {
        tags: ['Settings'],
        summary: 'Update store settings',
        description: 'Update store configuration settings',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Store'
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Store settings updated successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          $ref: '#/components/schemas/Store'
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    '/api/settings/receipt': {
      put: {
        tags: ['Settings'],
        summary: 'Update receipt settings',
        description: 'Update receipt printer and format settings',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  printerName: { type: 'string' },
                  paperSize: { type: 'string', enum: ['A4', 'A5', 'Thermal'] },
                  headerText: { type: 'string' },
                  footerText: { type: 'string' },
                  showLogo: { type: 'boolean' },
                  fontSize: { type: 'string', enum: ['small', 'medium', 'large'] }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Receipt settings updated successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiResponse'
                }
              }
            }
          }
        }
      }
    },
    '/api/settings/tax': {
      put: {
        tags: ['Settings'],
        summary: 'Update tax settings',
        description: 'Update tax configuration settings',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  defaultTaxRate: { type: 'number', minimum: 0, maximum: 100 },
                  taxInclusive: { type: 'boolean' },
                  taxName: { type: 'string' },
                  taxNumber: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Tax settings updated successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiResponse'
                }
              }
            }
          }
        }
      }
    },
    '/api/settings/business-hours': {
      put: {
        tags: ['Settings'],
        summary: 'Update business hours',
        description: 'Update store business hours',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  monday: {
                    type: 'object',
                    properties: {
                      open: { type: 'string', format: 'time' },
                      close: { type: 'string', format: 'time' },
                      isOpen: { type: 'boolean' }
                    }
                  },
                  tuesday: {
                    type: 'object',
                    properties: {
                      open: { type: 'string', format: 'time' },
                      close: { type: 'string', format: 'time' },
                      isOpen: { type: 'boolean' }
                    }
                  },
                  wednesday: {
                    type: 'object',
                    properties: {
                      open: { type: 'string', format: 'time' },
                      close: { type: 'string', format: 'time' },
                      isOpen: { type: 'boolean' }
                    }
                  },
                  thursday: {
                    type: 'object',
                    properties: {
                      open: { type: 'string', format: 'time' },
                      close: { type: 'string', format: 'time' },
                      isOpen: { type: 'boolean' }
                    }
                  },
                  friday: {
                    type: 'object',
                    properties: {
                      open: { type: 'string', format: 'time' },
                      close: { type: 'string', format: 'time' },
                      isOpen: { type: 'boolean' }
                    }
                  },
                  saturday: {
                    type: 'object',
                    properties: {
                      open: { type: 'string', format: 'time' },
                      close: { type: 'string', format: 'time' },
                      isOpen: { type: 'boolean' }
                    }
                  },
                  sunday: {
                    type: 'object',
                    properties: {
                      open: { type: 'string', format: 'time' },
                      close: { type: 'string', format: 'time' },
                      isOpen: { type: 'boolean' }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Business hours updated successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiResponse'
                }
              }
            }
          }
        }
      }
    },
    '/api/settings/system': {
      get: {
        tags: ['Settings'],
        summary: 'Get system information',
        description: 'Retrieve system information and status',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'System information retrieved successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/ApiResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            version: { type: 'string' },
                            uptime: { type: 'number' },
                            memoryUsage: { type: 'number' },
                            diskUsage: { type: 'number' },
                            lastBackup: { type: 'string', format: 'date-time' },
                            databaseStatus: { type: 'string' }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    '/api/settings/test-receipt': {
      post: {
        tags: ['Settings'],
        summary: 'Test receipt printer',
        description: 'Send a test receipt to the configured printer',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Test receipt sent successfully',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiResponse'
                }
              }
            }
          },
          '500': {
            description: 'Printer error',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ErrorResponse'
                }
              }
            }
          }
        }
      }
    }
  }
};

const options = {
  definition: swaggerDefinition,
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'] // Path to the API docs
};

export const swaggerSpec = swaggerJsdoc(options);
