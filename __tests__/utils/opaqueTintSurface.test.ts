/**
 * #2900 — на iPhone гео-баннер «Геолокация недоступна» и активная кнопка
 * тулбара карты были почти прозрачными: фон брался из «мягких» токенов
 * (`warningSoft` 0.08, `primarySoft` 0.06), и сквозь контролы над картой
 * просвечивали тайлы и пузыри кластеров WebView («кластеры поверх панели»).
 * Контракт: контрол, лежащий над картой, имеет НЕПРОЗРАЧНЫЙ фон на native и
 * непрозрачную композицию `surface` + tint на web.
 */
import { Platform, StyleSheet } from 'react-native'

import { getMapMobileTopOverlayStyles } from '@/components/MapPage/MapMobile/MapMobileTopOverlay.styles'
import { getThemedColors } from '@/hooks/useTheme'
import { getStyles } from '@/screens/tabs/map.styles'
import {
  compositeTintOverBase,
  getOpaqueTintSurfaceStyle,
  parseCssColor,
} from '@/utils/opaqueTintSurface'

const alphaOf = (color: unknown) => parseCssColor(String(color))?.a

describe('parseCssColor', () => {
  it.each([
    ['#fff', { r: 255, g: 255, b: 255, a: 1 }],
    ['#2a2a2a', { r: 42, g: 42, b: 42, a: 1 }],
    ['#00000080', { r: 0, g: 0, b: 0, a: 128 / 255 }],
    ['rgba(125, 114, 80, 0.08)', { r: 125, g: 114, b: 80, a: 0.08 }],
    ['rgb(1 2 3 / 50%)', { r: 1, g: 2, b: 3, a: 0.5 }],
  ])('%s', (input, expected) => {
    expect(parseCssColor(input)).toEqual(expected)
  })

  it.each(['var(--color-surface, #fff)', 'linear-gradient(#fff, #000)', '', 'red'])(
    'не разбирает %s',
    (input) => {
      expect(parseCssColor(input)).toBeNull()
    },
  )
})

describe('compositeTintOverBase', () => {
  it('сводит полупрозрачный tint над белым в непрозрачный rgb', () => {
    // 125*0.08 + 255*0.92 = 244.6 → 245; 114 → 243.72 → 244; 80 → 241
    expect(compositeTintOverBase('rgba(125, 114, 80, 0.08)', '#ffffff')).toBe('rgb(245, 244, 241)')
  })

  it('null при полупрозрачной или неразобранной базе', () => {
    expect(compositeTintOverBase('rgba(0,0,0,0.1)', 'rgba(255,255,255,0.5)')).toBeNull()
    expect(compositeTintOverBase('rgba(0,0,0,0.1)', 'var(--color-surface, #fff)')).toBeNull()
    expect(compositeTintOverBase('var(--x)', '#fff')).toBeNull()
  })
})

describe('getOpaqueTintSurfaceStyle', () => {
  it('native: один непрозрачный цвет, без backgroundImage', () => {
    const style = getOpaqueTintSurfaceStyle('rgba(122, 157, 143, 0.06)', '#ffffff', 'ios')
    expect(style.backgroundImage).toBeUndefined()
    expect(alphaOf(style.backgroundColor)).toBe(1)
  })

  it('native: неразборчивый токен откатывается на surface, а не на прозрачный tint', () => {
    expect(getOpaqueTintSurfaceStyle('var(--tint)', '#2a2a2a', 'android')).toEqual({
      backgroundColor: '#2a2a2a',
    })
  })

  it('web: surface под градиентом tint (CSS-переменные не сводятся заранее)', () => {
    expect(getOpaqueTintSurfaceStyle('var(--t, rgba(0,0,0,.1))', 'var(--s, #fff)', 'web')).toEqual({
      backgroundColor: 'var(--s, #fff)',
      backgroundImage: 'linear-gradient(var(--t, rgba(0,0,0,.1)), var(--t, rgba(0,0,0,.1)))',
    })
  })
})

describe('#2900 — контролы над native-картой непрозрачны', () => {
  const originalOs = Platform.OS

  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'ios' })
  })

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => originalOs })
  })

  it.each([false, true])('dark=%s: гео-баннер, плашка качества и активная кнопка тулбара', (isDark) => {
    const colors = getThemedColors(isDark)
    // Предусловие дефекта: сами токены полупрозрачные.
    expect(alphaOf(colors.warningSoft)).toBeLessThan(1)
    expect(alphaOf(colors.primarySoft)).toBeLessThan(1)

    const mapStyles = getStyles(true, 59, colors)
    const banner = StyleSheet.flatten(mapStyles.geoBanner)
    const pill = StyleSheet.flatten(mapStyles.locationQualityPill)
    const activeButton = StyleSheet.flatten(getMapMobileTopOverlayStyles(colors).iconButtonActive)

    for (const style of [banner, pill, activeButton]) {
      expect(alphaOf(style.backgroundColor)).toBe(1)
    }
  })
})
