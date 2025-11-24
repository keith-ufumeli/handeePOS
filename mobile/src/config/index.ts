export const config = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://handeepos.onrender.com',
  authTokenKey: process.env.EXPO_PUBLIC_AUTH_TOKEN_KEY || '641a0887027fe9d70e97422949ecfe99',
  syncInterval: 30000, // 30 seconds
  maxRetries: 3,
  timeout: 10000, // 10 seconds
} as const;

export default config;
