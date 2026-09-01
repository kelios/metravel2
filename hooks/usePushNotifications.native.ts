import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useRootNavigationState, useRouter } from 'expo-router';

import {
  addNotificationReceivedListener,
  addNotificationResponseListener,
  clearBadge,
  clearLastNotificationResponse,
  getInitialNotificationResponse,
  setForegroundNotificationHandler,
  setupNotificationChannels,
  type NotificationPayload,
  type NotificationResponsePayload,
} from '@/services/notifications';
import {
  activatePushRegistrationSession,
  getPushRegistrationResult,
  requestAndRegisterPushNotifications,
  retryPendingPushRegistration,
  startPushTokenRotationSync,
  subscribePushRegistration,
  syncPushRegistration,
  type PushRegistrationResult,
} from '@/services/pushRegistration.native';
import { useAuthStore } from '@/stores/authStore';
import { mapNotificationPayloadToHref } from '@/utils/incomingAppLinks';

interface UsePushNotificationsOptions {
  onTokenReceived?: (token: string) => void;
  onNotificationReceived?: (payload: NotificationPayload) => void;
}

interface UsePushNotificationsResult {
  pushToken: string | null;
  requestPermission: () => Promise<string | null>;
  isSupported: boolean;
}

const DUPLICATE_RESPONSE_WINDOW_MS = 1_000;

export function usePushNotifications(
  options: UsePushNotificationsOptions = {},
): UsePushNotificationsResult {
  const { onTokenReceived, onNotificationReceived } = options;
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const isNavigationReady = Boolean(rootNavigationState?.key);
  const authReady = useAuthStore((state) => state.authReady);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [pushToken, setPushToken] = useState<string | null>(
    getPushRegistrationResult().token,
  );

  const navigationReadyRef = useRef(isNavigationReady);
  navigationReadyRef.current = isNavigationReady;
  const pendingHrefRef = useRef<string | null>(null);
  const handledResponseIdsRef = useRef(new Map<string, number>());
  const routerRef = useRef(router);
  routerRef.current = router;

  const onTokenRef = useRef(onTokenReceived);
  onTokenRef.current = onTokenReceived;
  const onNotificationRef = useRef(onNotificationReceived);
  onNotificationRef.current = onNotificationReceived;

  const applyRegistrationResult = useCallback((result: PushRegistrationResult) => {
    setPushToken(result.token);
    if (result.backendSynced && result.token) onTokenRef.current?.(result.token);
  }, []);

  const requestPermission = useCallback(async (): Promise<string | null> => {
    const result = await requestAndRegisterPushNotifications();
    applyRegistrationResult(result);
    return result.token;
  }, [applyRegistrationResult]);

  const handleNotificationResponse = useCallback((response: NotificationResponsePayload) => {
    const now = Date.now();
    const lastHandledAt = handledResponseIdsRef.current.get(response.id);
    if (
      !response.id ||
      (lastHandledAt != null && now - lastHandledAt <= DUPLICATE_RESPONSE_WINDOW_MS)
    ) {
      void clearLastNotificationResponse();
      return;
    }

    handledResponseIdsRef.current.set(response.id, now);
    if (handledResponseIdsRef.current.size > 64) {
      const oldestId = handledResponseIdsRef.current.keys().next().value;
      if (oldestId) handledResponseIdsRef.current.delete(oldestId);
    }

    const href = mapNotificationPayloadToHref(response.data);
    if (href) {
      if (navigationReadyRef.current) {
        routerRef.current.push(href as never);
      } else {
        pendingHrefRef.current = href;
      }
    }
    void clearLastNotificationResponse();
  }, []);

  useEffect(() => {
    void setupNotificationChannels();
    setForegroundNotificationHandler();

    const removeReceived = addNotificationReceivedListener((payload) => {
      // Foreground receipt is observable, but navigation only follows a user tap.
      onNotificationRef.current?.(payload);
    });
    const removeResponse = addNotificationResponseListener(handleNotificationResponse);

    void getInitialNotificationResponse().then((response) => {
      if (response) handleNotificationResponse(response);
    });

    return () => {
      removeReceived();
      removeResponse();
    };
  }, [handleNotificationResponse]);

  useEffect(() => {
    if (!isNavigationReady) return;
    const pendingHref = pendingHrefRef.current;
    if (!pendingHref) return;
    pendingHrefRef.current = null;
    routerRef.current.push(pendingHref as never);
  }, [isNavigationReady]);

  useEffect(() => subscribePushRegistration(applyRegistrationResult), [applyRegistrationResult]);

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    activatePushRegistrationSession();
    void syncPushRegistration().then(applyRegistrationResult);
  }, [applyRegistrationResult, authReady, isAuthenticated]);

  useEffect(
    () => startPushTokenRotationSync(
      () => {
        const auth = useAuthStore.getState();
        return auth.authReady && auth.isAuthenticated;
      },
      applyRegistrationResult,
    ),
    [applyRegistrationResult],
  );

  useEffect(() => {
    const retryIfNeeded = () => {
      const auth = useAuthStore.getState();
      if (
        auth.authReady &&
        auth.isAuthenticated &&
        getPushRegistrationResult().status === 'offline'
      ) {
        void retryPendingPushRegistration().then(applyRegistrationResult);
      }
    };

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState !== 'active') return;
      void clearBadge();
      retryIfNeeded();
    };
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    const removeNetworkListener = NetInfo.addEventListener((state) => {
      if (state.isConnected !== false && state.isInternetReachable !== false) retryIfNeeded();
    });
    void clearBadge();

    return () => {
      appStateSubscription.remove();
      removeNetworkListener();
    };
  }, [applyRegistrationResult]);

  return { pushToken, requestPermission, isSupported: true };
}
