import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '../hooks/use-color-scheme';
import SyncStatusProvider from '../src/components/SyncStatusProvider';
import AuthToast from '../src/components/AuthToast';

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Log initialization for debugging
    console.log('RootLayout initialized');
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SyncStatusProvider>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* Screens with custom JSX headers — suppress native header */}
          <Stack.Screen name="products/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="products/new" options={{ headerShown: false }} />
          <Stack.Screen name="products/[id]/edit" options={{ headerShown: false }} />
          <Stack.Screen name="customers/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="customers/new" options={{ headerShown: false }} />
          <Stack.Screen name="customers/[id]/edit" options={{ headerShown: false }} />
          <Stack.Screen name="categories" options={{ headerShown: false }} />
          <Stack.Screen name="reports" options={{ headerShown: false }} />
          <Stack.Screen name="receipt/[orderId]" options={{ headerShown: false }} />
          {/* Screens that use the native Stack header */}
          <Stack.Screen name="barcode-scanner" options={{ presentation: 'modal', title: 'Scan Barcode' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Info' }} />
        </Stack>
        <AuthToast />
        <StatusBar style="auto" />
      </SyncStatusProvider>
    </ThemeProvider>
  );
}
