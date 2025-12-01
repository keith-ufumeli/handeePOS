import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '../src/stores/authStore';
import { View, ActivityIndicator } from 'react-native';
import WelcomeScreen from '../src/components/WelcomeScreen';

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

  // If authenticated, redirect to main app
  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  // If not authenticated, show welcome screen with connection status
  return <WelcomeScreen />;
}
