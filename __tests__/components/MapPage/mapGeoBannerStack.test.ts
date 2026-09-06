/**
 * #1780 — регрессия на две жалобы с iPhone 16 Pro (TestFlight 1.0.5 (8)):
 *  1) баннер «Последнее известное место» наезжал на верхний ряд круглых кнопок;
 *  2) маркер «вы здесь» не отличался от POI-пинов.
 *
 * Ряд кнопок живёт в overlay-слое (MapMobileTopOverlay, zIndex 1500), а баннер —
 * в слое карты (MapCanvas, zIndex 1010, absolute `top`): общего вертикального
 * потока у них нет, поэтому непересечение зон проверяется арифметикой, а не
 * рендером. Раньше высота ряда была продублирована хардкодом в map.styles.ts
 * (54 при реальных 51) и зазор составлял 3 pt.
 */
import { StyleSheet } from 'react-native'

import {
  getMapToolbarBottom,
  getMapToolbarPaddingTop,
  MAP_TOOLBAR_STACK_GAP,
  MAP_TOOLBAR_TOUCH_TARGET_SIZE,
} from '@/components/MapPage/MapMobile/MapMobileTopOverlay.styles'
import {
  buildBirdMarkerHtml,
  buildUserLocationHtml,
  USER_LOCATION_MARKER_COLOR,
  USER_LOCATION_MARKER_SIZE,
} from '@/components/MapPage/Map/mapMarkerStyles'
import { getStyles } from '@/screens/tabs/map.styles'
import { getThemedColors } from '@/hooks/useTheme'

/** Реальные safe-area top: web/0, старые Android, iPhone SE/13 mini/16 Pro. */
const TOP_INSETS = [0, 8, 20, 24, 44, 47, 50, 54, 59, 62]

const themedColors = getThemedColors(false)

const bannerTopFor = (insetTop: number) => {
  const flat = StyleSheet.flatten(getStyles(true, insetTop, themedColors).geoBanner)
  return flat?.top as number
}

describe('#1780 — гео-баннер не пересекается с верхним рядом кнопок карты', () => {
  it.each(TOP_INSETS)('safe-area top = %ipt: баннер начинается ниже ряда кнопок', (insetTop) => {
    const toolbarBottom = getMapToolbarBottom(insetTop)

    expect(bannerTopFor(insetTop)).toBeGreaterThanOrEqual(toolbarBottom + MAP_TOOLBAR_STACK_GAP)
  })

  it('высота ряда кнопок объявлена один раз и совпадает с тач-таргетом', () => {
    TOP_INSETS.forEach((insetTop) => {
      expect(getMapToolbarBottom(insetTop) - getMapToolbarPaddingTop(insetTop)).toBe(
        MAP_TOOLBAR_TOUCH_TARGET_SIZE,
      )
    })
  })

  it('на десктопе баннер прижат к низу и вертикаль тулбара его не касается', () => {
    const flat = StyleSheet.flatten(getStyles(false, 44, themedColors).geoBanner)

    expect(flat?.top).toBeUndefined()
    expect(flat?.bottom).toBe(20)
  })

  it('на мобиле статус и действия разнесены по строкам, крестик выведен из потока', () => {
    const styles = getStyles(true, 47, themedColors)

    expect(StyleSheet.flatten(styles.geoBanner)?.flexDirection).toBe('column')
    // Крестик в потоке стал бы третьей строкой; место под него держит статус.
    expect(StyleSheet.flatten(styles.geoBannerClose)?.position).toBe('absolute')
    expect(
      StyleSheet.flatten(styles.geoBannerMain)?.paddingRight as number,
    ).toBeGreaterThanOrEqual(StyleSheet.flatten(styles.geoBannerCloseShape)?.width as number)
  })

  // Крестик абсолютный, поэтому высоту баннера он не держит: в состоянии без
  // ряда действий строка статуса ~15dp, и без пола высоты 44dp тач-таргет с
  // видимым кружком вылезал бы за нижний край плашки прямо на карту.
  it('на мобиле баннер вмещает абсолютный крестик даже без ряда действий', () => {
    const styles = getStyles(true, 47, themedColors)
    const banner = StyleSheet.flatten(styles.geoBanner)
    const close = StyleSheet.flatten(styles.geoBannerClose)

    expect(banner?.minHeight as number).toBeGreaterThanOrEqual(
      (close?.height as number) + (banner?.paddingVertical as number) * 2,
    )
  })

  it('на десктопе баннер остаётся однострочным', () => {
    expect(StyleSheet.flatten(getStyles(false, 0, themedColors).geoBanner)?.flexDirection).toBe(
      'row',
    )
  })
})

describe('#1780 — маркер «вы здесь» отличим от POI', () => {
  const userHtml = buildUserLocationHtml()
  const birdHtml = buildBirdMarkerHtml()

  const hexes = (html: string) =>
    new Set((html.toLowerCase().match(/#[0-9a-f]{6}\b/g) ?? []).filter((hex) => hex !== '#ffffff'))

  it('не делит ни одного цвета с бренд-пином POI', () => {
    const birdColors = hexes(birdHtml)
    const userColors = hexes(userHtml)

    expect(birdColors.size).toBeGreaterThan(0)
    expect(userColors.size).toBeGreaterThan(0)
    expect([...userColors].filter((hex) => birdColors.has(hex))).toEqual([])
  })

  it('красится собственным цветом GPS-точки', () => {
    expect(userHtml.toLowerCase()).toContain(USER_LOCATION_MARKER_COLOR.toLowerCase())
  })

  it('не несёт логотип-птицу: у маркера нет SVG', () => {
    expect(birdHtml).toContain('<svg')
    expect(userHtml).not.toContain('<svg')
  })

  it('имеет белое кольцо и пульс — форма читается как «я», а не как объект', () => {
    expect(userHtml).toMatch(/border:\s*4px solid #ffffff/i)
    expect(userHtml).toContain('metravelUserPulse')
  })

  it('заметно крупнее прежних 30px и укладывается в свой divIcon', () => {
    expect(USER_LOCATION_MARKER_SIZE).toBeGreaterThan(30)
    expect(userHtml).toContain(`width: ${USER_LOCATION_MARKER_SIZE}px`)
  })
})

describe('#1780 — пилюля качества геолокации читает тот же источник вертикали', () => {
  it.each(TOP_INSETS)('safe-area top = %ipt: пилюля ниже ряда кнопок', (insetTop) => {
    const flat = StyleSheet.flatten(getStyles(true, insetTop, themedColors).locationQualityPill)

    expect(flat?.top as number).toBeGreaterThan(getMapToolbarBottom(insetTop))
  })

  it('позиция не изменилась при переходе на общий источник (прежние insetTop+92)', () => {
    TOP_INSETS.forEach((insetTop) => {
      const flat = StyleSheet.flatten(getStyles(true, insetTop, themedColors).locationQualityPill)

      expect(flat?.top).toBe(Math.max(insetTop, 8) + 92)
    })
  })
})
