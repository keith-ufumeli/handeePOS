import dotenv from 'dotenv';

// Load test environment variables from .env.test if present
dotenv.config({ path: '.env.test' });

// Fallback values for unit tests that run without a .env.test file.
// These are safe test-only secrets — never use in production.
const testEnvDefaults: Record<string, string> = {
  JWT_SECRET: 'test-jwt-secret-minimum-32-chars-long!!',
  JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-minimum-32!!',
  JWT_DEVICE_SECRET: 'test-jwt-device-secret-minimum-32!!',
  JWT_EXPIRES_IN: '15m',
  JWT_EXPIRES_IN_REMEMBERED: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  JWT_REFRESH_EXPIRES_IN_REMEMBERED: '30d',
  JWT_OCT_EXPIRES_IN: '24h',
  JWT_DEVICE_EXPIRES_IN: '365d',
};

for (const [key, value] of Object.entries(testEnvDefaults)) {
  if (!process.env[key]) process.env[key] = value;
}

// Global test setup
beforeAll(async () => {
  // Database connection is set up per-test-file for integration tests.
  // Unit tests (auth.service.test.ts) do not require a DB connection.
});

afterAll(async () => {
  // Per-test-file teardown handles DB cleanup.
});
