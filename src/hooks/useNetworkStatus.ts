// src/hooks/useNetworkStatus.ts
// ✅ FIX-005: Хук для отслеживания статуса сети

import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

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
    // Для web используем нативный API
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !('navigator' in window)) {
        return;
      }

      const updateStatus = () => {
        const isOnline = navigator.onLine;
        setNetworkStatus({
          isConnected: isOnline,
          isInternetReachable: isOnline,
          type: 'unknown',
        });
      };

      // Устанавливаем начальное состояние
      updateStatus();

      // Слушаем изменения
      window.addEventListener('online', updateStatus);
      window.addEventListener('offline', updateStatus);

      return () => {
        window.removeEventListener('online', updateStatus);
        window.removeEventListener('offline', updateStatus);
      };
    } else {
      // Для native используем NetInfo (требует установки @react-native-community/netinfo)
      try {
        const NetInfo = require('@react-native-community/netinfo');
        
        // Устанавливаем начальное состояние
        NetInfo.fetch().then((state: any) => {
          setNetworkStatus({
            isConnected: state.isConnected ?? false,
            isInternetReachable: state.isInternetReachable ?? null,
            type: state.type ?? null,
          });
        });

        // Подписываемся на изменения
        const unsubscribe = NetInfo.addEventListener((state: any) => {
          setNetworkStatus({
            isConnected: state.isConnected ?? false,
            isInternetReachable: state.isInternetReachable ?? null,
            type: state.type ?? null,
          });
        });

        return () => {
          unsubscribe();
        };
      } catch (error) {
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
      }
    }
  }, []);

  return networkStatus;
}

/**
 * Упрощенный хук, возвращающий только boolean статус соединения
 */
export function useIsConnected(): boolean {
  const { isConnected } = useNetworkStatus();
  return isConnected;
}

