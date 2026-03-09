import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useNetInfo } from '@react-native-community/netinfo';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';

export default function WelcomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const netInfo = useNetInfo();
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);

  useEffect(() => {
    // Give a brief moment to check connection status
    const timer = setTimeout(() => {
      setIsCheckingConnection(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const isConnected = netInfo.isConnected ?? false;
  const connectionType = netInfo.type;

  const handleLoginPress = () => {
    if (isConnected) {
      router.replace('/(auth)/login');
    }
  };

  return (
    <LinearGradient
      colors={[theme.primary, theme.primaryDark]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* App Icon */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/logo-white.png')}
            style={styles.logoImage}
            contentFit="contain"
          />
        </View>

        {/* App Name */}
        <Text style={styles.appName}>HandeePOS</Text>
        <Text style={styles.tagline}>Point of Sale Made Simple</Text>

        {/* Connection Status */}
        <View style={[styles.connectionCard, { backgroundColor: 'rgba(255, 255, 255, 0.15)' }]}>
          {isCheckingConnection ? (
            <View style={styles.connectionStatus}>
              <ActivityIndicator size="small" color={theme.white} />
              <Text style={styles.connectionText}>Checking connection...</Text>
            </View>
          ) : (
            <View style={styles.connectionStatus}>
              <Ionicons
                name={isConnected ? 'checkmark-circle' : 'close-circle'}
                size={24}
                color={isConnected ? theme.success : theme.error}
              />
              <View style={styles.connectionTextContainer}>
                <Text style={styles.connectionText}>
                  {isConnected ? 'Connected' : 'No Internet Connection'}
                </Text>
                {isConnected && connectionType && (
                  <Text style={styles.connectionSubtext}>
                    {connectionType.toUpperCase()}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Info Message */}
        <View style={[styles.infoCard, { backgroundColor: 'rgba(255, 255, 255, 0.1)' }]}>
          <Ionicons name="information-circle-outline" size={20} color="rgba(255, 255, 255, 0.8)" />
          <Text style={styles.infoText}>
            {isConnected
              ? 'An active internet connection is required to sign in and sync your data.'
              : 'Please connect to the internet to continue. WiFi or mobile data is required.'}
          </Text>
        </View>

        {/* Login Button */}
        <TouchableOpacity
          style={[
            styles.loginButton,
            {
              backgroundColor: isConnected ? theme.white : 'rgba(255, 255, 255, 0.3)',
              opacity: isConnected ? 1 : 0.6,
            },
          ]}
          onPress={handleLoginPress}
          disabled={!isConnected || isCheckingConnection}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.loginButtonText,
              { color: isConnected ? theme.primary : theme.white },
            ]}
          >
            {isConnected ? 'Continue to Login' : 'Waiting for Connection...'}
          </Text>
          {isConnected && (
            <Ionicons name="arrow-forward" size={20} color={theme.primary} />
          )}
        </TouchableOpacity>

        {/* Help Text */}
        {!isConnected && (
          <TouchableOpacity style={styles.helpButton}>
            <Text style={styles.helpText}>Connection issues? Get help</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Version 1.0.0</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  logoImage: {
    width: 200,
    height: 200,
  },
  appName: {
    fontSize: Typography.sizes.xxxl,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: Spacing.xs,
  },
  tagline: {
    fontSize: Typography.sizes.md,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: Spacing.xxxl,
  },
  connectionCard: {
    width: '100%',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  connectionTextContainer: {
    flex: 1,
  },
  connectionText: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    color: '#FFF',
  },
  connectionSubtext: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  infoCard: {
    width: '100%',
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xxxl,
    gap: Spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: Typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 20,
  },
  loginButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  loginButtonText: {
    fontSize: Typography.sizes.md,
    fontWeight: '700',
  },
  helpButton: {
    marginTop: Spacing.lg,
  },
  helpText: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    textDecorationLine: 'underline',
  },
  footer: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: Typography.sizes.xs,
    color: 'rgba(255, 255, 255, 0.6)',
  },
});
