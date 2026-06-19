// __tests__/services/pdf-export/themes/premiumThemes.test.ts
// Новые премиум-темы editorial-luxe / watercolor (#295)

import {
  PDF_THEMES,
  getThemeConfig,
  editorialLuxeTheme,
  watercolorTheme,
} from '@/services/pdf-export/themes/PdfThemeConfig'
import { isPremiumTheme } from '@/services/pdf-export/themes/themeTiers'

describe('Новые премиум-темы (#295)', () => {
  const NEW_THEMES = [
    { name: 'editorial-luxe' as const, config: editorialLuxeTheme },
    { name: 'watercolor' as const, config: watercolorTheme },
  ]

  it.each(NEW_THEMES)('$name резолвится через getThemeConfig', ({ name, config }) => {
    expect(getThemeConfig(name)).toBe(config)
    expect(getThemeConfig(name).name).toBe(name)
  })

  it.each(NEW_THEMES)('$name зарегистрирована в PDF_THEMES', ({ name, config }) => {
    expect(PDF_THEMES[name]).toBe(config)
  })

  it.each(NEW_THEMES)('$name помечена как premium', ({ name }) => {
    expect(isPremiumTheme(name)).toBe(true)
  })

  it('editorial-luxe использует золотой акцент и засечную типографику', () => {
    expect(editorialLuxeTheme.colors.accent).toBe('#b08d57')
    expect(editorialLuxeTheme.typography.headingFont).toContain('Cormorant Garamond')
  })

  it('watercolor использует пастельный сине-зелёный акцент', () => {
    expect(watercolorTheme.colors.accent).toBe('#5a9aa0')
  })
})
