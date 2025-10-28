export const config = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
  syncInterval: 30000, // 30 seconds
  maxRetries: 3,
  timeout: 10000, // 10 seconds
} as const;

export default config;
