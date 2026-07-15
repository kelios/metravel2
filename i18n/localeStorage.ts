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

export const parseLocalePreference = (raw: string | null): LocalePreference => {
  if (!raw) return DEFAULT_LOCALE_PREFERENCE

  try {
    const parsed = JSON.parse(raw) as Partial<LocalePreference>
    if (parsed.version !== 1) return DEFAULT_LOCALE_PREFERENCE
    if (parsed.mode === 'system') return SYSTEM_LOCALE_PREFERENCE
    if (parsed.mode === 'explicit' && isSupportedLocale(parsed.locale)) {
      return { version: 1, mode: 'explicit', locale: parsed.locale }
    }
  } catch {
    // Invalid preferences fall back to the safe explicit Russian default.
  }

  return DEFAULT_LOCALE_PREFERENCE
}

export const resolveLocalePreference = (
  preference: LocalePreference,
): SupportedLocale => {
  if (preference.mode === 'explicit') return preference.locale
  return getSystemLocale() || DEFAULT_LOCALE
}

export const readLocalePreference = async (): Promise<LocalePreference> => {
  try {
    return parseLocalePreference(await AsyncStorage.getItem(LOCALE_PREFERENCE_STORAGE_KEY))
  } catch {
    return DEFAULT_LOCALE_PREFERENCE
  }
}

export const writeLocalePreference = async (
  preference: LocalePreference,
): Promise<void> => {
  await AsyncStorage.setItem(LOCALE_PREFERENCE_STORAGE_KEY, JSON.stringify(preference))
}
