import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '../../components/themed-view';
import { ThemedText } from '../../components/themed-text';
import apiService from '../../src/services/apiService';

export default function ForgotPasswordScreen() {
  const router = useRouter();
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
        <ThemedText style={styles.message}>
          {message}
        </ThemedText>
      )}

      {error && (
        <ThemedText style={styles.error}>
          {error}
        </ThemedText>
      )}

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleForgotPassword}
        disabled={isLoading}
      >
        <ThemedText style={styles.buttonText}>
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
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    backgroundColor: '#fff',
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
    marginBottom: 20,
    textAlign: 'center',
  },
  message: {
    color: '#34c759',
    marginBottom: 20,
    textAlign: 'center',
  },
  loginLink: {
    marginTop: 20,
    textAlign: 'center',
  },
});
