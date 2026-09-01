import { translate as i18nT } from '@/i18n'
import { mapNotificationPayloadToHref } from '@/utils/incomingAppLinks'

export interface NotificationChannel {
  id: string
  name: string
  description: string
  importance: number
  sound?: string
  vibrationPattern?: number[]
}

export interface NotificationPayload {
  title?: string
  body?: string
  data?: Record<string, unknown>
}

export type NotificationHandler = (notification: NotificationPayload) => void
export interface NotificationResponsePayload {
  id: string
  data: Record<string, unknown>
}
export type NotificationResponseHandler = (response: NotificationResponsePayload) => void
export type NotificationPermissionState =
  | 'notDetermined'
  | 'enabled'
  | 'provisional'
  | 'denied'
  | 'unavailable'

type CleanupFn = () => void
type NotificationsModule = typeof import('expo-notifications')

export const NOTIFICATION_CHANNELS: NotificationChannel[] = [
  {
    id: 'messages',
    get name() { return i18nT('sharedStatic:notifications.messages.name') },
    get description() { return i18nT('sharedStatic:services.notifications.novye_soobscheniya_v_chatah_i_otvety_na_komm_4fe15b34') },
    importance: 4,
    vibrationPattern: [0, 250, 250, 250],
  },
  {
    id: 'updates',
    get name() { return i18nT('sharedStatic:notifications.updates.name') },
    get description() { return i18nT('sharedStatic:services.notifications.novye_marshruty_obnovleniya_izbrannogo_moder_601c7f00') },
    importance: 3,
  },
  {
    id: 'recommendations',
    get name() { return i18nT('sharedStatic:notifications.recommendations.name') },
    get description() { return i18nT('sharedStatic:services.notifications.ezhenedelnyy_daydzhest_i_rekomendatsii_marsh_a39d7cec') },
    importance: 2,
  },
]

export async function setupNotificationChannels(): Promise<void> {}
export function normalizeNotificationPermission(): NotificationPermissionState { return 'unavailable' }
export function isNotificationPermissionAllowed(
  state: NotificationPermissionState,
): state is 'enabled' | 'provisional' {
  return state === 'enabled' || state === 'provisional'
}
export async function inspectNotificationPermission(): Promise<NotificationPermissionState> {
  return 'unavailable'
}
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  return 'unavailable'
}
export async function getPushNotificationToken(): Promise<string | null> { return null }
export function setForegroundNotificationHandler(): void {}
export function addNotificationReceivedListener(_handler: NotificationHandler): CleanupFn {
  return () => {}
}
export function addNotificationResponseListener(_handler: NotificationResponseHandler): CleanupFn {
  return () => {}
}
export async function getInitialNotificationData(): Promise<Record<string, unknown> | null> {
  return null
}
export async function getInitialNotificationResponse(): Promise<NotificationResponsePayload | null> {
  return null
}
export async function clearLastNotificationResponse(): Promise<void> {}
export function addPushTokenRotationListener(
  _handler: (token: string) => void | Promise<void>,
): CleanupFn {
  return () => {}
}
export async function clearBadge(): Promise<void> {}
export async function ensureLocalNotificationPermission(
  _Notifications: NotificationsModule,
): Promise<boolean> {
  return false
}
export function getNotifications(): NotificationsModule | null {
  return null
}
export async function presentLocalQuestNotification(
  _identifier: string,
  _title: string,
  _body: string,
  _deepLinkUrl: string,
): Promise<void> {}
export async function scheduleQuestReminder(
  _questId: string,
  _title: string,
  _step: number,
  _total: number,
  _deepLinkUrl: string,
): Promise<void> {}
export async function scheduleQuestReturnReminder(
  _ownerId: string,
  _questId: string,
  _questTitle: string,
  _cityDeepLink: string,
  _remainingCount: number,
): Promise<boolean> {
  return false
}
export async function cancelQuestReturnReminder(
  _ownerId: string,
  _questId: string,
): Promise<void> {}
export async function cancelQuestReminder(_questId: string): Promise<void> {}

export function extractDeepLinkFromNotification(data: Record<string, unknown>): string | null {
  return mapNotificationPayloadToHref(data)
}
