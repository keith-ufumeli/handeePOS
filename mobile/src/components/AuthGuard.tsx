import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { useNetInfo } from '@react-native-community/netinfo';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isHydrated, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const netInfo = useNetInfo();

  useEffect(() => {
    if (!isHydrated) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (isAuthenticated && inAuthGroup) {
      // If user is signed in and trying to access auth routes (login/register),
      // redirect to the main app
      router.replace('/(tabs)');
    } else if (!isAuthenticated && !inAuthGroup) {
      // If user is not signed in and trying to access protected routes,
      // redirect to login
      console.log('[AuthGuard] User not authenticated, redirecting to login');
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, segments, isHydrated, router]);

  // Show loading indicator while checking auth state or hydrating
  if (isLoading || !isHydrated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  // If we are offline and authenticated, we should allow access
  // The sync service will handle queuing actions
  // The api service should handle network errors gracefully

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
