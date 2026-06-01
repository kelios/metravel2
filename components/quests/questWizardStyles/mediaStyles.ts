import { Platform, StyleSheet } from 'react-native';
import { type QuestColors, SPACING, QUEST_DESIGN } from './shared';

export const createMediaStyles = (colors: QuestColors, isMobile: boolean, screenW: number) => ({
    imagePreview: { borderRadius: 12, overflow: 'hidden', position: 'relative', width: '100%', maxWidth: isMobile ? screenW - 64 : 480 },
    previewImage: { width: '100%', aspectRatio: 4 / 3, resizeMode: 'contain' },
    imageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.overlay, padding: 8, alignItems: 'center' },
    overlayText: { color: colors.textOnDark, fontSize: 12, fontWeight: '600' },

    startButton: {
        padding: SPACING.lg,
        borderRadius: 16,
        alignItems: 'center',
        alignSelf: 'stretch',
        minHeight: 56,
        justifyContent: 'center',
        ...Platform.select({
            web: {
                backgroundImage: QUEST_DESIGN.stepActiveGradient,
                boxShadow: '0 8px 24px rgba(245, 132, 44, 0.35)',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            } as any,
            default: { backgroundColor: colors.brand },
        }),
    },
    startButtonText: {
        color: colors.textOnPrimary,
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: -0.3,
    },

    fullMapSection: {
        backgroundColor: colors.surface,
        borderRadius: isMobile ? 12 : 16,
        padding: SPACING.sm,
        marginBottom: isMobile ? SPACING.sm : SPACING.md,
        borderWidth: 0,
        overflow: 'hidden',
        ...Platform.select({
            web: {
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            } as any,
        }),
    },
    mapTopControls: {
        marginBottom: SPACING.sm,
    },

    videoFrame: {
        alignSelf: 'center',
        backgroundColor: colors.text,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: SPACING.md,
        position: 'relative',
    },
    videoFallbackOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.overlay,
        paddingHorizontal: SPACING.md,
        gap: 10,
    },
    videoFallbackText: {
        color: colors.textOnDark,
        fontWeight: '600',
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
    },
    videoRetryBtn: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: colors.surface,
        borderRadius: 10,
        ...Platform.select({ web: { cursor: 'pointer' } as any }),
    },
    videoRetryText: { color: colors.text, fontWeight: '700', fontSize: 14 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
    gestureContainer: { flex: 1, width: '100%' },
    animatedContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    zoomedImage: { width: '100%', height: '100%' },
    closeButton: { position: 'absolute', top: 50, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    closeButtonText: { color: colors.textOnDark, fontSize: 18, fontWeight: 'bold' },
    zoomHintContainer: { position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center' },
    zoomHint: { color: colors.textOnDark, fontSize: 14, backgroundColor: 'rgba(0,0,0,0.55)', padding: 10, borderRadius: 8 },

    flipBadge: {
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 999,
        ...Platform.select({
            web: {
                backgroundImage: QUEST_DESIGN.stepDoneGradient,
                boxShadow: '0 12px 32px rgba(82, 125, 102, 0.4)',
            } as any,
            ios: {
                backgroundColor: colors.success,
                shadowColor: colors.success,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.35,
                shadowRadius: 20,
            },
            android: {
                backgroundColor: colors.success,
                elevation: 10,
            },
        }),
    },
    flipText: {
        color: colors.textOnDark,
        fontWeight: '800',
        fontSize: 18,
        letterSpacing: -0.3,
    },
} as const);
