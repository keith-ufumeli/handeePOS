import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '../../components/themed-view';
import { ThemedText } from '../../components/themed-text';
import { Colors } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';
import apiService from '../../src/services/apiService';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleForgotPassword = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setMessage(null);

      await apiService.forgotPassword(email);
      setMessage('If your email is registered, you will receive a password reset link');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
      console.error('Forgot password error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Reset Password
      </ThemedText>
      
      {message && (
        <ThemedText style={[styles.message, { color: theme.success }]}>
          {message}
        </ThemedText>
      )}

      {error && (
        <ThemedText style={[styles.error, { color: theme.error }]}>
          {error}
        </ThemedText>
      )}

      <TextInput
        style={[styles.input, { borderColor: theme.border, backgroundColor: theme.cardBg, color: theme.text }]}
        placeholderTextColor={theme.gray400}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.primary }]}
        onPress={handleForgotPassword}
        disabled={isLoading}
      >
        <ThemedText style={[styles.buttonText, { color: theme.white }]}>
          {isLoading ? 'Sending...' : 'Send Reset Link'}
        </ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/login')}
      >
        <ThemedText type="link" style={styles.loginLink}>
          Back to Login
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
    marginBottom: 40,
    textAlign: 'center',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  button: {
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    marginBottom: 20,
    textAlign: 'center',
  },
  message: {
    marginBottom: 20,
    textAlign: 'center',
  },
  loginLink: {
    marginTop: 20,
    textAlign: 'center',
  },
});
