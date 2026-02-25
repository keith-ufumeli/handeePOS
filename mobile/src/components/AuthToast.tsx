/**
 * AuthToast.tsx — Non-blocking auth status toast (P7-04)
 *
 * Shows "You're back online." for 3 seconds when the app transitions
 * from PENDING_SYNC → ONLINE_AUTHENTICATED (i.e., reconnect confirmed).
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../stores/authStore';
import { AuthStatus } from '../types/auth';

export default function AuthToast() {
  const { authStatus } = useAuthStore();
  const prevStatus = useRef<AuthStatus>(authStatus);
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const [message, setMessage] = useState<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (msg: string) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setMessage(msg);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 8,
    }).start();
    hideTimer.current = setTimeout(() => {
      Animated.timing(slideAnim, {
        toValue: -120,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setMessage(null));
    }, 3000);
  };

  useEffect(() => {
    const prev = prevStatus.current;
    const curr = authStatus;

    // Only show when transitioning from PENDING_SYNC to ONLINE_AUTHENTICATED
    if (
      prev === AuthStatus.PENDING_SYNC &&
      curr === AuthStatus.ONLINE_AUTHENTICATED
    ) {
      show("You're back online.");
    }

    prevStatus.current = curr;
  }, [authStatus]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (!message) return null;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
    >
      <View style={styles.content}>
        <Ionicons name="wifi" size={18} color="#10B981" />
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 14,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#D1FAE5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1001,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
  },
});
