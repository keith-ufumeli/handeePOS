import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSyncStore } from '@/stores/syncStore';

interface SyncStatusIndicatorProps {
  onPress?: () => void;
}

export default function SyncStatusIndicator({ onPress }: SyncStatusIndicatorProps) {
  const { syncStatus, pendingCount, lastSyncTime, syncNow } = useSyncStore();
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (syncStatus === 'syncing') {
      // Start pulsing animation
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.5,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
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

  const getStatusColor = () => {
    switch (syncStatus) {
      case 'synced':
        return '#10B981';
      case 'syncing':
        return '#3B82F6';
      case 'error':
        return '#EF4444';
      case 'offline':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  const getStatusIcon = () => {
    switch (syncStatus) {
      case 'synced':
        return 'checkmark-circle';
      case 'syncing':
        return 'sync';
      case 'error':
        return 'alert-circle';
      case 'offline':
        return 'cloud-offline';
      default:
        return 'cloud';
    }
  };

  const getStatusText = () => {
    switch (syncStatus) {
      case 'synced':
        return 'Synced';
      case 'syncing':
        return 'Syncing...';
      case 'error':
        return 'Sync Error';
      case 'offline':
        return 'Offline';
      default:
        return 'Unknown';
    }
  };

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';
    
    const now = new Date();
    const syncTime = new Date(lastSyncTime);
    const diffMs = now.getTime() - syncTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (syncStatus === 'error' || syncStatus === 'offline') {
      Alert.alert(
        'Sync Status',
        `Status: ${getStatusText()}\nPending: ${pendingCount} items\nLast sync: ${formatLastSync()}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sync Now', onPress: syncNow }
        ]
      );
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, { borderColor: getStatusColor() }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Animated.View
        style={[
          styles.iconContainer,
          { 
            backgroundColor: getStatusColor(),
            transform: [{ scale: pulseAnim }]
          }
        ]}
      >
        <Ionicons 
          name={getStatusIcon() as any} 
          size={16} 
          color="#FFFFFF" 
        />
      </Animated.View>
      
      <View style={styles.textContainer}>
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>
        {pendingCount > 0 && (
          <Text style={styles.pendingText}>
            {pendingCount} pending
          </Text>
        )}
        <Text style={styles.lastSyncText}>
          {formatLastSync()}
        </Text>
      </View>

      {(syncStatus === 'error' || syncStatus === 'offline') && (
        <Ionicons 
          name="chevron-forward" 
          size={16} 
          color="#6B7280" 
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  textContainer: {
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pendingText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  lastSyncText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
  },
});
