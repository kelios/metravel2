import { Platform, StyleSheet } from 'react-native';

import { DESIGN_TOKENS } from '@/constants/designSystem';
import { useThemedColors } from '@/hooks/useTheme';

export const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: colors.background,
    ...(Platform.OS === 'web'
      ? ({ height: '100dvh', overflow: 'hidden' } as any)
      : null),
  },
  keyboardAvoid: {
    flex: 1,
  },
  flexFill: {
    flex: 1,
  },
  validationSummaryWrapper: {
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
  },
  content: {
    flex: 1,
    paddingHorizontal: DESIGN_TOKENS.spacing.xs,
  },
  contentContainer: {
    paddingTop: DESIGN_TOKENS.spacing.sm,
    paddingBottom: DESIGN_TOKENS.spacing.xl,
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
      ? ({ boxShadow: colors.boxShadows?.card ?? '0 2px 8px rgba(0,0,0,0.08)' } as any)
      : ((colors.shadows?.light ?? {}) as any)),
    overflow: 'hidden',
  },
  mapHeader: {
    paddingTop: 2,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  mapHeaderCompact: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingTop: DESIGN_TOKENS.spacing.xs,
  },
  mapTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.xxs,
  },
  mapHint: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    color: colors.textMuted,
  },
  mapCount: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '600',
    color: colors.primaryText,
  },
  coachmark: {
    marginBottom: DESIGN_TOKENS.spacing.xs,
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.infoSoft,
    borderWidth: 1,
    borderColor: colors.infoLight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  coachmarkTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '700',
    color: colors.infoDark,
    marginBottom: 2,
  },
  coachmarkBody: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.text,
  },
  manualPointRow: {
    paddingBottom: DESIGN_TOKENS.spacing.xs,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  manualPointCard: {
    marginBottom: DESIGN_TOKENS.spacing.xs,
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  manualPhotoRow: {
    marginBottom: DESIGN_TOKENS.spacing.sm,
    gap: DESIGN_TOKENS.spacing.xs,
    ...(Platform.OS === 'web'
      ? ({ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' } as any)
      : null),
  },
  manualHiddenInput: {
    display: 'none',
  },
  manualPhotoHint: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    color: colors.textMuted,
    ...(Platform.OS === 'web' ? ({ width: '100%' } as any) : null),
  },
  manualCoordsWrapper: {
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  manualPointInputsRow: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  manualPointInputWrapper: {
    flex: 1,
  },
  manualPointLabel: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    color: colors.textMuted,
    marginBottom: 6,
    fontWeight: '600',
  },
  manualPointInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: DESIGN_TOKENS.radii.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: 10,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    backgroundColor: colors.surface,
    color: colors.text,
  },
  manualPointActionsRow: {
    marginTop: DESIGN_TOKENS.spacing.sm,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  filtersRow: {
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingBottom: DESIGN_TOKENS.spacing.xs,
  },
  filterItem: {
    flex: 1,
  },
  countriesHint: {
    marginTop: DESIGN_TOKENS.spacing.xs,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    color: colors.textMuted,
  },
  countrySummary: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: DESIGN_TOKENS.radii.sm,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
  },
  countrySummaryLabel: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  countrySummaryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  countrySummaryChip: {
    borderRadius: DESIGN_TOKENS.radii.full,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.xxs,
  },
  countrySummaryChipText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.primaryText,
    fontWeight: '600',
  },
  countrySummaryEmpty: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
  },
  filtersSkeleton: {
    marginTop: 4,
    paddingVertical: 4,
  },
  filtersSkeletonLabel: {
    width: 120,
    height: 12,
    borderRadius: DESIGN_TOKENS.radii.sm,
    backgroundColor: colors.borderLight,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  filtersSkeletonInput: {
    width: '100%',
    height: 40,
    borderRadius: DESIGN_TOKENS.radii.sm,
    backgroundColor: colors.borderLight,
  },
  mapContainer: {
    marginTop: DESIGN_TOKENS.spacing.xxs,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingBottom: DESIGN_TOKENS.spacing.lg,
  },
  mapContainerCompact: {
    marginTop: DESIGN_TOKENS.spacing.xs,
    paddingBottom: DESIGN_TOKENS.spacing.md,
  },
  lazyFallback: {
    padding: DESIGN_TOKENS.spacing.lg,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 240,
  },
  lazyFallbackText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    fontWeight: '600',
  },
  nativeMapPlaceholder: {
    padding: DESIGN_TOKENS.spacing.lg,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nativeMapTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  nativeMapBody: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    lineHeight: 18,
  },
})

export type Styles = ReturnType<typeof createStyles>
