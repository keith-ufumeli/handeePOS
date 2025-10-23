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
      url: 'https://api.handeepos.com',
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
      }
    }
  },
  security: [
    {
      bearerAuth: []
    }
  ]
};

const options = {
  definition: swaggerDefinition,
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'] // Path to the API docs
};

export const swaggerSpec = swaggerJsdoc(options);
