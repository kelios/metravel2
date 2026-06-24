import { Platform, StyleSheet } from 'react-native'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { useThemedColors } from '@/hooks/useTheme'

const PANEL_RADIUS = DESIGN_TOKENS.radii.lg
const CONTROL_RADIUS = DESIGN_TOKENS.radii.sm

export const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 0,
    gap: DESIGN_TOKENS.spacing.sm,
  },
  bulkMapBar: {
    position: 'absolute',
    top: Platform.OS === 'web' ? DESIGN_TOKENS.spacing.md : DESIGN_TOKENS.spacing.lg,
    left: DESIGN_TOKENS.spacing.lg,
    right: DESIGN_TOKENS.spacing.lg,
    zIndex: 10,
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: DESIGN_TOKENS.spacing.md,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  bulkMapBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: DESIGN_TOKENS.spacing.sm,
    flexWrap: 'wrap',
  },
  bulkMapBarText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '800' as any,
    color: colors.text,
  },
  bulkMapBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.sm,
    justifyContent: 'flex-end',
  },
  listContent: {
    paddingBottom: DESIGN_TOKENS.spacing.xl,
  },
  gridListContent: {
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    paddingBottom: DESIGN_TOKENS.spacing.xl,
  },
  gridColumnWrapper: {
    gap: DESIGN_TOKENS.spacing.md,
    paddingBottom: DESIGN_TOKENS.spacing.md,
  },
  titleContainer: {
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    flexShrink: 1,
    gap: DESIGN_TOKENS.spacing.xs,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statPillLabel: {
    fontSize: 12,
    fontWeight: '700' as any,
    color: colors.textMuted,
  },
  statPillValue: {
    fontSize: 12,
    fontWeight: '800' as any,
    color: colors.text,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  titleRowNarrow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  headerActionsRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  actionsTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: DESIGN_TOKENS.spacing.sm,
    flexShrink: 0,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  headerActionsNarrow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  title: {
    fontSize: DESIGN_TOKENS.typography.sizes.xl,
    fontWeight: '700' as any,
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  subtitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: colors.textMuted,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: DESIGN_TOKENS.radii.md,
    padding: 2,
  },
  viewButton: {
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderRadius: DESIGN_TOKENS.radii.sm,
  },
  viewIconButton: {
    width: DESIGN_TOKENS.touchTarget.minHeight,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewButtonActive: {
    backgroundColor: colors.primary,
  },
  viewButtonText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    fontWeight: '600' as any,
  },
  viewButtonTextActive: {
    color: colors.textOnPrimary,
  },
  mapContainer: {
    flex: 1,
  },
  mapInner: {
    flex: 1,
  },
  locateFab: {
    position: 'absolute',
    right: DESIGN_TOKENS.spacing.lg,
    bottom: DESIGN_TOKENS.spacing.lg,
    width: 44,
    height: 44,
    borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : null),
  },
  locateFabDisabled: {
    opacity: 0.6,
    ...(Platform.OS === 'web' ? ({ cursor: 'not-allowed' } as any) : null),
  },
  actionsOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: DESIGN_TOKENS.spacing.md,
  },
  actionsBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  actionsModal: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: PANEL_RADIUS,
    padding: DESIGN_TOKENS.spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: ((colors.boxShadows as any)?.modal ?? DESIGN_TOKENS.shadows.modal) as any,
      } as any,
      default: {
        ...DESIGN_TOKENS.shadowsNative.medium,
      },
    }),
  },
  actionsTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '800' as any,
    color: colors.text,
    flex: 1,
  },
  actionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
  actionsCloseButton: {
    width: DESIGN_TOKENS.touchTarget.minHeight,
    height: DESIGN_TOKENS.touchTarget.minHeight,
    borderRadius: DESIGN_TOKENS.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
  },
  actionsButton: {
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  manualOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: DESIGN_TOKENS.spacing.md,
  },
  manualBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  manualModal: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '88%',
    backgroundColor: colors.surface,
    borderRadius: PANEL_RADIUS,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...Platform.select({
      web: {
        boxShadow: ((colors.boxShadows as any)?.modal ?? DESIGN_TOKENS.shadows.modal) as any,
      } as any,
      default: {
        ...DESIGN_TOKENS.shadowsNative.medium,
      },
    }),
  },
  manualHeader: {
    padding: DESIGN_TOKENS.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  manualTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '800' as any,
    color: colors.text,
    flex: 1,
  },
  manualScroll: {
    flex: 1,
  },
  manualScrollContent: {
    padding: DESIGN_TOKENS.spacing.md,
  },
  manualColorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  manualInput: {
    backgroundColor: colors.backgroundSecondary,
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: CONTROL_RADIUS,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.borderLight,
    minHeight: DESIGN_TOKENS.touchTarget.minHeight,
    ...Platform.select({
      web: {
        outlineWidth: 0,
      } as any,
    }),
  },
  coordsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  coordsCol: {
    flex: 1,
    minWidth: 120,
  },
  manualFooter: {
    padding: DESIGN_TOKENS.spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  modalSpacing: {
    marginTop: DESIGN_TOKENS.spacing.sm,
  },
  manualErrorText: {
    marginTop: DESIGN_TOKENS.spacing.sm,
    color: colors.danger,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600' as any,
  },
  searchContainer: {
    marginBottom: DESIGN_TOKENS.spacing.xs,
  },
  searchInput: {
    backgroundColor: colors.backgroundSecondary,
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: CONTROL_RADIUS,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.borderLight,
    minHeight: DESIGN_TOKENS.touchTarget.minHeight,
    ...Platform.select({
      web: {
        outlineWidth: 0,
      } as any,
    }),
  },
  headerDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: DESIGN_TOKENS.spacing.xs,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  filterButton: {
    backgroundColor: colors.backgroundSecondary,
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: CONTROL_RADIUS,
    alignItems: 'center',
    marginBottom: DESIGN_TOKENS.spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  filterButtonText: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600' as any,
  },
  emptyContainer: {
    padding: DESIGN_TOKENS.spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '600' as any,
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  emptySubtext: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  emptyActionsRow: {
    marginTop: DESIGN_TOKENS.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    flexWrap: 'wrap',
  },
  emptyActionButton: {
    minWidth: 160,
  },
  secondaryButton: {
    backgroundColor: colors.backgroundSecondary,
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600' as any,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: DESIGN_TOKENS.spacing.xl,
  },
  errorText: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    color: colors.danger,
    marginBottom: DESIGN_TOKENS.spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary,
    padding: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
  },
  retryButtonText: {
    color: colors.textOnPrimary,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600' as any,
  },
})
