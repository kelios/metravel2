/**
 * NATIVE-TEXT-ROW-001 (#2079, structural control #1344): ряд «Навигация / ▼ /
 * координаты / Фото» в карточке шага квеста — wrap-ряд, где у чипа координат
 * не было sizing-контракта. На Pixel (font_scale 1.15) Yoga мерил
 * «53.2229, 26.6925» одной строкой на собственной ширине, а Android рисовал с
 * переносом — долгота срезалась высотой чипа. `guard:text-row-sizing` такой
 * случай не видит: `Text` вложен в `Pressable`.
 *
 * Контракт: чип координат — единственный positive-flex выход ряда, а
 * `minWidth` не даёт ему сжаться до столбика (не влез — переносится целиком).
 */
import { StyleSheet } from 'react-native'

import { createQuestWizardStyles } from '@/components/quests/questWizardStyles'
import { getThemedColors } from '@/constants/designSystem'

const colors = getThemedColors(false) as any

const ROW_SIBLINGS = ['navButton', 'navToggle', 'photoToggle'] as const

describe('карточка шага квеста — чип координат в ряду навигации', () => {
  for (const [surface, isMobile, width] of [
    ['mobile-320', true, 320],
    ['mobile-390', true, 390],
    ['desktop', false, 1280],
  ] as const) {
    it(`${surface}: чип координат — единственный positive-flex выход ряда`, () => {
      const styles = createQuestWizardStyles(colors, isMobile, width) as any
      const row = StyleSheet.flatten(styles.navRow) as any
      const chip = StyleSheet.flatten(styles.coordsButton) as any

      expect(row.flexDirection).toBe('row')
      expect(row.flexWrap).toBe('wrap')
      expect(chip.flex).toBe(1)
      expect(chip.minWidth).toBeGreaterThanOrEqual(128)

      for (const key of ROW_SIBLINGS) {
        const sibling = StyleSheet.flatten(styles[key]) as any
        expect({ key, flex: sibling.flex ?? 0 }).toEqual({ key, flex: 0 })
      }
    })
  }
})
