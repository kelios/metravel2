import { Platform } from 'react-native';
import { type QuestColors, SPACING, QUEST_DESIGN } from './shared';

export const createHeaderStyles = (colors: QuestColors, isMobile: boolean, _screenW: number) => ({
    header: {
        backgroundColor: colors.surface,
        paddingHorizontal: isMobile ? SPACING.md : SPACING.lg,
        paddingTop: isMobile ? SPACING.xs : SPACING.sm,
        paddingBottom: isMobile ? SPACING.xs : SPACING.xs,
        borderBottomWidth: 0,
        ...Platform.select({
            web: {
                maxWidth: 1200,
                width: '100%',
                alignSelf: 'center',
                borderRadius: 0,
                boxShadow: '0 1px 0 0 rgba(0,0,0,0.03)',
            } as any,
        }),
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.xs,
        gap: SPACING.sm,
    },
    // На мобильном шапка складывается в две строки: мета-чипы (рейтинг/«пройден»)
    // сверху, ряд действий снизу. Без `flexWrap` обе строки (`flexBasis: 100%` +
    // `width: 100%`) дерутся за одну линию: мета схлопывается в нулевую ширину и
    // её чипы наезжают на кнопки, а хвост ряда уезжает за край экрана.
    headerRowMobile: {
        alignItems: 'center',
        marginBottom: 0,
        flexWrap: 'wrap',
    },
    headerIdentity: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    // Отдельная (первая) строка шапки: `flexBasis: 100%` занимает её целиком,
    // вертикальный отступ до ряда действий даёт `gap` родителя.
    headerIdentityMobile: {
        flexBasis: '100%',
        flexGrow: 0,
        flexShrink: 1,
        justifyContent: 'flex-end',
    },
    title: {
        fontSize: isMobile ? 17 : 20,
        fontWeight: '700',
        color: colors.text,
        flex: 1,
        letterSpacing: -0.3,
        lineHeight: isMobile ? 22 : 26,
    },
    titleMobile: {
        fontSize: 16,
        lineHeight: 20,
    },
    resetButton: {
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 0,
        backgroundColor: 'transparent',
        ...Platform.select({
            web: {
                cursor: 'pointer',
                transition: 'color 0.15s ease',
            } as any,
        }),
    },
    actionLabelButton: {
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: SPACING.sm,
        minHeight: 44,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.borderLight,
        backgroundColor: colors.backgroundSecondary,
        ...Platform.select({
            web: {
                cursor: 'pointer',
                transition: 'border-color 0.15s ease',
            } as any,
        }),
    },
    // Иконочный вариант тех же действий: 44dp по обеим осям (#1274).
    // Раньше здесь стояло 36/38 — и, поскольку стиль применяется ПОСЛЕ базового,
    // он перебивал `minHeight: 44` базового вниз, то есть иконочная кнопка была
    // недомерком, а подписанная — нет. hitSlop это не лечит: ряд шапки обтягивает
    // кнопку по высоте и срезает его.
    actionIconButton: {
        width: 44,
        minHeight: 44,
        height: 44,
        paddingHorizontal: 0,
        justifyContent: 'center',
    },
    actionLabelText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
    actionTooltip: {
        position: 'absolute',
        top: 42,
        alignSelf: 'center',
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: 6,
        backgroundColor: colors.text,
        color: colors.surface,
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '600',
        zIndex: 20,
        ...Platform.select({
            web: {
                whiteSpace: 'nowrap',
                boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
            } as any,
        }),
    },
    resetText: { color: colors.textMuted, fontWeight: '600', fontSize: 12 },
    exportHint: {
        color: colors.textMuted,
        fontSize: 12,
        lineHeight: 16,
        marginTop: 6,
    },
    toggleText: { color: colors.primaryDark, fontWeight: '600', fontSize: 14 },

    progressContainer: { marginBottom: SPACING.xs },
    // На мобильном счётчик заданий стоит В СТРОКУ с полосой прогресса, а не под
    // ней: своей строки он не стоит, а из ряда действий его пришлось убрать —
    // там он отнимал 77px и выдавливал первую иконку за левый край экрана.
    progressRowMobile: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    progressBarMobile: {
        flex: 1,
        marginBottom: 0,
    },
    progressBar: {
        height: 3,
        backgroundColor: colors.backgroundTertiary,
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 6,
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
        ...Platform.select({
            web: {
                backgroundImage: QUEST_DESIGN.stepActiveGradient,
                transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            } as any,
            default: { backgroundColor: colors.brand },
        }),
    },
    progressText: {
        fontSize: 11,
        color: colors.textMuted,
        textAlign: 'right',
        fontWeight: '700',
        letterSpacing: -0.1,
    },
    // Рядом с полосой текст перестаёт быть подписью под ней и читается как
    // значение: 11px на телефоне для этого мелковат.
    progressTextMobile: {
        fontSize: 12,
        lineHeight: 16,
        textAlign: 'right',
        flexShrink: 0,
    },

    headerActionRow: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        gap: SPACING.xs,
    },
    // Вторая строка шапки. `flexBasis: 100%` обязателен: без него базовый размер
    // берётся из `flex: 1` (basis 0), ряд остаётся на одной линии с мета-чипами,
    // схлопывается в нулевую ширину и его кнопки вылезают за край экрана.
    headerActionRowMobile: {
        width: '100%',
        flexBasis: '100%',
        flexGrow: 1,
        flexShrink: 0,
        // Явно возвращаем перенос базового `headerActionRow`: стоявший здесь
        // `nowrap` вместе с правым выравниванием переполнял ряд ВЛЕВО. На 375px
        // восемь контролов требовали ~399px при 343px ширины, и первая кнопка
        // уезжала за край экрана срезанной. Перенос — единственный способ не
        // потерять контрол: 44dp съезжать некуда, это минимум тач-таргета (#1274).
        flexWrap: 'wrap',
        // Зазор 3px вместо базовых `SPACING.xs`: с четырьмя семь кнопок по 44dp
        // требуют 332px при 328px ширины на 360px-экране (самый ходовой Android)
        // и срываются на вторую строку из-за четырёх пикселей. Ноль поставить
        // нельзя — соседние кружки слипаются в сплошную полосу.
        gap: 3,
        // Ряд занимает свою строку целиком, поэтому равняется по левому краю —
        // как заголовок, хлебные крошки и карточка шага. Правое выравнивание
        // досталось ему от десктопа, где он стоит в одной строке с заголовком, и
        // на телефоне давало рваный левый край. `space-between` тут не годится:
        // мобильная ветка тянется до 767px (`isMobile` = width <
        // `METRICS.breakpoints.tablet`), и на 667px распределение вставило бы
        // между иконками по 54px пустоты.
        justifyContent: 'flex-start',
    },
} as const);
