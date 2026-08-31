/**
 * Ряд действий боковой панели квеста на десктопе обязан помещаться в одну строку.
 *
 * Дефект, ради которого гард написан: панель была шириной 300px, а семь
 * иконочных контролов по 44dp (шрифт −/+, печать, GPX, «открыть в приложении»,
 * офлайн-загрузка, сброс) с зазорами требуют 332px при 284px контента. Ряд
 * срывался на вторую строку — пять кружков сверху, два снизу, — и панель
 * выглядела сломанной. Ужать кнопки нельзя: 44dp это минимум тач-таргета
 * (#1274), его держит `questWizardTouchTargets.test.tsx`.
 *
 * Гард держит арифметику, а не конкретное число пикселей: любая ширина панели,
 * проходящая проверку, ряд не ломает.
 */
import { StyleSheet } from 'react-native'

import { createQuestWizardStyles } from '@/components/quests/questWizardStyles'
import {
    COMPACT_SIDEBAR_ACTION_COUNT,
    COMPACT_SIDEBAR_ACTION_SIZE,
} from '@/components/quests/questWizardStyles/shellStyles'
import { getThemedColors } from '@/constants/designSystem'

/** Нижняя граница компактной десктопной раскладки: `width >= 1280` в `useQuestWizardResponsiveModel`. */
const COMPACT_DESKTOP_WIDTH = 1280

const colors = getThemedColors(false) as any
const styles = createQuestWizardStyles(colors, false, COMPACT_DESKTOP_WIDTH)
const flat = (style: unknown) => StyleSheet.flatten(style as any) as any

const sidebar = flat(styles.compactSidebar)
const row = flat(styles.compactSidebarActions)

describe('боковая панель квеста — ряд действий на десктопе', () => {
    it('вмещает все контролы в одну строку', () => {
        // Граница входит в ширину панели (`box-sizing: border-box`), поэтому
        // вычитается наравне с отступами — из-за неё ряд когда-то не влезал
        // ровно на один пиксель.
        const contentWidth =
            sidebar.width - 2 * sidebar.paddingHorizontal - (sidebar.borderRightWidth ?? 0)
        const required =
            COMPACT_SIDEBAR_ACTION_COUNT * COMPACT_SIDEBAR_ACTION_SIZE +
            (COMPACT_SIDEBAR_ACTION_COUNT - 1) * (row.gap ?? 0)

        expect(required).toBeLessThanOrEqual(contentWidth)
    })

    it('оставляет перенос страховкой, а не рабочим режимом', () => {
        expect(row.flexWrap).not.toBe('nowrap')
    })
})
