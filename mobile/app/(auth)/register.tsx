import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedView } from '../../components/themed-view';
import { ThemedText } from '../../components/themed-text';
import { Colors } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';
import apiService from '../../src/services/apiService';
import { useAuthStore } from '../../src/stores/authStore';

export default function RegisterScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
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
      <View style={styles.logoContainer}>
        <Image
          source={require('../../assets/images/handeepos-logo-icon.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>
      <ThemedText type="title" style={styles.title}>
        Create Account
      </ThemedText>
      
      {error && (
        <ThemedText style={[styles.error, { color: theme.error }]}>
          {error}
        </ThemedText>
      )}

      <TextInput
        style={[styles.input, { borderColor: theme.border, backgroundColor: theme.cardBg, color: theme.text }]}
        placeholderTextColor={theme.gray400}
        placeholder="Full Name"
        value={fullName}
        onChangeText={setFullName}
        autoCapitalize="words"
      />

      <TextInput
        style={[styles.input, { borderColor: theme.border, backgroundColor: theme.cardBg, color: theme.text }]}
        placeholderTextColor={theme.gray400}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={[styles.input, { borderColor: theme.border, backgroundColor: theme.cardBg, color: theme.text }]}
        placeholderTextColor={theme.gray400}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.primary }]}
        onPress={handleRegister}
        disabled={isLoading}
      >
        <ThemedText style={[styles.buttonText, { color: theme.white }]}>
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
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoImage: {
    width: 140,
    height: 140,
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
  loginLink: {
    marginTop: 20,
    textAlign: 'center',
  },
});
