// hooks/usePushNotifications.ts
// AND-05: Hook for integrating push notifications into app lifecycle.
// Handles permission request, token registration, notification handling, and deep link routing.
// On web — no-op.

import { useEffect, useRef, useCallback, useState } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
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
  const isSupported = Platform.OS !== 'web';

  // Stable refs for callbacks
  const onTokenRef = useRef(onTokenReceived);
  onTokenRef.current = onTokenReceived;
  const onNotificationRef = useRef(onNotificationReceived);
  onNotificationRef.current = onNotificationReceived;

  // Request permission and get token
  const requestPermission = useCallback(async (): Promise<string | null> => {
    if (!isSupported) return null;

    try {
      const token = await registerForPushNotifications();
      if (token) {
        setPushToken(token);
        onTokenRef.current?.(token);
      }
      return token;
    } catch (error: unknown) {
      devError('[usePushNotifications] requestPermission error:', error);
      return null;
    }
  }, [isSupported]);

  // Initialize: channels + foreground handler + listeners
  useEffect(() => {
    if (!isSupported || isInitialized.current) return;
    isInitialized.current = true;

    // Setup Android notification channels (idempotent)
    void setupNotificationChannels();

    // Configure foreground presentation
    setForegroundNotificationHandler();

    // Listen for foreground notifications
    const removeReceived = addNotificationReceivedListener((payload) => {
      onNotificationRef.current?.(payload);
    });

    // Listen for notification taps (background/killed → deep link)
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

    // Auto-request if enabled
    if (autoRequest) {
      void requestPermission();
    }

    return () => {
      removeReceived();
      removeResponse();
    };
  }, [isSupported, autoRequest, requestPermission, router]);

  // Clear badge when app comes to foreground
  useEffect(() => {
    if (!isSupported) return;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void clearBadge();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    // Clear badge on initial mount too
    void clearBadge();

    return () => {
      subscription.remove();
    };
  }, [isSupported]);

  return { pushToken, requestPermission, isSupported };
}

