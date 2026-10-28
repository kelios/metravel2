// События нативного приложения в наш бэкенд (#2841). Web-провайдеры сюда не
// заходят: для web Metro берёт appEventTelemetry.web.ts. Имена, которые уже
// подходят приёмнику (воронки, quest_start), уходят как есть. Имя вне
// ^[a-z0-9_]{1,64}$ не отправляется: иначе 400 снимает весь батч.

import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState, Platform, type AppStateStatus } from 'react-native'

import { apiClient } from '@/api/client'
import {
  getAppInstallId,
  getAppSessionId,
  getAppTelemetryEnvironment,
  isAppTelemetryCollectionAllowed,
  isAppTelemetryEnabled,
  registerTelemetryDisabledHook,
  type AppTelemetryEnvironment,
} from '@/utils/appTelemetry'
import { createPersistentDeliveryQueue, DeliveryPausedError } from '@/utils/persistentDeliveryQueue'
import { createUuidV4 } from '@/utils/uuid'

export const APP_EVENT_QUEUE_KEY = 'metravel_app_event_queue_v1'
export const APP_FIRST_OPEN_KEY = 'metravel_app_first_open_v1'
export const APP_EVENT_BATCH_MAX = 50
export const APP_EVENT_FLUSH_AT = 20
export const APP_EVENT_QUEUE_MAX = 500

const EVENT_NAME = /^[a-z0-9_]{1,64}$/
const LOCALE_NAME = /^[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*$/
const PRIVATE_KEY = /(?:^|_)(?:email|e_mail|token|password|passwd|secret|authorization|lat|lng|latitude|longitude|coordinates|user_id|userid|phone)(?:_|$)/i
const SECRET_VALUE = /\bBearer\s+\S+|\b(?:(?:access|refresh)[_-]?)?(?:token|password|passwd|secret|authorization)\s*[:=]|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|\b-?\d{1,2}\.\d{3,}\s*[,;]\s*-?\d{1,3}\.\d{3,}/i
const DRF_TOKEN = /^[a-f0-9]{40}$/i
const PROSE_KEY = /(?:^|_)(?:message|text|comment|query|search_term|body|content|description)(?:_|$)/i

export type AppTelemetryEvent = {
  id: string
  name: string
  ts: string
  session_id: string
  props: Record<string, string | number | boolean>
}

type EventEnvelope = AppTelemetryEnvironment & { install_id: string }

let installed = false
let sessionOpen = false

export function toAppTelemetryEventName(name: string): string | null {
  const trimmed = String(name ?? '').trim()
  return EVENT_NAME.test(trimmed) ? trimmed : null
}

const normalizeKey = (key: string): string =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')

const isPrivateValue = (value: string): boolean =>
  value.includes('@') || SECRET_VALUE.test(value) || DRF_TOKEN.test(value.trim())

/** Плоские короткие параметры без почты, токенов, координат и свободного текста. */
export function sanitizeAppTelemetryProps(params: Record<string, unknown>): Record<string, string | number | boolean> {
  const props: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(params)) {
    if (Object.keys(props).length >= 20) break
    if (typeof key !== 'string' || key.length === 0 || key.length > 64 || key.includes('@')) continue
    const normalized = normalizeKey(key)
    if (PRIVATE_KEY.test(normalized) || PROSE_KEY.test(normalized) || SECRET_VALUE.test(key)) continue
    if (typeof value === 'boolean') {
      props[key] = value
      continue
    }
    if (typeof value === 'number') {
      if (Number.isFinite(value)) props[key] = value
      continue
    }
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (!trimmed || trimmed.length > 200 || isPrivateValue(trimmed)) continue
    // Свободный текст (фраза длиннее короткого кода) в статистику не кладём.
    if (trimmed.length > 80 && /\s/.test(trimmed)) continue
    props[key] = trimmed
  }
  return props
}

const isEvent = (value: unknown): value is AppTelemetryEvent => {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    EVENT_NAME.test(record.name) &&
    typeof record.ts === 'string' &&
    typeof record.session_id === 'string' &&
    !!record.props &&
    typeof record.props === 'object'
  )
}

const publicLabel = (value: string, max: number): string => {
  const trimmed = value.trim().slice(0, max)
  if (!trimmed || isPrivateValue(trimmed)) return 'unknown'
  return trimmed
}

const eventEnvironment = async (): Promise<EventEnvelope> => {
  const environment = getAppTelemetryEnvironment()
  const locale = LOCALE_NAME.test(environment.locale) ? environment.locale : 'en'
  return {
    install_id: await getAppInstallId(),
    platform: environment.platform,
    app_version: publicLabel(environment.app_version, 64),
    build_number: publicLabel(environment.build_number, 64),
    os_version: publicLabel(environment.os_version, 128),
    device_model: publicLabel(environment.device_model, 255),
    locale,
  }
}

const acknowledgeBatch = (acknowledgement: unknown, size: number): void => {
  const ack = acknowledgement as { accepted?: unknown; duplicates?: unknown } | null
  if (
    !ack || typeof ack !== 'object' ||
    typeof ack.accepted !== 'number' || typeof ack.duplicates !== 'number' ||
    !Number.isInteger(ack.accepted) || !Number.isInteger(ack.duplicates) ||
    ack.accepted < 0 || ack.duplicates < 0 || ack.accepted + ack.duplicates !== size
  ) {
    throw new Error('Event receiver did not acknowledge the batch')
  }
}

const eventQueue = createPersistentDeliveryQueue<AppTelemetryEvent>({
  storageKey: APP_EVENT_QUEUE_KEY,
  maxItems: APP_EVENT_QUEUE_MAX,
  batchSize: APP_EVENT_BATCH_MAX,
  idOf: (event) => event.id,
  isValid: isEvent,
  allowSend: () => isAppTelemetryEnabled(),
  send: async (batch) => {
    const environment = await eventEnvironment()
    if (!isAppTelemetryCollectionAllowed()) throw new DeliveryPausedError()
    const acknowledgement = await apiClient.post<unknown>(
      '/app-telemetry/events/',
      { ...environment, events: batch },
      undefined,
      {
        expectedStatus: 202,
        beforeFetch: () => {
          if (!isAppTelemetryCollectionAllowed()) throw new DeliveryPausedError()
        },
      },
    )
    acknowledgeBatch(acknowledgement, batch.length)
    const firstOpen = batch.find((event) => event.name === 'app_first_open')
    if (firstOpen) {
      // Маркер пишем только после приёма сервером. Пока событие в очереди,
      // повторный запуск не создаёт второй id.
      await AsyncStorage.setItem(APP_FIRST_OPEN_KEY, firstOpen.id)
    }
    if (!isAppTelemetryCollectionAllowed()) throw new DeliveryPausedError()
  },
})

registerTelemetryDisabledHook(async () => {
  await eventQueue.clear()
})

export async function enqueueAppTelemetryEvent(
  name: string,
  params: Record<string, unknown> = {},
  id = createUuidV4(),
): Promise<boolean> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return false
  const legalName = toAppTelemetryEventName(name)
  if (!legalName) return false
  if (!(await isAppTelemetryEnabled())) return false
  const saved = await eventQueue.enqueue({
    id,
    name: legalName,
    ts: new Date().toISOString(),
    session_id: getAppSessionId(),
    props: sanitizeAppTelemetryProps(params),
  })
  if (!(await isAppTelemetryEnabled())) {
    await eventQueue.clear()
    return false
  }
  return saved
}

export async function flushAppEvents(): Promise<void> {
  if (!(await isAppTelemetryEnabled())) {
    await eventQueue.clear()
    return
  }
  return eventQueue.flush()
}

export async function recordNativeAnalyticsEvent(
  eventName: string,
  eventParams: Record<string, unknown> = {},
): Promise<void> {
  const saved = await enqueueAppTelemetryEvent(eventName, eventParams)
  if (!saved) return
  if ((await eventQueue.size()) >= APP_EVENT_FLUSH_AT) await flushAppEvents()
}

async function emit(name: string, id?: string): Promise<void> {
  await enqueueAppTelemetryEvent(name, {}, id)
}

export async function startAppEventSession(): Promise<void> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return
  if (!(await isAppTelemetryEnabled())) return
  const marker = await AsyncStorage.getItem(APP_FIRST_OPEN_KEY)
  if (!marker) {
    const pending = (await eventQueue.snapshot()).some((event) => event.name === 'app_first_open')
    if (!pending) await enqueueAppTelemetryEvent('app_first_open', {}, createUuidV4())
  }
  await emit('app_open')
  await emit('session_start')
  sessionOpen = true
  // Фон во время старта пришёл, когда sessionOpen ещё был false, и обработчик
  // его пропустил. Если процесс всё ещё в фоне — закрываем сессию сейчас.
  if (sessionOpen && AppState.currentState === 'background') {
    sessionOpen = false
    await emit('session_end')
  }
  await flushAppEvents()
}

export async function handleAppEventBackground(): Promise<void> {
  if (!sessionOpen) return
  if (!(await isAppTelemetryEnabled())) {
    sessionOpen = false
    return
  }
  sessionOpen = false
  await emit('session_end')
  await flushAppEvents()
}

export async function handleAppEventForeground(): Promise<void> {
  if (!(await isAppTelemetryEnabled())) return
  await flushAppEvents()
}

const handleAppState = (status: AppStateStatus) => {
  if (status === 'background') void handleAppEventBackground()
  else if (status === 'active') void handleAppEventForeground()
}

/** Старт процесса: первое открытие, открытие и сессия. В jest и на web — нет. */
export function installAppEventTelemetry(): void {
  if (installed || Platform.OS === 'web') return
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID != null) return
  installed = true
  AppState.addEventListener('change', handleAppState)
  void startAppEventSession()
}

/** Только для тестов. */
export function __resetAppEventTelemetry(): void {
  eventQueue.__reset()
  installed = false
  sessionOpen = false
}
