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
import { createPersistentDeliveryQueue } from '@/utils/persistentDeliveryQueue'
import { createUuidV4 } from '@/utils/uuid'

export const APP_INSTALL_ID_KEY = 'metravel_app_install_id_v1'
export const APP_CRASH_QUEUE_KEY = 'metravel_app_crash_queue_v1'

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

/** Анонимный id установки: не рекламный, живёт до удаления приложения. */
export async function getAppInstallId(): Promise<string> {
  if (installId) return installId
  if (!installIdPromise) {
    installIdPromise = (async () => {
      try {
        const stored = await AsyncStorage.getItem(APP_INSTALL_ID_KEY)
        if (stored) return stored
      } catch {
        // Недоступное хранилище: id живёт до перезапуска.
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
  send: async ([report]) => {
    const acknowledgement = await apiClient.post<unknown>('/app-telemetry/crashes/', report)
    // API-клиент возвращает тело ответа без статуса. Удалять отчёт можно
    // только после явного подтверждения одного принятого/дублирующего id;
    // пустой или неожиданный успешный ответ оставляет его для повтора.
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

export const enqueueAppCrashReport = crashQueue.enqueue
export const flushAppCrashReports = crashQueue.flush

/** Только для тестов. */
export function __resetAppTelemetry(): void {
  crashQueue.__reset()
  installId = null
  installIdPromise = null
  sessionId = null
}
