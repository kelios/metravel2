import { Platform } from 'react-native';
import { type QuestColors, SPACING, QUEST_DESIGN } from './shared';

export const createStepsNavStyles = (colors: QuestColors, isMobile: boolean, _screenW: number) => ({
    stepsNavigation: {
        flexDirection: 'row',
        marginTop: SPACING.xs,
        marginBottom: SPACING.xs,
        ...Platform.select({
            web: {
                maskImage: 'linear-gradient(to right, transparent 0, black 12px, black calc(100% - 32px), transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to right, transparent 0, black 12px, black calc(100% - 32px), transparent 100%)',
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

    stepPill: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        paddingVertical: 5,
        paddingHorizontal: 10,
        backgroundColor: colors.backgroundSecondary,
        maxWidth: 140,
        marginRight: 0,
        marginBottom: 0,
        borderWidth: 0,
        minHeight: 28,
        ...Platform.select({
            web: {
                cursor: 'pointer',
                transition: 'all 0.2s ease',
            } as any,
        }),
    },
    stepPillNarrow: { maxWidth: 120, paddingHorizontal: 8 },
    stepPillUnlocked: {
        backgroundColor: colors.backgroundSecondary,
        ...Platform.select({
            web: {
                ':hover': { transform: 'translateY(-1px)' },
            } as any,
        }),
    },
    stepPillActive: {
        backgroundColor: colors.brand,
        ...Platform.select({
            web: {
                backgroundImage: QUEST_DESIGN.stepActiveGradient,
                boxShadow: '0 2px 10px rgba(245, 132, 44, 0.35)',
                transform: 'scale(1.04)',
            } as any,
        }),
    },
    stepPillDone: {
        backgroundColor: colors.successSoft,
        ...Platform.select({
            web: {
                backgroundImage: 'linear-gradient(135deg, rgba(82, 125, 102, 0.12) 0%, rgba(66, 109, 86, 0.08) 100%)',
            } as any,
        }),
    },
    stepPillLocked: { opacity: 0.72 },
    stepPillIndex: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.brandText,
        marginRight: 5,
        minWidth: 12,
    },
    stepPillTitle: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.text,
        flexShrink: 1,
        letterSpacing: -0.2,
    },

    stepDotMini: {
        width: isMobile ? 26 : 32,
        height: isMobile ? 26 : 32,
        borderRadius: isMobile ? 13 : 16,
        marginRight: isMobile ? 3 : 5,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 0,
        // Touch area extended via hitSlop in QuestStepDot component
        ...Platform.select({
            web: {
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            } as any,
        }),
    },
    stepDotMiniUnlocked: { opacity: 1 },
    stepDotMiniActive: {
        backgroundColor: colors.brand,
        transform: [{ scale: 1.15 }],
        ...Platform.select({
            web: {
                backgroundImage: QUEST_DESIGN.stepActiveGradient,
                boxShadow: '0 2px 10px rgba(245, 132, 44, 0.4)',
                transform: 'scale(1.15)',
            } as any,
        }),
    },
    stepDotMiniDone: {
        backgroundColor: colors.successSoft,
        ...Platform.select({
            web: {
                backgroundImage: 'linear-gradient(135deg, rgba(82, 125, 102, 0.15) 0%, rgba(66, 109, 86, 0.1) 100%)',
            } as any,
        }),
    },
    stepDotMiniLocked: { opacity: 0.72 },
    stepDotMiniText: { fontSize: isMobile ? 10 : 12, fontWeight: '700', color: colors.brandText },

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
