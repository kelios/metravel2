/**
 * #2304 recheck (iPad, «Фильтры», stale location, no «Искать в этой области»):
 * the desktop-branch location-quality pill drew as a 45×32 icon chip — the
 * message was 0 wide, absent on screen and in the accessibility tree. The text
 * composed `locationQualityText` (`flex: 1`) with a longhand override
 * (`flexGrow: 0, flexBasis: 'auto'`); web honours the longhands, native Yoga
 * takes basis 0 for `flex > 0` and an explicit 'auto' — see
 * `__tests__/helpers/flexItemResolution.ts`. A node-presence check passed while
 * the text was invisible, so this test asserts the text's WIDTH per engine:
 * expanded (no action in the band) the message keeps its content width, shrunk
 * only by the room the band leaves — at every desktop-branch width.
 */
import { Platform, StyleSheet } from 'react-native'

import { getThemedColors } from '@/hooks/useTheme'
import { getStyles } from '@/screens/tabs/map.styles'
import { MAP_PANEL_GAP } from '@/screens/tabs/mapDesktopCorner'
import { flexItemMainSize, resolveFlexFactors, type FlexEngine } from '../../helpers/flexItemResolution'

const themedColors = getThemedColors(true)
const originalOS = Platform.OS
const ICON = 13

afterAll(() => {
  Object.defineProperty(Platform, 'OS', { value: originalOS })
})

/** Width of the message inside the expanded pill, laid out as `engine` does. */
function messageWidth(styles: any, engine: FlexEngine, bandWidth: number, content: number) {
  const pill = StyleSheet.flatten(styles.desktopBandQualityPill)
  const text = StyleSheet.flatten(styles.locationQualityText)
  const chrome = 2 * pill.paddingHorizontal + ICON + pill.gap + 2 * (pill.borderWidth ?? 0)
  // The pill: content width, shrinks (minWidth 0) to the band, capped by maxWidth.
  const pillWidth = Math.min(chrome + content, pill.maxWidth, bandWidth)
  const factors = resolveFlexFactors(text, engine, engine === 'native' ? 0 : 1)
  return { width: flexItemMainSize(factors, content, pillWidth - chrome), room: pillWidth - chrome }
}

// The mechanism itself: the old composition is 0 wide on native, full on web.
it('witness: `flex: 1` overridden by longhands collapses on native only', () => {
  const old = { flex: 1, flexGrow: 0, flexShrink: 1, flexBasis: 'auto' }
  expect(flexItemMainSize(resolveFlexFactors(old, 'native', 0), 230, 300)).toBe(0)
  expect(flexItemMainSize(resolveFlexFactors(old, 'web', 1), 230, 300)).toBe(230)
})

const cases: Array<[string, FlexEngine, number, number]> = []
for (const width of [768, 820, 1024, 1180, 1440]) {
  cases.push(['ios', 'native', width, 360])
  cases.push(['android', 'native', width, 360])
  for (const panel of [344, 384]) cases.push(['web', 'web', width, panel])
}

it.each(cases)('%s (%s) %i px, panel %i: the expanded pill shows its message', (os, engine, width, panel) => {
  Object.defineProperty(Platform, 'OS', { value: os })
  const styles: any = getStyles(false, 0, themedColors, false, { left: 0, right: 0 })
  const row = StyleSheet.flatten(styles.mapContainer)
  const band = StyleSheet.flatten(styles.desktopSearchAreaBand)
  const panelWidth = os === 'web' ? panel : StyleSheet.flatten(styles.rightPanel).width
  const mapWidth = width - row.paddingLeft - row.paddingRight - panelWidth - MAP_PANEL_GAP
  const bandWidth = mapWidth - band.left - band.right

  // The text carries no `flex` shorthand: both engines read the same factors.
  expect(StyleSheet.flatten(styles.locationQualityText).flex).toBeUndefined()
  // Short (EN «Updating…»), RU «Местоположение давно не обновлялось», a long locale.
  for (const content of [60, 230, 600]) {
    const { width: text, room } = messageWidth(styles, engine, bandWidth, content)
    expect(room).toBeGreaterThan(0)
    expect(text).toBe(Math.min(content, room))
  }
})

it('the phone pill text sizes to its content and wraps', () => {
  Object.defineProperty(Platform, 'OS', { value: 'ios' })
  const styles: any = getStyles(true, 0, themedColors)
  const factors = resolveFlexFactors(StyleSheet.flatten(styles.locationQualityText), 'native', 0)
  expect(flexItemMainSize(factors, 230, 300)).toBe(230)
  expect(flexItemMainSize(factors, 600, 300)).toBe(300)
})
