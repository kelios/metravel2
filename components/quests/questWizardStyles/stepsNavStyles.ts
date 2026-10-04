import { Platform } from 'react-native';
import { type QuestColors, SPACING } from './shared';

export const createStepsNavStyles = (colors: QuestColors, _isMobile: boolean, _screenW: number) => ({
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
        // Тач-таргет пилюли задаётся её собственной высотой (#1274); на телефоне
        // вместо ряда кружков — строки листа «Маршрут» по 44 pt (#2149).
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

    navHint: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 6,
        letterSpacing: -0.1,
    },
} as const);
