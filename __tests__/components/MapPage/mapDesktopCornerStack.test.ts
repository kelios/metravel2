/**
 * #2220 (MAP-DESKTOP-PILL-COLLAPSE-BUTTON-OVERLAP-001) — in the desktop branch
 * (width ≥ 768: web, iPad, Android tablets) the location-quality pill and the
 * panel's collapse chevron share the map's top-left corner. They live in
 * different subtrees (the pill in `mapArea`, the chevron in or beside the
 * panel), with no common flow, so the zones are checked by arithmetic on the
 * real `getStyles()` output — the phone-layout counterparts are
 * `mapGeoBannerStack.test.ts` (#1780) and `mapOfflineIndicatorStack.test.tsx`
 * (#1812). Before #2220 the pill sat at `left: 16` under the chevron, which
 * reaches 32 into the map: 15 px (web) / 16 pt (native) of overlap.
 */
import { Platform, StyleSheet } from 'react-native'

import { getThemedColors } from '@/hooks/useTheme'
import { getStyles } from '@/screens/tabs/map.styles'
import { DESKTOP_MAP_LEFT_COLUMN_TOP } from '@/screens/tabs/mapDesktopCorner'

type Rect = { left: number; top: number; right: number; bottom: number }

const themedColors = getThemedColors(true)
const originalOS = Platform.OS

const intersects = (a: Rect, b: Rect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

/** The chevron in map coordinates (origin: the map card's top-left corner). */
function chevronInMap(styles: any, panelWidth: number): Rect {
  const chevron = StyleSheet.flatten(styles.collapseToggleInPanel)
  const row = StyleSheet.flatten(styles.mapContainer)
  const gap = row.columnGap as number
  if (Platform.OS === 'web') {
    // A child of the panel, positioned against its padding box: the panel's
    // border sits between that box and the panel's outer edge.
    const border = (StyleSheet.flatten(styles.rightPanel).borderWidth as number) ?? 0
    const right = -(chevron.right as number) - border - gap
    return {
      left: right - (chevron.width as number),
      right,
      top: border + (chevron.top as number),
      bottom: border + (chevron.top as number) + (chevron.height as number),
    }
  }
  // Native: a sibling of the panel in the row, positioned against the row.
  const mapLeft = (row.paddingLeft as number) + panelWidth + gap
  const mapTop = row.paddingTop as number
  return {
    left: (chevron.left as number) - mapLeft,
    right: (chevron.left as number) + (chevron.width as number) - mapLeft,
    top: (chevron.top as number) - mapTop,
    bottom: (chevron.top as number) + (chevron.height as number) - mapTop,
  }
}

/** The pill at its widest: `maxWidth`, two lines of text (`numberOfLines={2}`). */
function pillInMap(styles: any): Rect {
  const pill = StyleSheet.flatten(styles.locationQualityPill)
  const text = StyleSheet.flatten(styles.locationQualityText)
  const height = 2 * (pill.paddingVertical as number) + 2 * (text.lineHeight as number)
  return {
    left: pill.left as number,
    right: (pill.left as number) + (pill.maxWidth as number),
    top: pill.top as number,
    bottom: (pill.top as number) + height,
  }
}

// Web: the stored panel widths of the two reference windows; native: 360 pt.
// The three pill states («Обновляем…», «Низкая точность…», «Давно не
// обновлялось») share one style (`MapCanvas.tsx`), only the text differs; the
// widest box above covers all three and every locale.
describe.each([
  ['web', [344, 384]],
  ['ios', [360]],
  ['android', [360]],
] as const)('%s desktop branch: the map\'s top-left corner (#2220)', (os, panelWidths) => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: os })
  })

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS })
  })

  it.each(panelWidths)('panel %i: the location-quality pill and the collapse chevron do not overlap', (panelWidth) => {
    const styles = getStyles(false, 0, themedColors)
    const chevron = chevronInMap(styles, os === 'web' ? panelWidth : (StyleSheet.flatten(styles.rightPanel).width as number))
    const pill = pillInMap(styles)

    // The chevron really reaches into the map: otherwise the check is vacuous.
    expect(chevron.right).toBeGreaterThan(0)
    expect(intersects(pill, chevron)).toBe(false)
    expect(pill.left - chevron.right).toBeGreaterThanOrEqual(8)
  })

  it('the pill stays in the chevron band, above the left control column', () => {
    const styles = getStyles(false, 0, themedColors)
    const pill = pillInMap(styles)
    const chevron = chevronInMap(styles, 360)

    expect(pill.top).toBeLessThan(chevron.bottom)
    expect(pill.bottom).toBeLessThanOrEqual(DESKTOP_MAP_LEFT_COLUMN_TOP)
  })
})
