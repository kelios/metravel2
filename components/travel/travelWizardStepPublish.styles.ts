import { Platform, StyleSheet } from 'react-native';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

// ✅ УЛУЧШЕНИЕ: Функция создания стилей с динамическими цветами для поддержки тем
export const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
    safeContainer: {
        flex: 1,
        backgroundColor: colors.background
    },
    keyboardAvoid: {
        flex: 1
    },
    content: {
        flex: 1,
        paddingHorizontal: 8,
    },
    contentContainer: {
        paddingBottom: 0,
        paddingTop: DESIGN_TOKENS.spacing.sm,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
        maxWidth: 980,
    },
    card: {
        marginTop: DESIGN_TOKENS.spacing.lg,
        padding: DESIGN_TOKENS.spacing.lg,
        backgroundColor: colors.surface,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        ...(Platform.OS === 'web'
            ? ({
                boxShadow:
                    (colors as unknown as { boxShadows?: { card?: string } }).boxShadows?.card ??
                    DESIGN_TOKENS.shadows.card,
            } as unknown as object)
            : ((colors as unknown as { shadows?: { light?: object } }).shadows?.light ??
                DESIGN_TOKENS.shadowsNative.light)),
    },
    cardTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '700',
        color: colors.text,
        marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    statusCard: {},
    qualityCard: {},
    suggestionsContainer: {
        marginTop: DESIGN_TOKENS.spacing.md,
        paddingTop: DESIGN_TOKENS.spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
    },
    suggestionsTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: colors.text,
        marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    suggestionItem: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.textMuted,
        marginBottom: 4,
        lineHeight: 20,
    },
    statusOptions: {
        gap: DESIGN_TOKENS.spacing.sm,
    },
    statusOption: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: DESIGN_TOKENS.radii.md,
    },
    statusOptionActive: {
        backgroundColor: colors.primarySoft,
        borderWidth: 1,
        borderColor: colors.borderAccent,
    },
    statusTextCol: {
        flex: 1,
        minWidth: 0,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
        opacity: 0.8,
    },
    radioOuter: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        marginTop: DESIGN_TOKENS.spacing.xxs,
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primary,
    },
    statusLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: colors.text,
    },
    statusHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
    },
    statusChipCard: {
        marginTop: DESIGN_TOKENS.spacing.lg,
        padding: DESIGN_TOKENS.spacing.lg,
        backgroundColor: colors.surface,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    statusChipRow: { flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.md },
    statusChip: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: DESIGN_TOKENS.radii.pill,
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 1,
        borderColor: colors.border,
    },
    statusChipSuccess: { backgroundColor: colors.successSoft, borderColor: colors.successLight },
    statusChipWarning: { backgroundColor: colors.warningSoft, borderColor: colors.warningLight },
    statusChipMuted: { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
    statusChipText: { fontWeight: '700', color: colors.text },
    statusChipHint: { flex: 1, color: colors.textMuted, fontSize: DESIGN_TOKENS.typography.sizes.sm },
    readinessNote: {
        marginTop: DESIGN_TOKENS.spacing.sm,
        paddingVertical: DESIGN_TOKENS.spacing.sm,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: colors.infoLight,
        backgroundColor: colors.infoSoft,
    },
    readinessNoteText: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        lineHeight: 16,
        fontWeight: '600',
        color: colors.text,
    },
    checklistCard: {},
    checklistHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: DESIGN_TOKENS.spacing.sm,
    },
    progressRing: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: colors.primarySoft,
        borderWidth: 3,
        borderColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressRingText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.primaryText,
    },
    checklistRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 6,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    checklistRowClickable: {
        borderColor: colors.borderLight,
        backgroundColor: colors.surfaceMuted,
    },
    checklistRowComplete: {
        backgroundColor: colors.successSoft,
        borderColor: colors.successLight,
    },
    checklistTextColumn: {
        flex: 1,
        minWidth: 0,
    },
    checkBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        borderWidth: 0,
    },
    checkBadgeOk: {
        backgroundColor: colors.successSoft,
        borderColor: colors.successLight,
    },
    checkBadgeMissing: {
        backgroundColor: colors.dangerSoft,
        borderColor: colors.dangerLight,
    },
    checkBadgeRecommended: {
        backgroundColor: colors.primarySoft,
        borderColor: colors.primaryAlpha40,
    },
    checklistLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.text,
        lineHeight: 20,
        fontWeight: '500',
    },
    checklistLabelComplete: {
        color: colors.successDark,
    },
    checklistLabelClickable: {
        fontWeight: '600',
    },
    checklistDetail: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
        lineHeight: 16,
    },
    checklistHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
        fontStyle: 'italic',
    },
    // ✅ УЛУЧШЕНИЕ: Стили для разделения чеклиста
    checklistSection: {
        marginBottom: DESIGN_TOKENS.spacing.md,
    },
    checklistSectionRecommended: {
        paddingTop: DESIGN_TOKENS.spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: DESIGN_TOKENS.spacing.sm,
        gap: DESIGN_TOKENS.spacing.xs,
    },
    sectionHeaderIcon: {
        fontSize: 16,
    },
    sectionHeaderText: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '700',
        color: colors.text,
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 4,
    },
    benefitIcon: {
        fontSize: 12,
    },
    benefitText: {
        flex: 1,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.primaryText,
        fontWeight: '600',
        lineHeight: 16,
    },
    bannerError: {
        backgroundColor: colors.dangerSoft,
        borderColor: colors.dangerLight,
    },
    bannerInfo: {
        backgroundColor: colors.infoSoft,
        borderColor: colors.infoLight,
    },
    bannerInfoText: {
        color: colors.text,
        marginBottom: 0,
    },
    inlineBanner: {
        marginTop: DESIGN_TOKENS.spacing.sm,
        padding: DESIGN_TOKENS.spacing.md,
    },
    bannerTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: colors.dangerDark,
        marginBottom: 4,
    },
    bannerDescription: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.dangerDark,
        marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    adminCard: {
        backgroundColor: colors.backgroundSecondary,
        borderColor: colors.border,
    },
    instagramCard: {
        backgroundColor: colors.surface,
        borderColor: colors.border,
    },
    adminHint: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.textMuted,
        marginTop: DESIGN_TOKENS.spacing.xs,
        lineHeight: 20,
    },
    instagramSection: {
        marginTop: DESIGN_TOKENS.spacing.md,
    },
    accountList: {
        gap: DESIGN_TOKENS.spacing.xs,
    },
    accountOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: DESIGN_TOKENS.spacing.sm,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.backgroundSecondary,
    },
    accountOptionActive: {
        borderColor: colors.borderAccent,
        backgroundColor: colors.primarySoft,
    },
    instagramMetaRow: {
        flexDirection: 'row',
        gap: DESIGN_TOKENS.spacing.sm,
        marginTop: DESIGN_TOKENS.spacing.md,
    },
    instagramControlRow: {
        flexDirection: 'row',
        gap: DESIGN_TOKENS.spacing.sm,
        marginTop: DESIGN_TOKENS.spacing.md,
    },
    instagramCounterPill: {
        flex: 1,
        paddingVertical: DESIGN_TOKENS.spacing.sm,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: colors.borderLight,
        backgroundColor: colors.backgroundSecondary,
    },
    instagramCounterLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
        marginBottom: 4,
    },
    instagramCounterValue: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        color: colors.text,
        fontWeight: '700',
    },
    instagramEditor: {
        marginTop: DESIGN_TOKENS.spacing.md,
    },
    instagramEditorLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        color: colors.textMuted,
        fontWeight: '600',
        marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    instagramMetaItem: {
        flex: 1,
        paddingVertical: DESIGN_TOKENS.spacing.sm,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        borderWidth: 1,
        borderColor: colors.borderLight,
        borderRadius: DESIGN_TOKENS.radii.md,
        backgroundColor: colors.backgroundSecondary,
    },
    instagramMetaLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
        marginBottom: 4,
    },
    instagramMetaValue: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        color: colors.text,
        fontWeight: '700',
    },
    instagramHintText: {
        marginTop: 2,
        marginBottom: DESIGN_TOKENS.spacing.xs,
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
    },
    instagramHintDanger: {
        color: colors.dangerDark,
    },
    instagramFieldHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: DESIGN_TOKENS.spacing.sm,
    },
    instagramCounter: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
        fontWeight: '600',
    },
    instagramCounterDanger: {
        color: colors.dangerDark,
    },
    instagramGalleryRow: {
        gap: DESIGN_TOKENS.spacing.sm,
        paddingVertical: DESIGN_TOKENS.spacing.xs,
    },
    instagramGalleryGrid: {
        width: '100%',
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
    },
    instagramPhotoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    instagramPhotoHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DESIGN_TOKENS.spacing.sm,
    },
    instagramPhotoIconBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    instagramPhotoTitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '700',
        color: colors.text,
        lineHeight: 20,
    },
    instagramPhotoSubtitle: {
        fontSize: DESIGN_TOKENS.typography.sizes.xs,
        color: colors.textMuted,
        marginTop: 2,
    },
    instagramGalleryCard: {
        width: Platform.OS === 'web' ? '100%' : 96,
        aspectRatio: 1,
        borderRadius: DESIGN_TOKENS.radii.lg,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: colors.backgroundSecondary,
        borderWidth: 2,
        borderColor: colors.borderLight,
        ...(Platform.OS === 'web'
            ? ({
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                transition: 'all 0.2s ease',
                cursor: 'grab',
            } as any)
            : {}),
    },
    instagramGalleryCardDragging: {
        opacity: 0.72,
        borderColor: colors.primary,
        ...(Platform.OS === 'web' ? ({ cursor: 'grabbing' } as any) : {}),
    },
    instagramGalleryImage: {
        width: '100%',
        height: '100%',
    },
    instagramGalleryDragHandle: {
        position: 'absolute',
        top: 8,
        left: 8,
        width: Platform.OS === 'web' ? 36 : 28,
        height: Platform.OS === 'web' ? 36 : 28,
        borderRadius: Platform.OS === 'web' ? 18 : 14,
        backgroundColor: 'rgba(255,255,255,0.95)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0,
        ...(Platform.OS === 'web'
            ? ({
                cursor: 'grab',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                backdropFilter: 'blur(8px)',
            } as any)
            : {}),
    },
    instagramGalleryRemoveButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: Platform.OS === 'web' ? 36 : 28,
        height: Platform.OS === 'web' ? 36 : 28,
        borderRadius: Platform.OS === 'web' ? 18 : 14,
        backgroundColor: 'rgba(239, 68, 68, 0.95)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0,
        zIndex: 2,
        ...(Platform.OS === 'web'
            ? ({
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.2s ease',
            } as any)
            : {}),
    },
    instagramGalleryControls: {
        position: 'absolute',
        left: 8,
        right: 8,
        bottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: DESIGN_TOKENS.spacing.xs,
    },
    instagramGalleryControlButton: {
        width: Platform.OS === 'web' ? 44 : 32,
        height: Platform.OS === 'web' ? 44 : 32,
        borderRadius: Platform.OS === 'web' ? 22 : 16,
        backgroundColor: 'rgba(255,255,255,0.95)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0,
        ...(Platform.OS === 'web'
            ? ({
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.2s ease',
            } as any)
            : {}),
    },
    instagramGalleryControlButtonDisabled: {
        opacity: 0.45,
    },
    instagramPreview: {
        marginTop: DESIGN_TOKENS.spacing.md,
    },
    instagramPreviewText: {
        marginTop: DESIGN_TOKENS.spacing.xs,
        paddingVertical: DESIGN_TOKENS.spacing.md,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderWidth: 1,
        borderColor: colors.borderLight,
        backgroundColor: colors.backgroundSecondary,
        color: colors.text,
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        lineHeight: 20,
    },
    instagramCaptionInput: {
        minHeight: 140,
    },
    rejectionCommentContainer: {
        marginTop: DESIGN_TOKENS.spacing.md,
    },
    rejectionCommentLabel: {
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        fontWeight: '600',
        color: colors.text,
        marginBottom: DESIGN_TOKENS.spacing.xs,
    },
    rejectionCommentInput: {
        borderWidth: 1,
        borderRadius: DESIGN_TOKENS.radii.md,
        paddingHorizontal: DESIGN_TOKENS.spacing.md,
        paddingVertical: DESIGN_TOKENS.spacing.sm,
        fontSize: DESIGN_TOKENS.typography.sizes.sm,
        minHeight: 80,
        textAlignVertical: 'top' as const,
        ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
    },
    adminButtons: {
        marginTop: DESIGN_TOKENS.spacing.md,
        flexDirection: 'row',
        gap: DESIGN_TOKENS.spacing.sm,
    },
    adminButton: {
        flex: 1,
        minWidth: 150,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: DESIGN_TOKENS.spacing.xs,
        paddingVertical: DESIGN_TOKENS.spacing.md,
        paddingHorizontal: DESIGN_TOKENS.spacing.lg,
        borderRadius: DESIGN_TOKENS.radii.md,
        borderColor: colors.border,
        backgroundColor: colors.success,
    },
    adminButtonApprove: {
        backgroundColor: colors.success,
    },
    adminButtonReject: {
        backgroundColor: colors.danger,
    },
    adminButtonText: {
        fontSize: DESIGN_TOKENS.typography.sizes.md,
        fontWeight: '600',
        color: colors.textOnPrimary,
    },
});
