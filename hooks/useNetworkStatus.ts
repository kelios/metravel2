// src/hooks/useNetworkStatus.ts
// ✅ FIX-005: Хук для отслеживания статуса сети

import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

interface NetInfoStateLike {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
  type?: string | null;
}

interface NetInfoModuleLike {
  fetch: () => Promise<NetInfoStateLike>;
  addEventListener: (listener: (state: NetInfoStateLike) => void) => () => void;
}

async function checkWebReachability(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    return false;
  }

  try {
    const url = new URL('/favicon.ico', window.location.origin);
    url.searchParams.set('__network_probe', String(Date.now()));

    const response = await fetch(url.toString(), {
      method: 'HEAD',
      cache: 'no-store',
      credentials: 'same-origin',
    });

    return response.ok;
  } catch {
    return false;
  }
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
    // Per-instance состояние: module-global probe-id шарился между инстансами хука
    // и поздний инстанс инвалидировал legit-probe раннего. cancelled гасит async после unmount.
    let cancelled = false;
    let probeSeq = 0;

    // Для web используем нативный API
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !('navigator' in window)) {
        return;
      }

      const applyStatus = (isOnline: boolean) => {
        if (cancelled) return;
        setNetworkStatus({
          isConnected: isOnline,
          isInternetReachable: isOnline,
          type: 'unknown',
        });
      };

      const updateStatus = () => {
        const isOnline = navigator.onLine;

        if (isOnline) {
          probeSeq += 1;
          applyStatus(true);
          return;
        }

        const probeId = ++probeSeq;
        void checkWebReachability().then((isReachable) => {
          if (cancelled || probeId !== probeSeq) return;
          applyStatus(isReachable);
        });
      };

      // Устанавливаем начальное состояние
      updateStatus();

      // Слушаем изменения
      window.addEventListener('online', updateStatus);
      window.addEventListener('offline', updateStatus);

      return () => {
        cancelled = true;
        window.removeEventListener('online', updateStatus);
        window.removeEventListener('offline', updateStatus);
      };
    }

    // Для native используем NetInfo (требует установки @react-native-community/netinfo)
    try {
      const NetInfo = require('@react-native-community/netinfo') as NetInfoModuleLike;

      // Устанавливаем начальное состояние
      NetInfo.fetch().then((state: NetInfoStateLike) => {
        if (cancelled) return;
        setNetworkStatus({
          isConnected: state.isConnected ?? false,
          isInternetReachable: state.isInternetReachable ?? null,
          type: state.type ?? null,
        });
      });

      // Подписываемся на изменения
      const unsubscribe = NetInfo.addEventListener((state: NetInfoStateLike) => {
        if (cancelled) return;
        setNetworkStatus({
          isConnected: state.isConnected ?? false,
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
