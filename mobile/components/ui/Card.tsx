import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: keyof typeof Spacing;
}

export function Card({ 
  children, 
  style, 
  variant = 'elevated',
  padding = 'lg' 
}: CardProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];

  const getVariantStyle = () => {
    switch (variant) {
      case 'outlined':
        return {
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.cardBg,
        };
      case 'elevated':
        return {
          backgroundColor: theme.cardBg,
          ...Shadows.md,
        };
      default:
        return {
          backgroundColor: theme.cardBg,
        };
    }
  };

  return (
    <View style={[
      styles.card, 
      getVariantStyle(), 
      { padding: Spacing[padding] },
      style
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
});
