// services/notifications.ts
// AND-05: Push notification service for Android/iOS
// Handles token registration, notification channels, and foreground/background notifications.
// On web — no-op (push notifications are not supported).

import { Platform } from 'react-native';
import { devError, devWarn } from '@/utils/logger';

// --- Types ---

export interface NotificationChannel {
  id: string;
  name: string;
  description: string;
  importance: number; // 1-5 (Android)
  sound?: string;
  vibrationPattern?: number[];
}

export interface NotificationPayload {
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
}

export type NotificationHandler = (notification: NotificationPayload) => void;
export type NotificationResponseHandler = (data: Record<string, unknown>) => void;

// --- Constants ---

/** Android notification channels (Material Design / Google Play requirement) */
export const NOTIFICATION_CHANNELS: NotificationChannel[] = [
  {
    id: 'messages',
    name: 'Сообщения',
    description: 'Новые сообщения в чатах и ответы на комментарии',
    importance: 4, // HIGH
    vibrationPattern: [0, 250, 250, 250],
  },
  {
    id: 'updates',
    name: 'Обновления',
    description: 'Новые маршруты, обновления избранного, модерация',
    importance: 3, // DEFAULT
  },
  {
    id: 'recommendations',
    name: 'Рекомендации',
    description: 'Еженедельный дайджест и рекомендации маршрутов',
    importance: 2, // LOW
  },
];

// --- Lazy module loading ---

let NotificationsModule: typeof import('expo-notifications') | null = null;

function getNotificationsModule(): typeof import('expo-notifications') | null {
  if (Platform.OS === 'web') return null;
  if (NotificationsModule) return NotificationsModule;
  try {
    NotificationsModule = require('expo-notifications');
    return NotificationsModule;
  } catch {
    devWarn('[Notifications] expo-notifications not available');
    return null;
  }
}

// --- Channel setup (Android) ---

/**
 * Create Android notification channels.
 * Must be called once at app startup (idempotent — safe to call multiple times).
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  try {
    for (const channel of NOTIFICATION_CHANNELS) {
      await Notifications.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        description: channel.description,
        importance: channel.importance as any,
        vibrationPattern: channel.vibrationPattern ?? [0, 250, 250, 250],
        lightColor: '#7a9d8f', // brand color
      });
    }
  } catch (error: unknown) {
    devError('[Notifications] Failed to setup channels:', error);
  }
}

// --- Permission & token ---

/**
 * Request push notification permission and return the Expo push token.
 * Returns null if permission denied, unavailable, or on web.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const Notifications = getNotificationsModule();
  if (!Notifications) return null;

  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      devWarn('[Notifications] Permission not granted');
      return null;
    }

    // Get Expo push token (works with FCM on Android, APNs on iOS)
    const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || '472c9f49-998e-43c5-bf37-0478cf259645';
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    return tokenData.data;
  } catch (error: unknown) {
    devError('[Notifications] Failed to register:', error);
    return null;
  }
}

// --- Foreground notification handler ---

/**
 * Configure how notifications are presented when app is in foreground.
 * Shows alert + sound + badge by default.
 */
export function setForegroundNotificationHandler(): void {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

// --- Listeners ---

type CleanupFn = () => void;

/**
 * Subscribe to foreground notifications (when app is open).
 * Returns cleanup function.
 */
export function addNotificationReceivedListener(handler: NotificationHandler): CleanupFn {
  const Notifications = getNotificationsModule();
  if (!Notifications) return () => {};

  const subscription = Notifications.addNotificationReceivedListener((notification) => {
    const payload: NotificationPayload = {
      title: notification.request.content.title ?? undefined,
      body: notification.request.content.body ?? undefined,
      data: notification.request.content.data ?? {},
    };
    handler(payload);
  });

  return () => subscription.remove();
}

/**
 * Subscribe to notification tap events (user tapped notification from tray)
 * while the app is already running (warm — foreground or background).
 * Returns cleanup function.
 */
export function addNotificationResponseListener(handler: NotificationResponseHandler): CleanupFn {
  const Notifications = getNotificationsModule();
  if (!Notifications) return () => {};

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data ?? {};
    handler(data as Record<string, unknown>);
  });

  return () => subscription.remove();
}

/**
 * Read the notification (if any) whose tap launched the app from a cold start.
 * The warm listener (`addNotificationResponseListener`) never fires for that tap
 * because the app wasn't running yet — this covers the cold-start case.
 * Returns the notification `data` payload, or null if the app was opened normally.
 */
export async function getInitialNotificationData(): Promise<Record<string, unknown> | null> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return null;

  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (!response) return null;
    return (response.notification.request.content.data ?? {}) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// --- Badge ---

/**
 * Clear the app badge count (e.g. after user opens app).
 */
export async function clearBadge(): Promise<void> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  try {
    await Notifications.setBadgeCountAsync(0);
  } catch {
    // silently ignore
  }
}

// --- Local quest reminders (best-effort) ---

/** Seconds after which an abandoned quest reminder fires (24h). */
const QUEST_REMINDER_DELAY_SECONDS = 24 * 60 * 60;

/** Stable notification identifier per quest so we can cancel/reschedule. */
function questReminderId(questId: string): string {
  return `quest-reminder-${questId}`;
}

/**
 * Ensure notification permission for local reminders. Unlike push, this does
 * not register a token — it only checks/asks the OS permission. Best-effort:
 * returns false (silently) if denied or unavailable.
 */
async function ensureLocalNotificationPermission(
  Notifications: NonNullable<typeof NotificationsModule>,
): Promise<boolean> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Schedule a one-shot local reminder for an unfinished quest (~24h later).
 * Replaces any existing reminder for the same quest (cancel-then-schedule),
 * so it never spams. Tapping routes to the quest via `data.url` deep link.
 * No-op on web or when permission is not granted.
 */
export async function scheduleQuestReminder(
  questId: string,
  title: string,
  step: number,
  total: number,
  deepLinkUrl: string,
): Promise<void> {
  if (Platform.OS === 'web') return;
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  try {
    const granted = await ensureLocalNotificationPermission(Notifications);
    if (!granted) return;

    // Avoid duplicates — drop any prior reminder for this quest first.
    await Notifications.cancelScheduledNotificationAsync(questReminderId(questId)).catch(() => {});

    await Notifications.scheduleNotificationAsync({
      identifier: questReminderId(questId),
      content: {
        title: 'Продолжите приключение',
        body: `Вы остановились на шаге ${step}/${total} в квесте «${title}». Продолжите прохождение!`,
        data: { url: `/quests/${deepLinkUrl}` },
        ...(Platform.OS === 'android' ? { channelId: 'recommendations' } : {}),
      },
      trigger: {
        // SECONDS trigger — fires once after the delay.
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: QUEST_REMINDER_DELAY_SECONDS,
        repeats: false,
      },
    });
  } catch (error: unknown) {
    devError('[Notifications] Failed to schedule quest reminder:', error);
  }
}

/**
 * Cancel a previously scheduled quest reminder (on completion or re-entry).
 * No-op on web. Safe to call even if none is scheduled.
 */
export async function cancelQuestReminder(questId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(questReminderId(questId));
  } catch {
    // No matching scheduled notification — ignore.
  }
}

// --- Deep link routing ---

/**
 * Extract a deep link path from notification data.
 * Expects `data.url` or `data.screen` in the notification payload.
 * Returns null if no deep link data found.
 */
export function extractDeepLinkFromNotification(data: Record<string, unknown>): string | null {
  if (typeof data.url === 'string' && data.url.length > 0) {
    return data.url;
  }
  if (typeof data.screen === 'string' && data.screen.length > 0) {
    return data.screen;
  }
  return null;
}

