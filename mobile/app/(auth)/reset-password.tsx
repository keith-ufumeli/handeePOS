import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedView } from '../../components/themed-view';
import { ThemedText } from '../../components/themed-text';
import apiService from '../../src/services/apiService';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResetPassword = async () => {
    try {
      if (!token) {
        setError('Invalid reset token');
        return;
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      setIsLoading(true);
      setError(null);

      await apiService.resetPassword(token.toString(), password);
      router.replace('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
      console.error('Reset password error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Set New Password
      </ThemedText>
      
      {error && (
        <ThemedText style={styles.error}>
          {error}
        </ThemedText>
      )}

      <TextInput
        style={styles.input}
        placeholder="New Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleResetPassword}
        disabled={isLoading}
      >
        <ThemedText style={styles.buttonText}>
          {isLoading ? 'Resetting...' : 'Reset Password'}
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
  loginLink: {
    marginTop: 20,
    textAlign: 'center',
  },
});
