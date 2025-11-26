import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors, Spacing, BorderRadius, Typography } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';

interface BadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
  style?: StyleProp<ViewStyle>;
}

export function Badge({ label, variant = 'default', style }: BadgeProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const getColors = () => {
    switch (variant) {
      case 'success':
        return { bg: theme.successBg, text: theme.success };
      case 'warning':
        return { bg: theme.warningBg, text: theme.warning };
      case 'error':
        return { bg: theme.errorBg, text: theme.error };
      case 'info':
        return { bg: theme.infoBg, text: theme.info };
      default:
        return { bg: theme.gray200, text: theme.gray700 };
    }
  };

  const colors = getColors();

  return (
    <View style={[
      styles.badge, 
      { backgroundColor: colors.bg },
      style
    ]}>
      <Text style={[styles.text, { color: colors.text }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: Typography.sizes.xs,
    fontWeight: '600',
  },
});
