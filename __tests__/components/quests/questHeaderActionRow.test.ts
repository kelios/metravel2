/**
 * Ряд действий шапки квеста на телефоне: он обязан вместить все контролы, не
 * срезав их краем экрана и не расползшись по всей ширине строки.
 *
 * Дефект, ради которого гард написан: `headerActionRowMobile` стоял с
 * `flexWrap: 'nowrap'` поверх правого выравнивания базового `headerActionRow`.
 * Семь иконочных контролов по 44dp (меньше/больше шрифт, печать, GPX, «открыть
 * в приложении», офлайн-загрузка, сброс) шире доступного контента на 320–375px,
 * и переполнение при правом выравнивании уходит ВЛЕВО — первая кнопка
 * оказывалась за краем экрана. Ужать кнопки нельзя: 44dp это минимум
 * тач-таргета (#1274), его держит `questWizardTouchTargets.test.tsx`.
 *
 * Гард держит арифметику, а не конкретные значения свойств: любой набор стилей,
 * проходящий все три проверки, шапку не ломает.
 *
 * #1669 сократил видимый ряд до четырёх контролов: редкие действия (печать,
 * GPX, «открыть в приложении», сброс) переехали в лист «Ещё». Арифметика та же,
 * но считать её по семи кнопкам больше нельзя — это держало бы `gap` ряда на
 * 3px ради состава, которого на телефоне уже нет.
 */
import { StyleSheet } from 'react-native'

import { SPACING } from '@/components/quests/questWizardStyles/shared'
import { createQuestWizardStyles } from '@/components/quests/questWizardStyles'
import { METRICS } from '@/constants/layout'
import { getThemedColors } from '@/constants/designSystem'

/**
 * Контролы видимого ряда на телефоне: меньше/больше шрифт, офлайн-загрузка и
 * «Ещё» (`QuestHeaderPanel`, ветка `isMobile`). Число обязано меняться вместе с
 * составом этой ветки — на нём держится вся арифметика ниже.
 */
const CONTROL_COUNT = 4
const CONTROL_SIZE = 44
/** Самый ходовой Android: на нём ряд обязан оставаться однострочным. */
const COMMON_ANDROID_WIDTH = 360
/** Верх мобильной ветки: `isMobile` в `useResponsive` — это width < tablet. */
const WIDEST_MOBILE_WIDTH = METRICS.breakpoints.tablet - 1
/**
 * Промежуток между иконками, после которого ряд перестаёт читаться как группа.
 * Нужен, потому что распределяющее выравнивание раздаёт свободное место поровну
 * и на широком конце мобильной ветки открывает между кнопками десятки пикселей.
 */
const MAX_ICON_SPACING = SPACING.lg

const colors = getThemedColors(false) as any
const styles = createQuestWizardStyles(colors, true, COMMON_ANDROID_WIDTH)
const flat = (style: unknown) => StyleSheet.flatten(style as any) as any

const header = flat(styles.header)
const row = flat([styles.headerActionRow, styles.headerActionRowMobile])
const rowGap: number = row.gap ?? 0
const contentWidth = (screenW: number) => screenW - 2 * header.paddingHorizontal

describe('шапка квеста — ряд действий на телефоне', () => {
  it('переносит контролы, а не срезает их краем экрана', () => {
    expect(row.flexWrap).not.toBe('nowrap')
  })

  it('вмещает все контролы в одну строку на 360px', () => {
    const required = CONTROL_COUNT * CONTROL_SIZE + (CONTROL_COUNT - 1) * rowGap

    expect(required).toBeLessThanOrEqual(contentWidth(COMMON_ANDROID_WIDTH))
  })

  it('не раздаёт свободное место между кнопками на верхней границе мобильной ветки', () => {
    const distributes = ['space-between', 'space-around', 'space-evenly'].includes(row.justifyContent)
    const freeSpace = contentWidth(WIDEST_MOBILE_WIDTH) - CONTROL_COUNT * CONTROL_SIZE
    const spacing = distributes ? freeSpace / (CONTROL_COUNT - 1) : rowGap

    expect(spacing).toBeLessThanOrEqual(MAX_ICON_SPACING)
  })
})
