import { Platform } from 'react-native';
import { type QuestColors, SPACING } from './shared';

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
        width: 300,
        flexShrink: 0,
        backgroundColor: colors.surface,
        borderRightWidth: 1,
        borderRightColor: colors.borderLight,
        paddingHorizontal: SPACING.sm,
        paddingTop: SPACING.sm,
        paddingBottom: SPACING.sm,
    },
    compactSidebarHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACING.xs,
        marginBottom: SPACING.sm,
    },
    compactSidebarActions: {
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
