import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { AuthStatus } from '../src/types/auth';
import WelcomeScreen from '../src/components/WelcomeScreen';

export default function Index() {
  const { authStatus, isAuthenticated, isLoading, isHydrated, statusMessage } = useAuthStore();

  useEffect(() => {
    console.log('Root index.tsx — auth state', { isHydrated, authStatus, isAuthenticated });
  }, [isHydrated, authStatus, isAuthenticated]);

  // Hold render until Zustand has loaded the persisted user from AsyncStorage
  // and initialize() has finished deriving authStatus from Secure Store.
  if (isLoading || !isHydrated) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Mid-sync: refresh token is being validated with the server after reconnect.
  // Keep the user in place rather than flashing a redirect.
  if (authStatus === AuthStatus.PENDING_SYNC) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.syncMessage}>{statusMessage ?? 'Verifying your session...'}</Text>
      </View>
    );
  }

  // Active session (online or offline with in-memory OCT) → main app
  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  // Needs online sign-in → login screen
  // Covers: SESSION_EXPIRED, INVALIDATED, OFFLINE_AUTHENTICATED (needs offline re-auth)
  if (
    authStatus === AuthStatus.SESSION_EXPIRED ||
    authStatus === AuthStatus.INVALIDATED ||
    authStatus === AuthStatus.OFFLINE_AUTHENTICATED
  ) {
    return <Redirect href="/(auth)/login" />;
  }

  // UNAUTHENTICATED — first-time user or fully logged out → welcome screen
  return <WelcomeScreen />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncMessage: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
});
