import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '../../components/themed-view';
import { ThemedText } from '../../components/themed-text';
import { useAuthStore } from '../../src/stores/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, error, isLoading, clearError } = useAuthStore();

  const handleLogin = async () => {
    try {
      await login(email, password);
      // The root index will handle the redirect after successful login
    } catch (err) {
      console.error('Login error:', err);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Welcome Back
      </ThemedText>
      
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

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={isLoading}
      >
        <ThemedText style={styles.buttonText}>
          {isLoading ? 'Logging in...' : 'Login'}
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
  registerLink: {
    marginTop: 20,
    textAlign: 'center',
  },
});
