import { pickAdventFacadeSource, resolveAdventWindowRect } from '@/components/advent/AdventWindowCrop'
import { resolveAdventShareToneColors } from '@/components/advent/AdventShareActions'
// Jest собирает под native (ios): web-копии берём из `.web` явно, native-пару — обычным импортом.
import { ADVENT_FACADE_BANNER_SOURCES } from '@/constants/adventFacadeBannerSources.web'
import { ADVENT_FACADE_BANNER_SOURCES as NATIVE_BANNER_SOURCES } from '@/constants/adventFacadeBannerSources'
import { ADVENT_ART_COLORS } from '@/constants/adventVisuals'

// Те же рамки, что у баннера главной: телефон — во всю ширину, desktop — окно 3:4.
const PHONE_ASPECT = 2.2
const DESKTOP_ASPECT = 3 / 4
const DAYS = [null, ...Array.from({ length: 24 }, (_, index) => index + 1)]

type Rgba = [number, number, number, number]
const parse = (color: string): Rgba => {
  if (color.startsWith('#')) {
    const hex = color.slice(1)
    return [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16)).concat(1) as Rgba
  }
  const [r, g, b, a = '1'] = color.replace(/rgba?\(|\)/g, '').split(',').map((part) => part.trim())
  return [Number(r), Number(g), Number(b), Number(a)]
}
const over = (top: Rgba, bottom: Rgba): Rgba => [0, 1, 2].map((i) => top[i] * top[3] + bottom[i] * (1 - top[3])).concat(1) as Rgba
const luminance = ([r, g, b]: Rgba) =>
  [r, g, b]
    .map((channel) => channel / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0)
const contrast = (fg: string, bg: string) => {
  const back = parse(bg)
  const [a, b] = [luminance(over(parse(fg), back)), luminance(back)].sort((x, y) => y - x)
  return (a + 0.05) / (b + 0.05)
}

describe('home banner facade sources (#3488)', () => {
  it('serves every phone crop from a full-resolution band, never the full facade', () => {
    for (const day of DAYS) {
      const picked = pickAdventFacadeSource(resolveAdventWindowRect(day, PHONE_ASPECT), ADVENT_FACADE_BANNER_SOURCES.phone)
      expect({ day, key: picked.key }).not.toEqual({ day, key: 'full' })
    }
    expect(pickAdventFacadeSource(resolveAdventWindowRect(5, PHONE_ASPECT), ADVENT_FACADE_BANNER_SOURCES.phone).key).toBe('row-2')
    expect(pickAdventFacadeSource(resolveAdventWindowRect(24, PHONE_ASPECT), ADVENT_FACADE_BANNER_SOURCES.phone).key).toBe('row-6')
    expect(pickAdventFacadeSource(resolveAdventWindowRect(null, PHONE_ASPECT), ADVENT_FACADE_BANNER_SOURCES.phone).key).toBe('roof')
  })

  it('serves the desktop window from the small facade', () => {
    for (const day of DAYS) {
      expect(pickAdventFacadeSource(resolveAdventWindowRect(day, DESKTOP_ASPECT), ADVENT_FACADE_BANNER_SOURCES.desktop).key).toBe('small')
    }
  })

  it('falls back to the full facade when no copy covers the crop, so the frame never shows a gap', () => {
    // Окно 3:4 выше любой полосы.
    expect(pickAdventFacadeSource(resolveAdventWindowRect(10, DESKTOP_ASPECT), ADVENT_FACADE_BANNER_SOURCES.phone).key).toBe('full')
    expect(pickAdventFacadeSource(resolveAdventWindowRect(10, DESKTOP_ASPECT)).key).toBe('full')
  })

  it('ships no facade copies in the native app: the banner crops the bundled full facade', () => {
    expect(NATIVE_BANNER_SOURCES).toEqual({ phone: [], desktop: [] })
    expect(pickAdventFacadeSource(resolveAdventWindowRect(5, PHONE_ASPECT), NATIVE_BANNER_SOURCES.phone).key).toBe('full')
  })
})

describe('share actions on the night diploma (#3488)', () => {
  const themeColors = { textMuted: '#636363', danger: '#9a6363', primaryDark: '#6a8d7f' }

  it('keeps the status line and the outline button readable on the night sky (WCAG AA)', () => {
    const night = resolveAdventShareToneColors('night', themeColors)
    expect(contrast(night.status, ADVENT_ART_COLORS.night)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(night.failed, ADVENT_ART_COLORS.night)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(night.outlineLabel ?? '', ADVENT_ART_COLORS.night)).toBeGreaterThanOrEqual(4.5)
    const hovered = over(parse(night.outlineHover ?? ''), parse(ADVENT_ART_COLORS.night))
    expect(contrast(night.outlineLabel ?? '', `rgba(${hovered.slice(0, 3).join(',')},1)`)).toBeGreaterThanOrEqual(4.5)
  })

  it('stays on theme colours outside the diploma', () => {
    expect(resolveAdventShareToneColors('theme', themeColors)).toEqual({
      status: themeColors.textMuted,
      failed: themeColors.danger,
      outlineIcon: themeColors.primaryDark,
    })
  })
})
