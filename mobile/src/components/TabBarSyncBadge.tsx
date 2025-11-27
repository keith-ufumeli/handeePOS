import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useSyncStore } from '../stores/syncStore';

interface TabBarSyncBadgeProps {
  color: string;
}

export default function TabBarSyncBadge({ color }: TabBarSyncBadgeProps) {
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
        return '#10B981'; // Green
      case 'syncing':
        return '#3B82F6'; // Blue
      case 'error':
        return '#EF4444'; // Red
      case 'offline':
        return '#F59E0B'; // Orange/Amber
      default:
        return '#6B7280'; // Gray
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
            transform: [{ scale: pulseAnim }],
          },
        ]}
      >
        {pendingCount > 0 && (
          <View style={styles.countBadge}>
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
    borderColor: '#FFFFFF',
  },
  countBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
});
