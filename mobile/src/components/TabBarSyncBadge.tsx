import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { useSyncStore } from '../stores/syncStore';

interface TabBarSyncBadgeProps {
  color: string;
}

export default function TabBarSyncBadge({ color }: TabBarSyncBadgeProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { syncStatus, pendingCount } = useSyncStore();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (syncStatus === 'syncing') {
      // Start pulsing animation
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [syncStatus, pulseAnim]);

  const getBadgeColor = () => {
    switch (syncStatus) {
      case 'synced':
        return theme.success;
      case 'syncing':
        return theme.accent;
      case 'error':
        return theme.error;
      case 'offline':
        return theme.warning;
      default:
        return theme.gray500;
    }
  };

  // Don't show badge if synced and no pending items
  if (syncStatus === 'synced' && pendingCount === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.badge,
          {
            backgroundColor: getBadgeColor(),
            borderColor: theme.white,
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        {pendingCount > 0 && (
          <View style={[styles.countBadge, { backgroundColor: theme.white }]}>
            {/* Small indicator for pending count */}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: -2,
    right: -6,
  },
  badge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  countBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
