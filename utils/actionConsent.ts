import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

// Хранилище фактов принятия «действенных» согласий (квест/поездка/контакты).
// Отдельно от cookie-consent (utils/consent.ts), т.к. применимо и на native.
// Формат: { [type]: { version, date } }. Версионирование позволяет повторно
// запросить согласие при обновлении формулировок (юр-проверка owner).
export const ACTION_CONSENT_KEY = 'metravel_action_consents_v1'

// Типы согласий. Часть точек гейта (trip/contact) появится после реализации
// social-trips (Sprint E/F) — константы заведены заранее для переиспользования.
export const CONSENT_TYPES = {
  QUEST_START: 'quest_start',
  TRIP_APPLY: 'trip_apply',
  TRIP_ORGANIZER: 'trip_organizer',
  CONTACT_EXCHANGE: 'contact_exchange',
} as const

export type ConsentType = (typeof CONSENT_TYPES)[keyof typeof CONSENT_TYPES]

export interface ActionConsentRecord {
  version: string
  date: string
}

export type ActionConsentStore = Record<string, ActionConsentRecord>

function parseStore(raw: string | null): ActionConsentStore {
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const out: ActionConsentStore = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (value && typeof value === 'object') {
        const v = value as { version?: unknown; date?: unknown }
        out[key] = {
          version: typeof v.version === 'string' ? v.version : '1',
          date: typeof v.date === 'string' ? v.date : '',
        }
      }
    }
    return out
  } catch {
    return {}
  }
}

function readWebSync(): ActionConsentStore {
  if (typeof window === 'undefined') return {}
  try {
    return parseStore(window.localStorage.getItem(ACTION_CONSENT_KEY))
  } catch {
    return {}
  }
}

/** Синхронное чтение — корректно только на web (localStorage). На native вернёт {}. */
export function readActionConsentsSync(): ActionConsentStore {
  return Platform.OS === 'web' ? readWebSync() : {}
}

export async function readActionConsentsAsync(): Promise<ActionConsentStore> {
  if (Platform.OS === 'web') return readWebSync()
  try {
    return parseStore(await AsyncStorage.getItem(ACTION_CONSENT_KEY))
  } catch {
    return {}
  }
}

export function hasActionConsent(
  store: ActionConsentStore,
  type: ConsentType,
  version = '1',
): boolean {
  const record = store[type]
  return Boolean(record) && record.version === version
}

/**
 * Зафиксировать согласие локально. Бэкенд-трекинг (BE-consent-tracking, задача
 * #435) ещё не реализован — когда появится endpoint, сюда добавится non-blocking
 * POST факта согласия (type/version/timestamp/user).
 */
export async function recordActionConsent(type: ConsentType, version = '1'): Promise<void> {
  const store = await readActionConsentsAsync()
  store[type] = { version, date: new Date().toISOString() }
  const serialized = JSON.stringify(store)
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.setItem(ACTION_CONSENT_KEY, serialized)
    } else {
      await AsyncStorage.setItem(ACTION_CONSENT_KEY, serialized)
    }
  } catch {
    // ignore — отсутствие хранилища не должно ломать сценарий
  }
}
