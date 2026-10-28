// Телеметрия нативного приложения в НАШ бэкенд (#2840/#2841): никаких сторонних
// сервисов. Здесь — общий для потоков слой: анонимный install_id, id сессии
// процесса, окружение сборки и очередь отчётов о падениях.
// Контракт API — back-карточка «Телеметрия приложения» (/api/app-telemetry/*).

import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import { Platform } from 'react-native'

import { apiClient } from '@/api/client'
import { getActiveLocale } from '@/i18n/format'
import { createPersistentDeliveryQueue, DeliveryPausedError } from '@/utils/persistentDeliveryQueue'
import { createUuidV4 } from '@/utils/uuid'

export const APP_INSTALL_ID_KEY = 'metravel_app_install_id_v1'
export const APP_CRASH_QUEUE_KEY = 'metravel_app_crash_queue_v1'
/** Общий с событиями (#2841). Нет ключа — сбор включён. '0' — выключен. */
export const APP_TELEMETRY_ENABLED_KEY = 'metravel_app_telemetry_enabled_v1'

export const CRASH_MESSAGE_MAX = 500
export const CRASH_STACK_MAX = 16 * 1024

export type AppTelemetryEnvironment = {
  platform: 'android' | 'ios'
  app_version: string
  build_number: string
  os_version: string
  device_model: string
  locale: string
}

export type AppCrashKind = 'js_exception' | 'unhandled_rejection' | 'render_error' | 'abnormal_exit'

export type AppCrashReport = AppTelemetryEnvironment & {
  id: string
  install_id: string
  session_id: string
  ts: string
  kind: AppCrashKind
  fatal: boolean
  message: string
  stack: string
  component?: string
}

let installId: string | null = null
let installIdPromise: Promise<string> | null = null
let sessionId: string | null = null
let telemetryEnabled: boolean | null = null
let telemetryEnabledPromise: Promise<boolean> | null = null
let telemetryRevision = 0
let enabledWrite: Promise<void> = Promise.resolve()
let onTelemetryDisabled: (() => Promise<void>) | null = null

/** Синхронный снимок. Пока значение не прочитано, сбор включён. */
export function isAppTelemetryCollectionAllowed(): boolean {
  return telemetryEnabled !== false
}

/** true только после чтения хранилища, когда сбор включён. */
export function isAppTelemetryEnabledSnapshot(): boolean {
  return telemetryEnabled === true
}

/** Очередь событий регистрирует очистку, не создавая цикл импортов. */
export function registerTelemetryDisabledHook(hook: () => Promise<void>): void {
  onTelemetryDisabled = hook
}

/**
 * Выключатель «Помогать улучшать приложение».
 * Пока значение не прочитано, сбор считается включённым — это значение по умолчанию.
 */
export async function isAppTelemetryEnabled(): Promise<boolean> {
  if (telemetryEnabled !== null) return telemetryEnabled
  if (!telemetryEnabledPromise) {
    telemetryEnabledPromise = (async () => {
      try {
        const stored = await AsyncStorage.getItem(APP_TELEMETRY_ENABLED_KEY)
        return stored !== '0'
      } catch {
        return true
      }
    })()
      .then((value) => {
        if (telemetryEnabled === null) telemetryEnabled = value
        return telemetryEnabled
      })
      .finally(() => {
        telemetryEnabledPromise = null
      })
  }
  return telemetryEnabledPromise
}

export async function setAppTelemetryEnabled(enabled: boolean): Promise<void> {
  const revision = ++telemetryRevision
  telemetryEnabled = enabled
  const write = enabledWrite.then(async () => {
    if (revision !== telemetryRevision) return
    try {
      await AsyncStorage.setItem(APP_TELEMETRY_ENABLED_KEY, telemetryEnabled === false ? '0' : '1')
    } catch {
      // Выбор этого процесса остаётся в памяти, даже если диск недоступен.
    }
  })
  enabledWrite = write
  await write
  // Старый «выкл» не должен стереть очередь после более нового «вкл».
  if (revision !== telemetryRevision || telemetryEnabled !== false) return
  const crashCleared = clearAppCrashQueue()
  const eventsCleared = onTelemetryDisabled ? onTelemetryDisabled() : Promise.resolve()
  await crashCleared
  await eventsCleared
}

/** Анонимный id установки: не рекламный, живёт до удаления приложения. */
export async function getAppInstallId(): Promise<string> {
  if (installId) return installId
  if (!installIdPromise) {
    installIdPromise = (async () => {
      try {
        const stored = await AsyncStorage.getItem(APP_INSTALL_ID_KEY)
        if (stored) return stored
      } catch {
        // Сбой чтения не равен отсутствующему ключу. Не затираем возможный
        // сохранённый id: временный живёт только до перезапуска процесса.
        return createUuidV4()
      }
      const created = createUuidV4()
      try {
        await AsyncStorage.setItem(APP_INSTALL_ID_KEY, created)
      } catch {
        // noop
      }
      return created
    })()
      .then((value) => {
        installId = value
        return value
      })
      .finally(() => {
        installIdPromise = null
      })
  }
  return installIdPromise
}

/** Сессия = запуск процесса приложения. */
export function getAppSessionId(): string {
  if (!sessionId) sessionId = createUuidV4()
  return sessionId
}

const readDeviceModel = (): string => {
  const constants = (Platform as { constants?: Record<string, unknown> }).constants ?? {}
  if (Platform.OS === 'android') {
    const manufacturer = String(constants.Manufacturer ?? constants.Brand ?? '').trim()
    const model = String(constants.Model ?? '').trim()
    return [manufacturer, model].filter(Boolean).join(' ') || 'unknown'
  }
  return Device.modelName ?? Device.modelId ?? 'unknown'
}

export function getAppTelemetryEnvironment(): AppTelemetryEnvironment {
  const config = Constants.expoConfig
  const isAndroid = Platform.OS === 'android'
  return {
    platform: isAndroid ? 'android' : 'ios',
    app_version: String(config?.version ?? 'unknown'),
    build_number: String(
      (isAndroid ? config?.android?.versionCode : Constants.platform?.ios?.buildNumber ?? config?.ios?.buildNumber) ?? 'unknown',
    ),
    os_version: String(Platform.Version ?? 'unknown'),
    device_model: readDeviceModel(),
    locale: getActiveLocale(),
  }
}

const isCrashReport = (value: unknown): value is AppCrashReport => {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.install_id === 'string' &&
    typeof record.session_id === 'string' &&
    typeof record.kind === 'string' &&
    typeof record.message === 'string'
  )
}

const crashQueue = createPersistentDeliveryQueue<AppCrashReport>({
  storageKey: APP_CRASH_QUEUE_KEY,
  maxItems: 100,
  // Эндпоинт падений принимает один отчёт на запрос.
  batchSize: 1,
  idOf: (report) => report.id,
  isValid: isCrashReport,
  allowSend: () => isAppTelemetryEnabled(),
  send: async ([report]) => {
    if (!isAppTelemetryCollectionAllowed()) throw new DeliveryPausedError()
    const acknowledgement = await apiClient.post<unknown>('/app-telemetry/crashes/', report, undefined, {
      expectedStatus: 202,
      beforeFetch: () => {
        if (!isAppTelemetryCollectionAllowed()) throw new DeliveryPausedError()
      },
    })
    // Удаляем отчёт только после HTTP 202 и явного подтверждения одного
    // принятого/дублирующего id; неожиданный ответ оставляем для повтора.
    const ack = acknowledgement as { accepted?: unknown; duplicates?: unknown } | null
    if (
      !ack || typeof ack !== 'object' ||
      typeof ack.accepted !== 'number' || typeof ack.duplicates !== 'number' ||
      !Number.isInteger(ack.accepted) || !Number.isInteger(ack.duplicates) ||
      ack.accepted < 0 || ack.duplicates < 0 || ack.accepted + ack.duplicates !== 1
    ) {
      throw new Error('Crash receiver did not acknowledge the report')
    }
  },
})

const isTelemetrySwitchOff = () => telemetryEnabled === false

export async function enqueueAppCrashReport(report: AppCrashReport): Promise<boolean> {
  if (isTelemetrySwitchOff()) return false
  const saved = await crashQueue.enqueue(report)
  // Выключатель мог смениться, пока запись ждала диск.
  if (isTelemetrySwitchOff()) {
    await crashQueue.clear()
    return false
  }
  return saved
}

export async function flushAppCrashReports(): Promise<void> {
  if (!(await isAppTelemetryEnabled())) {
    await crashQueue.clear()
    return
  }
  return crashQueue.flush()
}

export function clearAppCrashQueue(): Promise<boolean> {
  return crashQueue.clear()
}

/** Только для тестов. */
export function __resetAppTelemetry(): void {
  crashQueue.__reset()
  installId = null
  installIdPromise = null
  sessionId = null
  telemetryEnabled = null
  telemetryEnabledPromise = null
  telemetryRevision = 0
  enabledWrite = Promise.resolve()
}
