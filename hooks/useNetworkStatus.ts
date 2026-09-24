// src/hooks/useNetworkStatus.ts
// ✅ FIX-005: Хук для отслеживания статуса сети

import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { subscribeWebNetworkStatus } from '@/utils/webNetworkStatus';

interface NetInfoStateLike {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
  type?: string | null;
}

interface NetInfoModuleLike {
  fetch: () => Promise<NetInfoStateLike>;
  addEventListener: (listener: (state: NetInfoStateLike) => void) => () => void;
}

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
}

/**
 * Хук для отслеживания статуса сети
 * @returns Объект с информацией о статусе сети
 */
export function useNetworkStatus(): NetworkStatus {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isConnected: true, // По умолчанию считаем, что есть соединение
    isInternetReachable: true,
    type: null,
  });

  useEffect(() => {
    let cancelled = false;

    // Queries, offline UI and write queues must agree on web reachability.
    if (Platform.OS === 'web') {
      return subscribeWebNetworkStatus((isOnline) => {
        setNetworkStatus({
          isConnected: isOnline,
          isInternetReachable: isOnline,
          type: 'unknown',
        });
      });
    }

    // Для native используем NetInfo (требует установки @react-native-community/netinfo)
    try {
      const NetInfo = require('@react-native-community/netinfo') as NetInfoModuleLike;

      // Устанавливаем начальное состояние
      NetInfo.fetch().then((state: NetInfoStateLike) => {
        if (cancelled) return;
        setNetworkStatus({
          // NetInfo reports null while connectivity is still being resolved.
          // Only an explicit false is offline; unknown stays provisionally online.
          isConnected: state.isConnected !== false,
          isInternetReachable: state.isInternetReachable ?? null,
          type: state.type ?? null,
        });
      });

      // Подписываемся на изменения
      const unsubscribe = NetInfo.addEventListener((state: NetInfoStateLike) => {
        if (cancelled) return;
        setNetworkStatus({
          isConnected: state.isConnected !== false,
          isInternetReachable: state.isInternetReachable ?? null,
          type: state.type ?? null,
        });
      });

      return () => {
        cancelled = true;
        unsubscribe();
      };
    } catch {
      // Если NetInfo не установлен, используем fallback
      if (__DEV__) {
        console.warn('@react-native-community/netinfo не установлен. Используется fallback.');
      }
      // Fallback: считаем, что соединение есть
      setNetworkStatus({
        isConnected: true,
        isInternetReachable: true,
        type: 'unknown',
      });
      return;
    }
  }, []);

  return networkStatus;
}
