// services/pdf-export/themes/themeTiers.ts
// Тиры тем PDF-экспорта: free vs premium (FE-8.1 / #292)

import type { PdfThemeName } from '@/components/export/ThemePreview'

export type PdfThemeTier = 'free' | 'premium'

export const FREE_PDF_THEMES = [
  'minimal',
  'light',
  'classic',
  'dark',
  'black-white',
] as const satisfies readonly PdfThemeName[]

// Record<PdfThemeName, ...> делает карту исчерпывающей: при добавлении новой
// темы в PdfThemeName компилятор потребует указать её тир здесь.
export const PDF_THEME_TIERS: Record<PdfThemeName, PdfThemeTier> = {
  minimal: 'free',
  light: 'free',
  classic: 'free',
  dark: 'free',
  'black-white': 'free',
  'travel-magazine': 'premium',
  modern: 'premium',
  romantic: 'premium',
  adventure: 'premium',
  sepia: 'premium',
  newspaper: 'premium',
  ocean: 'premium',
  forest: 'premium',
  sunset: 'premium',
  nordic: 'premium',
  retro: 'premium',
  tropical: 'premium',
  'editorial-luxe': 'premium',
  watercolor: 'premium',
}

export function getThemeTier(name: PdfThemeName): PdfThemeTier {
  return PDF_THEME_TIERS[name]
}

export function isPremiumTheme(name: PdfThemeName): boolean {
  return getThemeTier(name) === 'premium'
}

// Строковый вариант для раннтайма/сервисов, где тема приходит как string
// (генератор хранит themeName: string). Неизвестные имена считаем не-премиум.
export function isPremiumThemeName(name: string): boolean {
  const tier = PDF_THEME_TIERS[name as PdfThemeName]
  return tier === 'premium'
}

// Free-тема по умолчанию для безопасного фолбэка с премиум-темы.
export const DEFAULT_FREE_PDF_THEME = 'minimal' as const satisfies PdfThemeName
