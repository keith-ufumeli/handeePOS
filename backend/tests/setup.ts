import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Global test setup
beforeAll(async () => {
  // Setup test database connection
  // This will be implemented when we add database models
});

afterAll(async () => {
  // Cleanup test database
  // This will be implemented when we add database models
});

// Global test utilities
global.testUtils = {
  // Add common test utilities here
};
