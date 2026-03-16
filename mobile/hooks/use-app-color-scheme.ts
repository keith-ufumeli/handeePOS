import { useColorScheme as useSystemColorScheme } from 'react-native';
import { useThemeStore } from '@/src/stores/themeStore';

/**
 * Returns the effective app color scheme, combining the system scheme
 * with the user's persisted theme preference.
 */
export function useAppColorScheme(): 'light' | 'dark' {
  const systemScheme = useSystemColorScheme();
  const { themePreference } = useThemeStore();

  if (themePreference === 'light' || themePreference === 'dark') {
    return themePreference;
  }

  return systemScheme === 'dark' ? 'dark' : 'light';
}

