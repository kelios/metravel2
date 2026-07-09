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
    headerRowMobile: {
        alignItems: 'center',
        marginBottom: 0,
    },
    headerIdentity: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
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
    actionIconButton: {
        width: 38,
        minHeight: 38,
        height: 38,
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
    progressCompact: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.textMuted,
        letterSpacing: -0.1,
        marginTop: 1,
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
} as const);
