import fs from 'fs'
import path from 'path'
import { Platform } from 'react-native'
import { getThemedColors } from '@/constants/designSystem'
import { SEASONAL_THEMES } from '@/constants/seasonalThemes'
import { getSeasonalThemePalette, SEASONAL_THEME_PALETTES } from '@/constants/seasonalThemePalettes'

const css = fs.readFileSync(path.join(process.cwd(), 'app/global.css'), 'utf8')
const luminance = (hex: string) => {
  const channels = hex.slice(1).match(/../g)!.map(channel => {
    const value = parseInt(channel, 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}
const contrast = (a: string, b: string) => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}

const originalPlatform = Platform.OS
afterAll(() => Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform }))

describe('native seasonal palettes', () => {
  it('covers exactly the registry themes with both schemes', () => {
    expect(Object.keys(SEASONAL_THEME_PALETTES).sort()).toEqual(SEASONAL_THEMES.map(theme => theme.id).sort())
    expect(getSeasonalThemePalette(null, false)).toBeNull()
  })

  describe.each(SEASONAL_THEMES.map(theme => theme.id))('%s', season => {
    it.each([false, true])('matches CSS, derives aliases/alphas/gradients and preserves safety colors (dark=%s)', isDark => {
      const selector = `html[data-season="${season}"]${isDark ? '[data-theme="dark"]' : ''} {`
      const block = css.slice(css.indexOf(selector) + selector.length).split('}')[0]
      const variables = Object.fromEntries([...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(match => [match[1], match[2]]))
      const palette = getSeasonalThemePalette(season, isDark)!
      for (const [key, value] of Object.entries(palette)) {
        const cssKey = key === 'sceneJewel' ? 'season-logo-jewel' : key === 'sceneWordmark' ? 'season-logo-wordmark' : `color-${key}`
        expect(value).toBe(variables[cssKey])
      }
      for (const os of ['android', 'ios']) {
        Object.defineProperty(Platform, 'OS', { configurable: true, value: os })
        const base = getThemedColors(isDark)
        const colors = getThemedColors(isDark, season)
        expect(colors.background).toBe(palette.background)
        expect(colors.surfaceLight).toBe(palette.backgroundTertiary)
        expect(colors.textSecondary).toBe(palette.textMuted)
        expect(colors.textMuted).toBe(palette.textMuted)
        expect(colors.textTertiary).toBe(palette.textSubtle)
        expect(colors.textSubtle).toBe(palette.textSubtle)
        for (const alpha of ['30', '40', '50'] as const) {
          expect(colors[`primaryAlpha${alpha}`]).toBe(variables[`color-primary-${alpha}`])
        }
        expect(colors.surfaceAlpha40).toBe(variables['color-surface-40'])
        expect(colors.gradients.primary).toContain(palette.primaryLight)
        expect(colors.gradients.surface).toContain(palette.surfaceElevated)
        for (const status of ['success', 'warning', 'danger', 'info', 'textOnPrimary'] as const) {
          expect(colors[status]).toBe(base[status])
        }
        for (const text of [colors.text, colors.textSecondary, colors.textTertiary, colors.primaryText]) {
          for (const surface of [colors.background, colors.backgroundSecondary, colors.backgroundTertiary, colors.surface, colors.surfaceElevated]) {
            expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5)
          }
        }
      }
    })
  })

  it.each([false, true])('keeps existing web CSS variables/fallbacks for every season (dark=%s)', isDark => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
    for (const theme of SEASONAL_THEMES) {
      expect(getThemedColors(isDark, theme.id)).toEqual(getThemedColors(isDark))
    }
  })
})
