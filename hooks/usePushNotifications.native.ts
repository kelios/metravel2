// hooks/usePushNotifications.native.ts
// AND-05: Hook for integrating push notifications into app lifecycle.
// Handles permission request, token registration, notification handling, and deep link routing.

import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useRouter } from 'expo-router';
import {
  setupNotificationChannels,
  registerForPushNotifications,
  setForegroundNotificationHandler,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  clearBadge,
  extractDeepLinkFromNotification,
  NotificationPayload,
} from '@/services/notifications';
import { registerPushTokenApi } from '@/api/auth';
import { devError } from '@/utils/logger';

interface UsePushNotificationsOptions {
  /** Called after push token is successfully obtained */
  onTokenReceived?: (token: string) => void;
  /** Called when a foreground notification arrives */
  onNotificationReceived?: (payload: NotificationPayload) => void;
  /** Whether to auto-request permissions on mount (default: false — deferred until user action) */
  autoRequest?: boolean;
}

interface UsePushNotificationsResult {
  /** The Expo push token, or null if not yet obtained */
  pushToken: string | null;
  /** Request push notification permissions and register token */
  requestPermission: () => Promise<string | null>;
  /** Whether push notifications are supported on this platform */
  isSupported: boolean;
}

export function usePushNotifications(
  options: UsePushNotificationsOptions = {},
): UsePushNotificationsResult {
  const { onTokenReceived, onNotificationReceived, autoRequest = false } = options;
  const router = useRouter();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const isInitialized = useRef(false);
  const isSupported = true;

  const onTokenRef = useRef(onTokenReceived);
  onTokenRef.current = onTokenReceived;
  const onNotificationRef = useRef(onNotificationReceived);
  onNotificationRef.current = onNotificationReceived;

  const requestPermission = useCallback(async (): Promise<string | null> => {
    try {
      const token = await registerForPushNotifications();
      if (token) {
        setPushToken(token);
        void registerPushTokenApi(token);
        onTokenRef.current?.(token);
      }
      return token;
    } catch (error: unknown) {
      devError('[usePushNotifications] requestPermission error:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    void setupNotificationChannels();
    setForegroundNotificationHandler();

    const removeReceived = addNotificationReceivedListener((payload) => {
      onNotificationRef.current?.(payload);
    });

    const removeResponse = addNotificationResponseListener((data) => {
      const deepLink = extractDeepLinkFromNotification(data);
      if (deepLink) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deep link URL is dynamic
          router.push(deepLink as any);
        } catch {
          // Invalid route — ignore
        }
      }
    });

    if (autoRequest) {
      void requestPermission();
    }

    return () => {
      removeReceived();
      removeResponse();
    };
  }, [autoRequest, requestPermission, router]);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void clearBadge();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    void clearBadge();

    return () => {
      subscription.remove();
    };
  }, []);

  return { pushToken, requestPermission, isSupported };
}
