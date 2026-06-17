import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { useSyncStore } from '../stores/syncStore';

export default function SyncToast() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const { syncStatus, pendingCount, syncAll } = useSyncStore();
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const previousStatus = useRef(syncStatus);

  useEffect(() => {
    const shouldShow = syncStatus === 'syncing' || syncStatus === 'error' || syncStatus === 'offline';
    
    if (shouldShow) {
      // Slide down
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 8,
      }).start();
    } else if (previousStatus.current === 'syncing' && syncStatus === 'synced') {
      // Show success briefly then hide
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 8,
      }).start();

      setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, 2000);
    } else {
      // Hide
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }

    previousStatus.current = syncStatus;
  }, [syncStatus, slideAnim]);

  const getStatusConfig = () => {
    switch (syncStatus) {
      case 'synced':
        return {
          icon: 'checkmark-circle' as const,
          color: theme.success,
          bgColor: theme.successBg,
          text: 'Synced successfully',
          showAction: false,
        };
      case 'syncing':
        return {
          icon: 'sync' as const,
          color: theme.accent,
          bgColor: theme.infoBg,
          text: `Syncing ${pendingCount} item${pendingCount !== 1 ? 's' : ''}...`,
          showAction: false,
        };
      case 'error':
        return {
          icon: 'alert-circle' as const,
          color: theme.error,
          bgColor: theme.errorBg,
          text: 'Sync failed',
          showAction: true,
        };
      case 'offline':
        return {
          icon: 'cloud-offline' as const,
          color: theme.gray500,
          bgColor: theme.gray100,
          text: `Offline - ${pendingCount} pending`,
          showAction: true,
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          backgroundColor: config.bgColor,
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons name={config.icon} size={20} color={config.color} />
        <Text style={[styles.text, { color: config.color }]}>{config.text}</Text>
      </View>
      
      {config.showAction && (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: config.color }]}
          onPress={syncAll}
        >
          <Text style={[styles.actionText, { color: theme.white }]}>Retry</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 10,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
