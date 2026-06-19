// __tests__/services/pdf-export/themes/themeTiers.test.ts
import {
  FREE_PDF_THEMES,
  PDF_THEME_TIERS,
  getThemeTier,
  isPremiumTheme,
} from '../../../../services/pdf-export/themes/themeTiers'
import { PDF_THEMES } from '../../../../services/pdf-export/themes/PdfThemeConfig'

describe('themeTiers', () => {
  it('каждый ключ PdfThemeName имеет тир', () => {
    const tierKeys = Object.keys(PDF_THEME_TIERS).sort()
    expect(tierKeys.length).toBeGreaterThan(0)
    for (const tier of Object.values(PDF_THEME_TIERS)) {
      expect(tier === 'free' || tier === 'premium').toBe(true)
    }
  })

  it('FREE_PDF_THEMES = ровно ожидаемые 5', () => {
    expect([...FREE_PDF_THEMES].sort()).toEqual(
      ['black-white', 'classic', 'dark', 'light', 'minimal'].sort()
    )
  })

  it('все free-темы помечены тиром free в карте', () => {
    for (const name of FREE_PDF_THEMES) {
      expect(PDF_THEME_TIERS[name]).toBe('free')
    }
  })

  it('isPremiumTheme различает free и premium', () => {
    expect(isPremiumTheme('minimal')).toBe(false)
    expect(isPremiumTheme('romantic')).toBe(true)
  })

  it('getThemeTier возвращает корректный тир', () => {
    expect(getThemeTier('minimal')).toBe('free')
    expect(getThemeTier('romantic')).toBe('premium')
  })

  it('тиры покрывают зарегистрированные темы (кроме illustrated, отсутствующей в союзе)', () => {
    for (const name of Object.keys(PDF_THEMES)) {
      if (name === 'illustrated') continue
      expect(PDF_THEME_TIERS[name as keyof typeof PDF_THEME_TIERS]).toBeDefined()
    }
  })
})
