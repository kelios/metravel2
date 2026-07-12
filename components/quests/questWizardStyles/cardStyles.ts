import { Platform } from 'react-native';
import { type QuestColors, SPACING, QUEST_DESIGN } from './shared';

export const createCardStyles = (colors: QuestColors, isMobile: boolean, _screenW: number, fontScale = 1) => ({
    card: {
        backgroundColor: colors.surface,
        borderRadius: isMobile ? 14 : 16,
        padding: isMobile ? SPACING.md : SPACING.lg,
        marginBottom: SPACING.md,
        borderWidth: 0,
        ...Platform.select({
            web: {
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                transition: 'all 0.2s ease',
            } as any,
            android: { elevation: 2 },
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06,
                shadowRadius: 6,
            },
        }),
        backfaceVisibility: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: isMobile ? SPACING.md : SPACING.lg,
        gap: isMobile ? SPACING.sm : SPACING.md,
    },
    stepNumber: {
        width: isMobile ? 38 : 44,
        height: isMobile ? 38 : 44,
        borderRadius: isMobile ? 11 : 14,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...Platform.select({
            web: {
                backgroundImage: 'linear-gradient(135deg, rgba(245, 132, 44, 0.12) 0%, rgba(224, 112, 32, 0.08) 100%)',
            } as any,
            default: { backgroundColor: colors.brandSoft },
        }),
    },
    stepNumberCompleted: {
        ...Platform.select({
            web: {
                backgroundImage: 'linear-gradient(135deg, rgba(82, 125, 102, 0.15) 0%, rgba(66, 109, 86, 0.1) 100%)',
            } as any,
            default: { backgroundColor: colors.successSoft },
        }),
    },
    stepNumberText: { fontSize: isMobile ? 14 : 17, fontWeight: '800', color: colors.brandText },
    headerContent: { flex: 1 },
    stepTitle: {
        fontSize: Math.round((isMobile ? 17 : 20) * fontScale),
        fontWeight: '800',
        color: colors.text,
        marginBottom: 4,
        letterSpacing: -0.4,
        lineHeight: Math.round((isMobile ? 23 : 26) * fontScale),
    },
    location: {
        fontSize: 14,
        color: colors.brandText,
        fontWeight: '600',
        ...Platform.select({
            web: {
                cursor: 'pointer',
                transition: 'color 0.2s ease',
            } as any,
        }),
    },
    completedBadge: {
        borderRadius: 10,
        width: isMobile ? 32 : 36,
        height: isMobile ? 32 : 36,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...Platform.select({
            web: {
                backgroundImage: 'linear-gradient(135deg, rgba(82, 125, 102, 0.2) 0%, rgba(66, 109, 86, 0.15) 100%)',
            } as any,
            default: { backgroundColor: colors.successSoft },
        }),
    },
    completedText: { color: colors.success, fontWeight: '800', fontSize: 16 },

    section: { marginBottom: isMobile ? SPACING.md : SPACING.lg },
    sectionTitle: {
        fontSize: QUEST_DESIGN.sectionTitleSize,
        fontWeight: '700',
        color: colors.textMuted,
        marginBottom: SPACING.sm,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
    },
    storyText: {
        fontSize: Math.round((isMobile ? 14 : QUEST_DESIGN.bodySize) * fontScale),
        lineHeight: Math.round((isMobile ? 22 : 24) * fontScale),
        color: colors.text,
        letterSpacing: -0.1,
    },
} as const);
