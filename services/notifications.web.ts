import { translate as i18nT } from '@/i18n'

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
export type NotificationResponseHandler = (data: Record<string, unknown>) => void

type CleanupFn = () => void

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
export async function registerForPushNotifications(): Promise<string | null> { return null }
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
export async function clearBadge(): Promise<void> {}
export async function ensureLocalNotificationPermission(): Promise<boolean> {
  return false
}
export function getNotifications(): null {
  return null
}
export async function presentLocalQuestNotification(): Promise<void> {}
export async function scheduleQuestReminder(): Promise<void> {}
export async function scheduleQuestReturnReminder(): Promise<void> {}
export async function cancelQuestReturnReminder(_ownerId?: string, _questId?: string): Promise<void> {}
export async function cancelQuestReminder(_questId?: string): Promise<void> {}

export function extractDeepLinkFromNotification(data: Record<string, unknown>): string | null {
  if (typeof data.url === 'string' && data.url.length > 0) {
    return data.url
  }
  if (typeof data.screen === 'string' && data.screen.length > 0) {
    return data.screen
  }
  return null
}
