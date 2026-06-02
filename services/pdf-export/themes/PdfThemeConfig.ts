// src/services/pdf-export/themes/PdfThemeConfig.ts
// ✅ АРХИТЕКТУРА: Конфигурация тем оформления PDF (агрегатор)

import type { PdfThemeName, PdfThemeConfig } from './types'
import { minimalTheme } from './configs/minimal'
import { lightTheme } from './configs/light'
import { darkTheme } from './configs/dark'
import { travelMagazineTheme } from './configs/travelMagazine'
import { classicTheme } from './configs/classic'
import { modernTheme } from './configs/modern'
import { romanticTheme } from './configs/romantic'
import { adventureTheme } from './configs/adventure'
import { illustratedTheme } from './configs/illustrated'
import { blackWhiteTheme } from './configs/blackWhite'
import { sepiaTheme } from './configs/sepia'
import { newspaperTheme } from './configs/newspaper'
import { oceanTheme } from './configs/ocean'
import { forestTheme } from './configs/forest'
import { sunsetTheme } from './configs/sunset'
import { nordicTheme } from './configs/nordic'
import { retroTheme } from './configs/retro'
import { tropicalTheme } from './configs/tropical'

export type { PdfThemeName, PdfThemeConfig } from './types'

export {
  minimalTheme,
  lightTheme,
  darkTheme,
  travelMagazineTheme,
  classicTheme,
  modernTheme,
  romanticTheme,
  adventureTheme,
  illustratedTheme,
  blackWhiteTheme,
  sepiaTheme,
  newspaperTheme,
  oceanTheme,
  forestTheme,
  sunsetTheme,
  nordicTheme,
  retroTheme,
  tropicalTheme,
}

/**
 * Реестр тем
 */
export const PDF_THEMES: Record<PdfThemeName, PdfThemeConfig> = {
  minimal: minimalTheme,
  light: lightTheme,
  dark: darkTheme,
  'travel-magazine': travelMagazineTheme,
  classic: classicTheme,
  modern: modernTheme,
  romantic: romanticTheme,
  adventure: adventureTheme,
  illustrated: illustratedTheme,
  'black-white': blackWhiteTheme,
  sepia: sepiaTheme,
  newspaper: newspaperTheme,
  ocean: oceanTheme,
  forest: forestTheme,
  sunset: sunsetTheme,
  nordic: nordicTheme,
  retro: retroTheme,
  tropical: tropicalTheme,
}

/**
 * Получить конфигурацию темы по имени
 */
export function getThemeConfig(themeName: PdfThemeName | string): PdfThemeConfig {
  return PDF_THEMES[themeName as PdfThemeName] || minimalTheme
}
