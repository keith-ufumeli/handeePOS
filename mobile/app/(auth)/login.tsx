import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '../../components/themed-view';
import { ThemedText } from '../../components/themed-text';
import { useAuthStore } from '../../src/stores/authStore';
import { AuthStatus } from '../../src/types/auth';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const {
    login,
    offlineLogin,
    error,
    isLoading,
    clearError,
    isAuthenticated,
    authStatus,
    statusMessage,
    user,
  } = useAuthStore();

  // Navigate to main app after any successful authentication (online or offline)
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, router]);

  // Offline mode: app started offline, user has prior session on this device.
  // Show password-only form — email is pre-filled from the stored user profile.
  const isOfflineMode = authStatus === AuthStatus.OFFLINE_AUTHENTICATED;

  const handleOnlineLogin = async () => {
    try {
      await login(email, password, rememberMe);
    } catch (err) {
      console.error('[LOGIN_SCREEN] Online login error:', err instanceof Error ? err.message : String(err));
    }
  };

  const handleOfflineLogin = async () => {
    if (!user?.userId) return;
    try {
      await offlineLogin(user.userId, password);
    } catch (err) {
      console.error('[LOGIN_SCREEN] Offline login error:', err instanceof Error ? err.message : String(err));
    }
  };

  // ── Offline login UI ──────────────────────────────────────────────────────────
  if (isOfflineMode) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>
          Offline Sign In
        </ThemedText>

        <ThemedText style={styles.offlineInfo}>
          You&apos;re offline. Enter your password to continue working.
        </ThemedText>

        {statusMessage ? (
          <ThemedText style={styles.statusMessage}>{statusMessage}</ThemedText>
        ) : null}

        {/* Pre-filled user identity — read-only */}
        <View style={[styles.input, styles.readonlyInput]}>
          <ThemedText style={styles.readonlyText}>{user?.email ?? ''}</ThemedText>
        </View>

        {error ? (
          <ThemedText style={styles.error}>{error}</ThemedText>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={(v) => {
            clearError();
            setPassword(v);
          }}
          secureTextEntry
          autoFocus
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleOfflineLogin}
          disabled={isLoading || !password}
        >
          <ThemedText style={styles.buttonText}>
            {isLoading ? 'Verifying...' : 'Continue Offline'}
          </ThemedText>
        </TouchableOpacity>

        <ThemedText style={styles.offlineFootnote}>
          Offline access is limited to previously cached data.
          Connect to the internet to sync the latest changes.
        </ThemedText>
      </ThemedView>
    );
  }

  // ── Standard online login UI ──────────────────────────────────────────────────

  // Show context-aware banner when redirected from expired / invalidated state
  const contextBanner =
    authStatus === AuthStatus.SESSION_EXPIRED || authStatus === AuthStatus.INVALIDATED
      ? statusMessage
      : null;

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Welcome Back
      </ThemedText>

      {contextBanner ? (
        <ThemedText style={styles.statusMessage}>{contextBanner}</ThemedText>
      ) : null}

      {error ? (
        <ThemedText style={styles.error}>{error}</ThemedText>
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleOnlineLogin}
        disabled={isLoading}
      >
        <ThemedText style={styles.buttonText}>
          {isLoading ? 'Logging in...' : 'Login'}
        </ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.rememberMeContainer}
        onPress={() => setRememberMe(!rememberMe)}
      >
        <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]} />
        <ThemedText>Remember me</ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          clearError();
          router.push('/(auth)/forgot-password' as any);
        }}
      >
        <ThemedText type="link" style={styles.forgotPassword}>
          Forgot password?
        </ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          clearError();
          router.push('/register');
        }}
      >
        <ThemedText type="link" style={styles.registerLink}>
          Don&apos;t have an account? Register here
        </ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    marginBottom: 24,
    textAlign: 'center',
  },
  offlineInfo: {
    textAlign: 'center',
    marginBottom: 16,
    color: '#555',
  },
  offlineFootnote: {
    marginTop: 20,
    textAlign: 'center',
    fontSize: 12,
    color: '#888',
  },
  statusMessage: {
    color: '#e67e00',
    marginBottom: 16,
    textAlign: 'center',
    fontSize: 14,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  readonlyInput: {
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  readonlyText: {
    color: '#555',
  },
  button: {
    backgroundColor: '#0a7ea4',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#ff3b30',
    marginBottom: 16,
    textAlign: 'center',
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#0a7ea4',
    borderRadius: 4,
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#0a7ea4',
  },
  forgotPassword: {
    marginBottom: 10,
    textAlign: 'center',
  },
  registerLink: {
    marginTop: 20,
    textAlign: 'center',
  },
});
