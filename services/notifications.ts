// services/notifications.ts
// AND-05: Push notification service for Android/iOS
// Handles token registration, notification channels, and foreground/background notifications.
// Web uses notifications.web.ts so expo-notifications never enters the web graph.

import { Platform } from 'react-native';
import type { DevicePushToken } from 'expo-notifications';
import Constants from 'expo-constants';
import { devError, devWarn } from '@/utils/logger';
import { translate as i18nT, translatePlural } from '@/i18n'
import { mapNotificationPayloadToHref } from '@/utils/incomingAppLinks';


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
export interface NotificationResponsePayload {
  id: string;
  data: Record<string, unknown>;
}

export type NotificationResponseHandler = (response: NotificationResponsePayload) => void;
export type NotificationPermissionState =
  | 'notDetermined'
  | 'enabled'
  | 'provisional'
  | 'denied'
  | 'unavailable';

// --- Constants ---

/** Android notification channels (Material Design / Google Play requirement) */
export const NOTIFICATION_CHANNELS: NotificationChannel[] = [
  {
    id: 'messages',
    get name() { return i18nT('sharedStatic:notifications.messages.name') },
    get description() { return i18nT('sharedStatic:services.notifications.novye_soobscheniya_v_chatah_i_otvety_na_komm_4fe15b34') },
    importance: 4, // HIGH
    vibrationPattern: [0, 250, 250, 250],
  },
  {
    id: 'updates',
    get name() { return i18nT('sharedStatic:notifications.updates.name') },
    get description() { return i18nT('sharedStatic:services.notifications.novye_marshruty_obnovleniya_izbrannogo_moder_601c7f00') },
    importance: 3, // DEFAULT
  },
  {
    id: 'recommendations',
    get name() { return i18nT('sharedStatic:notifications.recommendations.name') },
    get description() { return i18nT('sharedStatic:services.notifications.ezhenedelnyy_daydzhest_i_rekomendatsii_marsh_a39d7cec') },
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
  } catch {
    devError('[Notifications] Failed to setup channels');
  }
}

// --- Permission & token ---

/**
 * Normalize the platform permission response without ever asking the user.
 * iOS provisional and ephemeral grants are usable; both map to the quieter
 * provisional UI state.
 */
export function normalizeNotificationPermission(
  permission: Awaited<ReturnType<NonNullable<typeof NotificationsModule>['getPermissionsAsync']>>,
): NotificationPermissionState {
  const iosAuthorization = permission.ios?.status;
  if (Platform.OS === 'ios' && iosAuthorization != null) {
    if (iosAuthorization === 2) return 'enabled';
    if (iosAuthorization === 3 || iosAuthorization === 4) return 'provisional';
    if (iosAuthorization === 1) return 'denied';
    if (iosAuthorization === 0) return 'notDetermined';
  }

  if (permission.granted || permission.status === 'granted') return 'enabled';
  if (permission.status === 'denied') return 'denied';
  return 'notDetermined';
}

export function isNotificationPermissionAllowed(
  state: NotificationPermissionState,
): state is 'enabled' | 'provisional' {
  return state === 'enabled' || state === 'provisional';
}

/** Passive inspection. This function must never display an OS prompt. */
export async function inspectNotificationPermission(): Promise<NotificationPermissionState> {
  if (Platform.OS === 'web') return 'unavailable';
  const Notifications = getNotificationsModule();
  if (!Notifications) return 'unavailable';

  try {
    return normalizeNotificationPermission(await Notifications.getPermissionsAsync());
  } catch {
    devWarn('[Notifications] Permission inspection unavailable');
    return 'unavailable';
  }
}

/** Explicit permission request. Call only from a user action. */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (Platform.OS === 'web') return 'unavailable';
  const Notifications = getNotificationsModule();
  if (!Notifications) return 'unavailable';

  try {
    return normalizeNotificationPermission(await Notifications.requestPermissionsAsync());
  } catch {
    devWarn('[Notifications] Permission request unavailable');
    return 'unavailable';
  }
}

/** Retrieve an Expo token for an already-authorized installation. Never prompts. */
export async function getPushNotificationToken(
  devicePushToken?: DevicePushToken,
): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const Notifications = getNotificationsModule();
  if (!Notifications) return null;

  const permission = await inspectNotificationPermission();
  if (!isNotificationPermissionAllowed(permission)) return null;

  try {
    const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim()
      || Constants.easConfig?.projectId
      || Constants.expoConfig?.extra?.eas?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      ...(projectId ? { projectId } : {}),
      ...(devicePushToken ? { devicePushToken } : {}),
    });
    return typeof tokenData.data === 'string' && tokenData.data.length > 0
      ? tokenData.data
      : null;
  } catch {
    devWarn('[Notifications] Push token retrieval unavailable');
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
    handler({
      id: response.notification.request.identifier,
      data: data as Record<string, unknown>,
    });
  });

  return () => subscription.remove();
}

/**
 * Read the notification (if any) whose tap launched the app from a cold start.
 * The warm listener (`addNotificationResponseListener`) never fires for that tap
 * because the app wasn't running yet — this covers the cold-start case.
 * Returns the notification `data` payload, or null if the app was opened normally.
 */
export async function getInitialNotificationResponse(): Promise<NotificationResponsePayload | null> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return null;

  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    if (!response) return null;
    return {
      id: response.notification.request.identifier,
      data: (response.notification.request.content.data ?? {}) as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

/** Remove the consumed native response so it cannot replay on the next mount. */
export async function clearLastNotificationResponse(): Promise<void> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;
  await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
}

/** Backward-compatible data-only cold-start reader. */
export async function getInitialNotificationData(): Promise<Record<string, unknown> | null> {
  return (await getInitialNotificationResponse())?.data ?? null;
}

/**
 * Convert a rotated native APNs/FCM token back into the Expo token expected by
 * the existing backend contract. The token itself is never logged.
 */
export function addPushTokenRotationListener(
  handler: (token: string) => void | Promise<void>,
): CleanupFn {
  const Notifications = getNotificationsModule();
  if (!Notifications) return () => {};

  const subscription = Notifications.addPushTokenListener(async (devicePushToken) => {
    const token = await getPushNotificationToken(devicePushToken);
    if (token) await handler(token);
  });
  return () => subscription.remove();
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
/** Возвратное напоминание после финиша — ровно через неделю (#1484). */
const QUEST_RETURN_REMINDER_DELAY_SECONDS = 7 * 24 * 60 * 60;

/** Stable notification identifier per quest so we can cancel/reschedule. */
function questReminderId(questId: string): string {
  return `quest-reminder-${questId}`;
}

function questReturnReminderId(ownerId: string, questId: string): string {
  return `quest-return-${encodeURIComponent(ownerId)}-${questId}`;
}

/**
 * Inspect notification permission for local reminders without opening an OS
 * prompt. Best-effort and token-free:
 * returns false (silently) if denied or unavailable.
 */
export async function ensureLocalNotificationPermission(
  Notifications: NonNullable<typeof NotificationsModule>,
): Promise<boolean> {
  try {
    return isNotificationPermissionAllowed(
      normalizeNotificationPermission(await Notifications.getPermissionsAsync()),
    );
  } catch {
    return false;
  }
}

/**
 * Re-export of the lazily-loaded expo-notifications module so background tasks
 * (e.g. geofencing) can present notifications through the same guarded loader.
 * Returns null on web or when the module isn't in the bundle.
 */
export function getNotifications(): typeof NotificationsModule {
  return getNotificationsModule();
}

/**
 * Present an instant local notification (no schedule delay). Best-effort:
 * no-op on web / missing module / permission not already allowed.
 * Used by quest geofencing on region ENTER. `data.url` deep-links to the quest.
 */
export async function presentLocalQuestNotification(
  identifier: string,
  title: string,
  body: string,
  deepLinkUrl: string,
): Promise<void> {
  if (Platform.OS === 'web') return;
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  try {
    const granted = await ensureLocalNotificationPermission(Notifications);
    if (!granted) return;

    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title,
        body,
        data: { url: `/quests/${deepLinkUrl}` },
        ...(Platform.OS === 'android' ? { channelId: 'recommendations' } : {}),
      },
      // null trigger → present immediately.
      trigger: null,
    });
  } catch {
    devError('[Notifications] Failed to present local notification');
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
        title: i18nT('shared:services.notifications.prodolzhite_priklyuchenie_85f79e46'),
        body: i18nT('shared:services.notifications.vy_ostanovilis_na_shage_value1_value2_v_kves_8393cf7d', { value1: step, value2: total, value3: title }),
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
  } catch {
    devError('[Notifications] Failed to schedule quest reminder');
  }
}

/**
 * Schedule the one-shot "come back" reminder 7 days after a finished quest
 * (#1484): the product had no second action, so nothing brought a player back.
 *
 * Consent-only by design: this never asks for notification permission. A
 * finished quest is not the moment to pop an OS prompt out of nowhere — if the
 * player never allowed notifications, the reminder is silently skipped.
 */
export async function scheduleQuestReturnReminder(
  ownerId: string,
  questId: string,
  questTitle: string,
  cityDeepLink: string,
  remainingCount: number,
): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (!ownerId || !questId || remainingCount <= 0) return false;
  const Notifications = getNotificationsModule();
  if (!Notifications) return false;

  try {
    const permission = normalizeNotificationPermission(
      await Notifications.getPermissionsAsync(),
    );
    if (!isNotificationPermissionAllowed(permission)) return false;

    // Один финиш — одно напоминание: идентификатор привязан к квесту, повтор
    // расписания заменяет прежнее, а не добавляет второе.
    await Notifications.cancelScheduledNotificationAsync(questReturnReminderId(ownerId, questId)).catch(
      () => {},
    );

    await Notifications.scheduleNotificationAsync({
      identifier: questReturnReminderId(ownerId, questId),
      content: {
        title: i18nT('shared:services.notifications.returnReminderTitle'),
        body: translatePlural('shared:services.notifications.returnReminderBody', remainingCount, {
          value1: questTitle,
          count: remainingCount,
        }),
        data: { url: `/quests/${cityDeepLink}` },
        ...(Platform.OS === 'android' ? { channelId: 'recommendations' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: QUEST_RETURN_REMINDER_DELAY_SECONDS,
        repeats: false,
      },
    });
    return true;
  } catch {
    devError('[Notifications] Failed to schedule quest return reminder');
    return false;
  }
}

/** Отменить retention-напоминание при возврате или смене аккаунта. */
export async function cancelQuestReturnReminder(ownerId: string, questId: string): Promise<void> {
  if (Platform.OS === 'web' || !ownerId || !questId) return;
  const Notifications = getNotificationsModule();
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(
    questReturnReminderId(ownerId, questId),
  ).catch(() => undefined);
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
  return mapNotificationPayloadToHref(data);
}
