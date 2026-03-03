import { useCallback } from 'react';

interface UsePushNotificationsOptions {
  onTokenReceived?: (token: string) => void;
  onNotificationReceived?: (payload: NotificationPayload) => void;
  autoRequest?: boolean;
}

export interface NotificationPayload {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

interface UsePushNotificationsResult {
  pushToken: string | null;
  requestPermission: () => Promise<string | null>;
  isSupported: boolean;
}

export function usePushNotifications(
  _options: UsePushNotificationsOptions = {},
): UsePushNotificationsResult {
  const requestPermission = useCallback(async (): Promise<string | null> => null, []);
  return {
    pushToken: null,
    requestPermission,
    isSupported: false,
  };
}
