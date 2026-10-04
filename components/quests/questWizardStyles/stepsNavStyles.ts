import { Platform } from 'react-native';
import { type QuestColors, SPACING } from './shared';

export const createStepsNavStyles = (colors: QuestColors, isMobile: boolean, _screenW: number) => ({
    stepsNavigation: {
        flexDirection: 'row',
        marginTop: SPACING.xs,
        marginBottom: SPACING.xs,
        // Затухание у краёв рисует EdgeFadeScrollRow и только с той стороны, где
        // есть куда прокручивать: статическая маска гасила первый шаг даже
        // тогда, когда лента помещалась целиком (#1672).
        ...Platform.select({
            web: {
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
            } as any,
        }),
    },
    stepsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: SPACING.xs,
        gap: 5,
        marginBottom: SPACING.xs,
    },

    // #2146: цвет, контур и значок состояния точки — только из
    // `resolveQuestStepVisualState` (`components/quests/questStepVisualState.ts`),
    // одинаково на web, Android и iPhone. Здесь — геометрия.
    stepPill: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        paddingVertical: 5,
        paddingHorizontal: 10,
        maxWidth: 140,
        marginRight: 0,
        marginBottom: 0,
        // Широкоэкранный вариант того же шагового навигатора, что и `stepDotTarget`
        // на мобильном: тач-таргет задаётся высотой самой пилюли (#1274).
        minHeight: 44,
        ...Platform.select({
            web: {
                cursor: 'pointer',
                transition: 'all 0.2s ease',
            } as any,
        }),
    },
    stepPillNarrow: { maxWidth: 120, paddingHorizontal: 8 },
    // Наведение мыши на доступный шаг — состояние `hovered` у Pressable
    // (`QuestStepPill`): ключ-псевдокласс в стиле react-native-web компилирует
    // в битое правило (#2036). Активный шаг держит свой `scale` — он ниже в массиве.
    stepPillHovered: {
        transform: [{ translateY: -1 }],
    },
    stepPillActive: {
        transform: [{ scale: 1.04 }],
    },
    stepPillGlyph: {
        marginRight: 5,
        minWidth: 12,
        alignItems: 'center',
    },
    stepPillIndex: {
        fontSize: 11,
        fontWeight: '700',
    },
    stepPillTitle: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.text,
        flexShrink: 1,
        letterSpacing: -0.2,
    },

    // Прозрачная рамка тач-таргета вокруг видимой точки (#1274).
    // Нажимается именно она, поэтому размер задан ей, а не точке: раньше
    // Pressable был размером с точку (26dp), а её ряд — ровно такой же высоты,
    // так что вертикальный hitSlop срезался целиком и добора не давал.
    // Тот же приём, что `MAP_TOOLBAR_TOUCH_TARGET_SIZE` на тулбаре карты.
    stepDotTarget: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            web: { cursor: 'pointer' },
        }),
    },
    // Видимый кружок: размер сохранён прежний, менять его задача не просила.
    stepDotMini: {
        width: isMobile ? 26 : 32,
        height: isMobile ? 26 : 32,
        borderRadius: isMobile ? 13 : 16,
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            web: {
                cursor: 'pointer',
                transition: 'all 0.2s ease',
            } as any,
        }),
    },
    stepDotMiniActive: {
        transform: [{ scale: 1.15 }],
    },
    stepDotMiniText: { fontSize: isMobile ? 10 : 12, fontWeight: '700' },

    navActiveTitle: {
        marginTop: 6,
        marginBottom: isMobile ? SPACING.xs : 0,
        fontSize: 13,
        fontWeight: '700',
        color: colors.text,
        letterSpacing: -0.3,
    },
    navHint: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 6,
        letterSpacing: -0.1,
    },
} as const);
