import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '../hooks/use-color-scheme';
import SyncStatusProvider from '../src/components/SyncStatusProvider';

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
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          <Stack.Screen name="barcode-scanner" options={{ presentation: 'modal', title: 'Scan Barcode' }} />
          <Stack.Screen name="products/[id]" options={{ title: 'Product Details' }} />
          <Stack.Screen name="products/new" options={{ title: 'New Product' }} />
          <Stack.Screen name="receipt/[orderId]" options={{ title: 'Receipt' }} />
        </Stack>
        <StatusBar style="auto" />
      </SyncStatusProvider>
    </ThemeProvider>
  );
}
