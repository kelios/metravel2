/**
 * #1879: слот аккаунта в desktop-шапке обязан быть боксом ФИКСИРОВАННОЙ ширины.
 *
 * Слева от него стоит `navScroll` с `flex:1`, поэтому весь слак строки живёт
 * левее переключателя языка: любой прирост правой группы уводит
 * `header-language-switcher` влево. С `minWidth` бокс был лишь нижней границей и
 * рос под контент — гостевой кластер BE (237.95 px) и PL (251.03 px) перекрывал
 * прежние 224 px всегда, а RU (223.63 px) проходил с запасом в 0.37 px, и на
 * профиле ровно 1280 px перф-гейт краснел примерно через прогон.
 *
 * Ниже 1280 px правая группа — `rightSectionMobile` с `flex:1`, навигации нет
 * вовсе, и переключатель прижат к ЛЕВОМУ краю строки: этот класс сдвигов туда
 * не доходит. Поэтому мобильная ветка обязана остаться гибкой.
 */
import { Platform, StyleSheet } from 'react-native'

import {
  createCustomHeaderStyles,
  HEADER_ACCOUNT_SLOT_WIDTH,
} from '@/components/layout/customHeaderStyles'

const colors = new Proxy({}, { get: () => '#000000' }) as any

const buildStyles = (isMobile: boolean) =>
  createCustomHeaderStyles(colors, isMobile, 0)

describe('CustomHeader: бокс слота аккаунта', () => {
  const originalPlatformOS = Platform.OS

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatformOS })
  })

  it('на web в desktop-строке фиксирует ширину, а не минимум', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' })

    const rightSection = StyleSheet.flatten(buildStyles(false).rightSection)

    expect(rightSection.width).toBe(HEADER_ACCOUNT_SLOT_WIDTH)
    // Именно отсутствие minWidth и делает бокс неспособным вырасти под контент.
    expect(rightSection.minWidth).toBeUndefined()
    expect(rightSection.flexGrow).toBe(0)
    expect(rightSection.flexShrink).toBe(0)
  })

  it('оставляет мобильную правую группу гибкой', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' })

    const rightSectionMobile = StyleSheet.flatten(buildStyles(true).rightSectionMobile)

    expect(rightSectionMobile.flex).toBe(1)
    expect(rightSectionMobile.minWidth).toBe(0)
    expect(rightSectionMobile.width).toBeUndefined()
  })

  it('на native ширину слота не задаёт', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' })

    const rightSection = StyleSheet.flatten(buildStyles(false).rightSection)

    expect(rightSection.width).toBeUndefined()
    expect(rightSection.minWidth).toBeUndefined()
  })
})
