// hooks/usePushNotifications.native.ts
// AND-05: Hook for integrating push notifications into app lifecycle.
// Handles permission request, token registration, notification handling, and deep link routing.

import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import {
  setupNotificationChannels,
  registerForPushNotifications,
  setForegroundNotificationHandler,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  getInitialNotificationData,
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
  const rootNavigationState = useRootNavigationState();
  const isNavigationReady = Boolean(rootNavigationState?.key);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const isInitialized = useRef(false);
  const isSupported = true;

  // Deep link captured before the navigation tree was mounted (cold start, or a
  // warm tap that landed before the root navigator key existed). Routed once ready.
  const pendingDeepLinkRef = useRef<string | null>(null);
  const routerRef = useRef(router);
  routerRef.current = router;

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

  // Route to a notification deep link. If the navigation tree is not mounted yet
  // (cold start), stash it and let the readiness effect flush it. Use router.push
  // (not navigate) — device-verified that navigate() resolves the dynamic nested
  // /quests/[city]/[questId] path to the /quests index, whereas push() lands on the
  // detail (matching the in-app card navigation in QuestForCityCard).
  const routeDeepLink = useCallback((deepLink: string) => {
    if (!isNavigationReady) {
      pendingDeepLinkRef.current = deepLink;
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deep link URL is dynamic
      routerRef.current.push(deepLink as any);
    } catch {
      // Invalid route — ignore
    }
  }, [isNavigationReady]);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    void setupNotificationChannels();
    setForegroundNotificationHandler();

    const removeReceived = addNotificationReceivedListener((payload) => {
      onNotificationRef.current?.(payload);
    });

    // Warm tap (app already running, foreground or background).
    const removeResponse = addNotificationResponseListener((data) => {
      const deepLink = extractDeepLinkFromNotification(data);
      if (deepLink) routeDeepLink(deepLink);
    });

    // Cold start: the app was launched by tapping a notification, so the warm
    // listener above never fires for it. Pull the launch notification once.
    void getInitialNotificationData().then((data) => {
      if (!data) return;
      const deepLink = extractDeepLinkFromNotification(data);
      if (deepLink) routeDeepLink(deepLink);
    });

    if (autoRequest) {
      void requestPermission();
    }

    return () => {
      removeReceived();
      removeResponse();
    };
  }, [autoRequest, requestPermission, routeDeepLink]);

  // Flush a deep link captured before the navigation tree was ready.
  useEffect(() => {
    if (!isNavigationReady) return;
    const pending = pendingDeepLinkRef.current;
    if (!pending) return;
    pendingDeepLinkRef.current = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deep link URL is dynamic
      routerRef.current.navigate(pending as any);
    } catch {
      // Invalid route — ignore
    }
  }, [isNavigationReady]);

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
