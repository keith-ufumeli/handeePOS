import React, { useEffect } from 'react';
import { useNetInfo } from '@react-native-community/netinfo';
import { useSyncStore } from '../stores/syncStore';
import SyncStatusIndicator from './SyncStatusIndicator';

interface SyncStatusProviderProps {
  children: React.ReactNode;
}

export default function SyncStatusProvider({ children }: SyncStatusProviderProps) {
  const netInfo = useNetInfo();
  const { setOnlineStatus } = useSyncStore();

  useEffect(() => {
    setOnlineStatus(netInfo.isConnected ?? false);
  }, [netInfo.isConnected, setOnlineStatus]);

  return (
    <>
      {children}
      <SyncStatusIndicator />
    </>
  );
}
