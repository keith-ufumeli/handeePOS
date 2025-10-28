import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '../src/stores/authStore';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    console.log('Root index.tsx is loading - checking auth state');
  }, []);

  // Show nothing while checking authentication
  if (isLoading) {
    return null;
  }

  // Redirect based on authentication state
  return <Redirect href={isAuthenticated ? '/(tabs)' : '/(auth)/login'} />;
}
