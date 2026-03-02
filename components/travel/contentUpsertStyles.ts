// components/travel/contentUpsertStyles.ts
// E1: Styles extracted from ContentUpsertSection.tsx (~310 LOC)

import { StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import type { useThemedColors } from '@/hooks/useTheme';

type Colors = ReturnType<typeof useThemedColors>;

export const createContentUpsertStyles = (colors: Colors) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: { padding: DESIGN_TOKENS.spacing.xs, paddingBottom: 40 },
    modalSafeArea: { flex: 1, backgroundColor: colors.background },
    modalShell: { flex: 1, width: '100%', maxWidth: 1200, alignSelf: 'center' },
    modalHeader: {
        paddingHorizontal: DESIGN_TOKENS.spacing.md, paddingVertical: DESIGN_TOKENS.spacing.sm,
        borderBottomWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', backgroundColor: colors.surface,
        ...(Platform.OS === 'web' ? ({ position: 'sticky', top: 0, zIndex: 20, boxShadow: DESIGN_TOKENS.shadows.light } as any) : null),
    },
    modalHeaderSide: { width: 96, alignItems: 'flex-start' },
    modalHeaderSideRight: { alignItems: 'flex-end' },
    modalHeaderCenter: { flex: 1, alignItems: 'center' },
    modalHeaderTitle: { fontSize: DESIGN_TOKENS.typography.sizes.md, fontWeight: '700', color: colors.text, lineHeight: 20 },
    modalHeaderSubtitle: { marginTop: 2, fontSize: DESIGN_TOKENS.typography.sizes.xs, color: colors.textMuted },
    modalHeaderAction: { fontSize: DESIGN_TOKENS.typography.sizes.sm, fontWeight: '600', color: colors.primaryText },
    modalHeaderActionPrimary: { color: colors.textOnPrimary },
    modalActionButton: {
        minHeight: 36, minWidth: 78, borderRadius: DESIGN_TOKENS.radii.pill, borderWidth: 1,
        borderColor: colors.border, backgroundColor: colors.surfaceElevated,
        alignItems: 'center', justifyContent: 'center', paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    },
    modalActionButtonCompact: { minWidth: 36, width: 36, paddingHorizontal: 0 },
    modalActionContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: DESIGN_TOKENS.spacing.xs },
    modalActionButtonPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
    modalBody: { flex: 1, paddingHorizontal: DESIGN_TOKENS.spacing.sm, paddingTop: DESIGN_TOKENS.spacing.sm, paddingBottom: DESIGN_TOKENS.spacing.md },
    modalEditorCard: {
        flex: 1, borderRadius: DESIGN_TOKENS.radii.lg, overflow: 'hidden', backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.border,
        ...(Platform.OS === 'web' ? ({ boxShadow: DESIGN_TOKENS.shadows.modal } as any) : (DESIGN_TOKENS.shadowsNative.medium as any)),
    },
    descriptionPreview: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 12, padding: DESIGN_TOKENS.spacing.md, minHeight: 140 },
    descriptionPreviewText: { fontSize: DESIGN_TOKENS.typography.sizes.sm, color: colors.text, lineHeight: 18, marginBottom: DESIGN_TOKENS.spacing.sm },
    descriptionPreviewFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    descriptionActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: DESIGN_TOKENS.spacing.xs, marginTop: DESIGN_TOKENS.spacing.sm, marginBottom: DESIGN_TOKENS.spacing.xs },
    descriptionActionButton: { minHeight: 36 },
    dictationInterimText: { marginTop: DESIGN_TOKENS.spacing.xs, fontSize: DESIGN_TOKENS.typography.sizes.sm, color: colors.textMuted },
    dictationHint: { marginTop: DESIGN_TOKENS.spacing.xs, fontSize: DESIGN_TOKENS.typography.sizes.xs, color: colors.textMuted, lineHeight: 16 },
    descriptionEditChip: {
        paddingHorizontal: DESIGN_TOKENS.spacing.sm, paddingVertical: DESIGN_TOKENS.spacing.xxs,
        borderRadius: 999, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.borderAccent,
    },
    descriptionEditChipText: { fontSize: DESIGN_TOKENS.typography.sizes.xs, fontWeight: '600', color: colors.primaryText },
    progressSection: {
        marginBottom: DESIGN_TOKENS.spacing.xs, padding: DESIGN_TOKENS.spacing.lg,
        backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    progressLabel: { fontSize: DESIGN_TOKENS.typography.sizes.sm, fontWeight: '600', color: colors.text },
    progressPercent: { fontSize: DESIGN_TOKENS.typography.sizes.md, fontWeight: '700', color: colors.primaryText },
    progressBarContainer: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
    progressBar: { height: '100%', backgroundColor: colors.primary, borderRadius: 4 },
    section: {
        marginBottom: DESIGN_TOKENS.spacing.xxs, backgroundColor: colors.surface, borderRadius: DESIGN_TOKENS.radii.md,
        padding: DESIGN_TOKENS.spacing.lg, borderWidth: 1, borderColor: colors.border,
        ...(Platform.OS === 'web' ? ({ boxShadow: DESIGN_TOKENS.shadows.card } as any) : (DESIGN_TOKENS.shadowsNative.light as any)),
    },
    descriptionProgressContainer: { marginTop: 8 },
    descriptionProgressTrack: { height: 4, backgroundColor: colors.borderLight, borderRadius: DESIGN_TOKENS.radii.pill, overflow: 'hidden' },
    descriptionProgressFill: { height: '100%', borderRadius: DESIGN_TOKENS.radii.pill },
    descriptionStatusRow: { marginTop: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    descriptionStatusText: { flex: 1, fontSize: DESIGN_TOKENS.typography.sizes.xs, color: colors.textMuted, marginRight: 8 },
    descriptionStatusTextWarning: { color: colors.dangerDark, fontWeight: '600' },
    descriptionStatusTextSuccess: { color: colors.successDark },
    descriptionCounterText: { fontSize: DESIGN_TOKENS.typography.sizes.xs, fontWeight: '600', color: colors.text },
    descriptionAnchorHint: { fontSize: DESIGN_TOKENS.typography.sizes.xs, color: colors.textMuted, marginTop: 6 },
    autosaveRow: { marginTop: 4 },
    autosaveText: { fontSize: DESIGN_TOKENS.typography.sizes.xs, color: colors.textMuted },
    autosaveSuccess: { fontSize: DESIGN_TOKENS.typography.sizes.xs, color: colors.successDark },
    autosaveError: { fontSize: DESIGN_TOKENS.typography.sizes.xs, color: colors.dangerDark },
    sectionEditor: {
        marginBottom: DESIGN_TOKENS.spacing.xxs, paddingBottom: DESIGN_TOKENS.spacing.xs, backgroundColor: colors.surface,
        borderRadius: DESIGN_TOKENS.radii.md, padding: DESIGN_TOKENS.spacing.lg, borderWidth: 1, borderColor: colors.border,
        ...(Platform.OS === 'web' ? ({ boxShadow: DESIGN_TOKENS.shadows.card } as any) : (DESIGN_TOKENS.shadowsNative.light as any)),
    },
    editorHeader: { marginBottom: 12 },
    editorLabel: { fontSize: DESIGN_TOKENS.typography.sizes.sm, fontWeight: '600', color: colors.text, marginBottom: 4 },
    required: { color: colors.danger },
    editorHint: { fontSize: DESIGN_TOKENS.typography.sizes.xs, color: colors.textMuted, marginTop: 4 },
    errorContainer: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: DESIGN_TOKENS.spacing.xs },
    errorText: { fontSize: DESIGN_TOKENS.typography.sizes.xs, color: colors.danger },
});

