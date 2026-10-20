import AsyncStorage from '@react-native-async-storage/async-storage'

import {
  DEFAULT_LOCALE,
  getSystemLocale,
  isSupportedLocale,
  type SupportedLocale,
} from './config'

export const LOCALE_PREFERENCE_STORAGE_KEY = '@metravel/locale-preference:v1'

export type LocalePreference =
  | { version: 1; mode: 'system' }
  | { version: 1; mode: 'explicit'; locale: SupportedLocale }

export const DEFAULT_LOCALE_PREFERENCE: LocalePreference = {
  version: 1,
  mode: 'explicit',
  locale: DEFAULT_LOCALE,
}

export const SYSTEM_LOCALE_PREFERENCE: LocalePreference = {
  version: 1,
  mode: 'system',
}

const parsePersistedLocalePreference = (raw: string | null): LocalePreference | null => {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<LocalePreference> | null
    if (parsed?.version !== 1) return null
    if (parsed.mode === 'system') return SYSTEM_LOCALE_PREFERENCE
    if (parsed.mode === 'explicit' && isSupportedLocale(parsed.locale)) {
      return { version: 1, mode: 'explicit', locale: parsed.locale }
    }
  } catch {
    // Missing, unreadable and invalid preferences are not a deliberate choice.
  }

  return null
}

export const parseLocalePreference = (raw: string | null): LocalePreference =>
  parsePersistedLocalePreference(raw) ?? DEFAULT_LOCALE_PREFERENCE

let pendingWrite: Promise<void> = Promise.resolve()
let writeGeneration = 0
const preferenceListeners = new Set<(preference: LocalePreference) => void>()

/** Reports deliberate preferences only after their latest storage write succeeds. */
export const subscribeLocalePreference = (
  listener: (preference: LocalePreference) => void,
): (() => void) => {
  preferenceListeners.add(listener)
  return () => { preferenceListeners.delete(listener) }
}

export const resolveLocalePreference = (
  preference: LocalePreference,
): SupportedLocale => {
  if (preference.mode === 'explicit') return preference.locale
  return getSystemLocale() || DEFAULT_LOCALE
}

/** A fallback or failed read must never become an account-language selection. */
export const readPersistedLocalePreference = async (): Promise<LocalePreference | null> => {
  while (true) {
    const queuedWrite = pendingWrite
    await queuedWrite
    let raw: string | null
    try {
      raw = await AsyncStorage.getItem(LOCALE_PREFERENCE_STORAGE_KEY)
    } catch {
      if (queuedWrite !== pendingWrite) continue
      return null
    }
    // A write can start while getItem is in flight. Read its final value instead.
    if (queuedWrite !== pendingWrite) continue
    return parsePersistedLocalePreference(raw)
  }
}

export const readLocalePreference = async (): Promise<LocalePreference> =>
  (await readPersistedLocalePreference()) ?? DEFAULT_LOCALE_PREFERENCE

/**
 * Синхронное чтение предпочтения на web (#2239): `AsyncStorage` там хранит ключ
 * в `window.localStorage` как есть, поэтому первый клиентский рендер может узнать
 * сохранённую локаль, не дожидаясь промиса. Вне браузера — `null`.
 */
export const readWebLocalePreferenceSync = (): LocalePreference | null => {
  try {
    const storage = typeof window === 'undefined' ? undefined : window.localStorage
    if (!storage) return null
    return parseLocalePreference(storage.getItem(LOCALE_PREFERENCE_STORAGE_KEY))
  } catch {
    return null
  }
}

export const writeLocalePreference = (
  preference: LocalePreference,
): Promise<void> => {
  const generation = ++writeGeneration
  const write = pendingWrite.then(async () => {
    await AsyncStorage.setItem(LOCALE_PREFERENCE_STORAGE_KEY, JSON.stringify(preference))
    if (generation !== writeGeneration) return
    for (const listener of preferenceListeners) {
      try { listener(preference) } catch {
        // Subscriber failures cannot invalidate a successful preference write.
      }
    }
  })
  // Keep later writes/reads moving after a failure, while the caller sees its error.
  pendingWrite = write.catch(() => {})
  return write
}
