import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';

export default function AuthLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen
          name="login"
          options={{
            title: 'Login',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="register"
          options={{
            title: 'Register',
            headerShown: false,
          }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
