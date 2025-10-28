import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '../../components/themed-view';
import { ThemedText } from '../../components/themed-text';
import apiService from '../../src/services/apiService';
import { useAuthStore } from '../../src/stores/authStore';

export default function RegisterScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuthStore();

  const handleRegister = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Call registration API
      const response = await apiService.register({
        fullName,
        email,
        password,
      });

      if (response.success) {
        // Automatically log in after successful registration
        await login(email, password);
        // The root index will handle the redirect after successful login
      } else {
        setError(response.message || 'Registration failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      console.error('Registration error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Create Account
      </ThemedText>
      
      {error && (
        <ThemedText style={styles.error}>
          {error}
        </ThemedText>
      )}

      <TextInput
        style={styles.input}
        placeholder="Full Name"
        value={fullName}
        onChangeText={setFullName}
        autoCapitalize="words"
      />

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
        onPress={handleRegister}
        disabled={isLoading}
      >
        <ThemedText style={styles.buttonText}>
          {isLoading ? 'Creating Account...' : 'Register'}
        </ThemedText>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          setError(null);
          router.push('/login');
        }}
      >
        <ThemedText type="link" style={styles.loginLink}>
          Already have an account? Login here
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
