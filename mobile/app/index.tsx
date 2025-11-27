import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '../src/stores/authStore';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { isAuthenticated, isLoading, isHydrated } = useAuthStore();

  useEffect(() => {
    console.log('Root index.tsx is loading - checking auth state', { isHydrated, isAuthenticated });
  }, [isHydrated, isAuthenticated]);

  // Show loading while checking authentication and hydration
  if (isLoading || !isHydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Redirect based on authentication state
  return <Redirect href={isAuthenticated ? '/(tabs)' : '/(auth)/login'} />;
}
