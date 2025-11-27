import React, { useEffect } from 'react';
import { useNetInfo } from '@react-native-community/netinfo';
import { useSyncStore } from '../stores/syncStore';
import SyncToast from './SyncToast';

interface SyncStatusProviderProps {
  children: React.ReactNode;
}

export default function SyncStatusProvider({ children }: SyncStatusProviderProps) {
  const netInfo = useNetInfo();
  const { setOnlineStatus, updatePendingCount } = useSyncStore();

  // Initialize pending count on mount
  useEffect(() => {
    updatePendingCount();
  }, [updatePendingCount]);

  // Update online status when network changes
  useEffect(() => {
    setOnlineStatus(netInfo.isConnected ?? false);
  }, [netInfo.isConnected, setOnlineStatus]);

  return (
    <>
      {children}
      <SyncToast />
    </>
  );
}
