import { Platform } from 'react-native';
import { type QuestColors, SPACING } from './shared';

/**
 * Ряд действий боковой панели: шрифт −/+, печать, GPX, «открыть в приложении»,
 * офлайн-загрузка и сброс. Семь кружков по 44dp — минимум тач-таргета (#1274),
 * ужимать их нельзя.
 */
export const COMPACT_SIDEBAR_ACTION_COUNT = 7;
export const COMPACT_SIDEBAR_ACTION_SIZE = 44;
/**
 * Правая граница панели входит в её ширину (`box-sizing: border-box`), поэтому
 * попадает в формулу наравне с отступами: без неё контента оказывалось 331px
 * против нужных 332px, и седьмая кнопка срывалась на вторую строку из-за
 * одного пикселя.
 */
export const COMPACT_SIDEBAR_BORDER_WIDTH = 1;
/**
 * Ширина панели считается из ряда действий, а не наоборот. На прежних 300px
 * контент был 284px против необходимых 332px, и ряд срывался на вторую строку:
 * пять кнопок сверху, две снизу. Ширина, выведенная формулой, не разъедется при
 * добавлении кнопки — её держит `questCompactSidebarActionRow.test.ts`.
 */
export const COMPACT_SIDEBAR_WIDTH =
    SPACING.sm * 2 +
    COMPACT_SIDEBAR_BORDER_WIDTH +
    COMPACT_SIDEBAR_ACTION_COUNT * COMPACT_SIDEBAR_ACTION_SIZE +
    (COMPACT_SIDEBAR_ACTION_COUNT - 1) * SPACING.xs;

export const createShellStyles = (colors: QuestColors, isMobile: boolean, _screenW: number) => ({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },

    compactShell: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: colors.background,
        ...Platform.select({
            web: {
                maxWidth: 1400,
                width: '100%',
                alignSelf: 'center',
            } as any,
        }),
    },
    compactSidebar: {
        width: COMPACT_SIDEBAR_WIDTH,
        flexShrink: 0,
        backgroundColor: colors.surface,
        borderRightWidth: COMPACT_SIDEBAR_BORDER_WIDTH,
        borderRightColor: colors.borderLight,
        paddingHorizontal: SPACING.sm,
        paddingTop: SPACING.sm,
        paddingBottom: SPACING.sm,
    },
    compactSidebarHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: SPACING.xs,
        marginBottom: SPACING.sm,
    },
    compactSidebarActions: {
        flexBasis: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: SPACING.xs,
    },
    compactSidebarTitle: {
        flex: 1,
        fontSize: 17,
        fontWeight: '700',
        color: colors.text,
        lineHeight: 22,
        letterSpacing: -0.2,
    },
    compactStepsList: {
        flex: 1,
        marginTop: SPACING.sm,
    },
    compactStepsListContent: {
        paddingRight: 2,
        paddingBottom: SPACING.md,
    },
    compactStepPill: {
        width: '100%',
        maxWidth: '100%',
        marginRight: 0,
        marginBottom: 8,
        borderRadius: 12,
        minHeight: 44,
    },
    compactExcursionsSection: {
        marginTop: SPACING.md,
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    compactExcursionsHeader: {
        marginBottom: SPACING.sm,
    },

    content: { flex: 1, padding: isMobile ? SPACING.md : SPACING.lg },
    compactMainContent: {
        paddingTop: SPACING.md,
    },
    contentInner: { maxWidth: 1160, alignSelf: 'center', width: '100%' },
    desktopRow: { flexDirection: 'row', gap: SPACING.lg },
    desktopMain: { flex: 1, minWidth: 0 },
    desktopSide: { width: 400, flexShrink: 0 },
    compactDesktopSide: { width: 340, flexShrink: 0 },
} as const);
