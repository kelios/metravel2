// components/export/BookSettingsModal.helpers.ts
// Чистые хелперы настроек фотоальбома (вынесено из BookSettingsModal.tsx, поведение не меняется)

import { Platform } from 'react-native'
import { getThemedColors } from '@/hooks/useTheme'
import type { BookSettings } from './BookSettingsModal.types'
import { DEFAULT_CHECKLIST_SELECTION, defaultBookSettings } from './BookSettingsModal.constants'

export const buildInitialSettings = (
  overrides?: Partial<BookSettings>
): BookSettings => {
  const merged: BookSettings = {
    ...defaultBookSettings,
    ...overrides,
  }

  merged.title = overrides?.title ?? defaultBookSettings.title

  // Флаги includeGallery/includeMap теперь управляются только логикой экспорта,
  // без дополнительных режимов photoMode/mapMode.

  merged.checklistSections =
    overrides?.checklistSections && overrides.checklistSections.length > 0
      ? overrides.checklistSections
      : DEFAULT_CHECKLIST_SELECTION

  if (typeof merged.includeChecklists === 'undefined') {
    merged.includeChecklists = defaultBookSettings.includeChecklists
  }

  return merged
}

export const resolveThemed = (isDark: boolean) => {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const domTheme = document.documentElement.getAttribute('data-theme')
    if (domTheme === 'dark') return getThemedColors(true)
    if (domTheme === 'light') return getThemedColors(false)
  }
  return getThemedColors(isDark)
}

type Themed = ReturnType<typeof getThemedColors>

export const buildModalColors = (themed: Themed) => ({
  overlay: themed.overlay,
  surface: themed.surface,
  surfaceMuted: themed.surfaceMuted,
  backgroundSecondary: themed.backgroundSecondary,
  backgroundTertiary: themed.backgroundTertiary,
  text: themed.text,
  textMuted: themed.textMuted,
  textSubtle: themed.textTertiary,
  border: themed.border,
  borderStrong: themed.borderStrong,
  primary: themed.primary,
  primaryDark: themed.primaryDark,
  primaryLight: themed.primaryLight,
  primarySoft: themed.primarySoft,
  focus: themed.focus,
  textOnPrimary: themed.textOnPrimary,
  accent: themed.accent,
  accentLight: themed.accentLight,
  error: themed.danger,
  errorSoft: themed.dangerSoft,
  errorDark: themed.dangerDark,
  borderAccent: themed.borderAccent,
})
