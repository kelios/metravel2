import { Platform } from 'react-native';
import { type QuestColors, SPACING } from './shared';

export const createExcursionsStyles = (colors: QuestColors, isMobile: boolean, screenW: number) => ({
    pageRow: {
        flexDirection: 'row',
        gap: SPACING.lg,
        alignItems: 'flex-start',
    },
    pageMain: {
        flex: 1,
        minWidth: 0,
    },
    excursionsSidebar: {
        width: 300,
        flexShrink: 0,
        ...Platform.select({
            web: {
                position: 'sticky' as any,
                top: SPACING.md,
                alignSelf: 'flex-start' as const,
            },
        }),
    },
    excursionsSidebarInner: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: SPACING.lg,
        borderWidth: 0,
        ...Platform.select({
            web: {
                boxShadow: '0 4px 20px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)',
            } as any,
            default: colors.shadows.light,
        }),
    },
    excursionsSidebarWidget: {
        marginTop: SPACING.sm,
    },

    excursionsSection: {
        marginTop: SPACING.xl,
    },
    excursionsDivider: {
        height: 1,
        backgroundColor: colors.borderLight,
        marginBottom: SPACING.lg,
    },
    excursionsHeader: {
        marginBottom: SPACING.md,
    },
    excursionsCard: {
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: SPACING.lg,
        borderWidth: 0,
        ...Platform.select({
            web: {
                boxShadow: '0 4px 20px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.03)',
            } as any,
            default: colors.shadows.light,
        }),
    },
    excursionsTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: colors.text,
        marginBottom: 4,
        letterSpacing: -0.4,
    },
    excursionsSubtitle: {
        fontSize: 13,
        color: colors.textMuted,
        letterSpacing: -0.1,
    },

    completionScreen: {
        backgroundColor: colors.surface,
        borderRadius: isMobile ? 14 : 16,
        padding: isMobile ? SPACING.md : SPACING.lg,
        alignItems: 'center',
        marginTop: isMobile ? SPACING.xs : SPACING.md,
        borderWidth: 0,
        ...Platform.select({
            web: {
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            } as any,
        }),
    },
    completionTitle: {
        fontSize: isMobile ? 22 : 28,
        fontWeight: '800',
        color: colors.success,
        marginBottom: isMobile ? SPACING.sm : SPACING.md,
        textAlign: 'center',
        letterSpacing: -0.6,
    },
    completionText: {
        paddingTop: 4,
        fontSize: isMobile ? 15 : 17,
        color: colors.text,
        textAlign: 'center',
        lineHeight: isMobile ? 23 : 26,
        marginBottom: isMobile ? SPACING.lg : SPACING.xl,
        maxWidth: isMobile ? screenW - 64 : 480,
    },
} as const);
