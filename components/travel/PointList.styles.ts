import { Platform, StyleSheet } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import { globalFocusStyles } from '@/styles/globalFocus';
import { useThemedColors } from '@/hooks/useTheme';

export const createPointListStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create<any>({
  wrapper: { width: '100%', marginTop: DESIGN_TOKENS.spacing.lg },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  statusTextWrap: {
    flex: 1,
    gap: 2,
  },
  statusTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '700',
    color: colors.text,
  },
  statusHint: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    lineHeight: 16,
    color: colors.textMuted,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  statusBadgeText: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '700',
    color: colors.primaryText,
  },
  toggle: {
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: DESIGN_TOKENS.spacing.md,
    minHeight: 48,
    ...Platform.select({
      web: {
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
        cursor: 'pointer' as any,
        ':hover': {
          backgroundColor: colors.backgroundSecondary,
          borderColor: colors.border,
        } as any,
      },
    }),
  },
  togglePressed: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.border,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.md,
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
  },
  toggleText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '500',
    color: colors.text,
    letterSpacing: -0.1,
  },
  toggleTextSm: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    letterSpacing: 0,
  },
  previewContainer: {
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    marginBottom: DESIGN_TOKENS.spacing.md,
    gap: DESIGN_TOKENS.spacing.xs,
    ...Platform.select({
      web: { cursor: 'pointer' as any },
    }),
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 4,
  },
  previewBullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBulletText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryText,
  },
  previewTextWrap: {
    flex: 1,
    gap: 1,
  },
  previewAddress: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '500',
    color: colors.text,
  },
  previewCoord: {
    fontSize: 11,
    color: colors.textMuted,
  },
  previewMore: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
    color: colors.primaryText,
    textAlign: 'center',
    paddingTop: DESIGN_TOKENS.spacing.xs,
  },
  previewFooter: {
    marginTop: DESIGN_TOKENS.spacing.xs,
    paddingTop: DESIGN_TOKENS.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  previewFooterLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  previewFooterText: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '600',
    color: colors.primary,
  },
  listContent: {
    paddingBottom: DESIGN_TOKENS.spacing.xxl,
    paddingHorizontal: Platform.select({
      web: 0,
      default: 8,
    }),
  },
  columnWrap: {
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    gap: DESIGN_TOKENS.spacing.md,
    ...Platform.select({
      web: {
        paddingHorizontal: 0,
        display: 'flex' as any,
        flexDirection: 'row' as any,
      },
    }),
  },
  horizontalScroll: {
    width: '100%',
    ...Platform.select({
      web: {
        overflowX: 'auto' as any,
        overflowY: 'hidden' as any,
        overscrollBehaviorX: 'contain' as any,
        WebkitOverflowScrolling: 'touch' as any,
        touchAction: 'pan-x pan-y' as any,
      },
    }),
  },
  webGridWrap: Platform.OS === 'web' ? {
    display: 'grid' as any,
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' as any,
    gap: DESIGN_TOKENS.spacing.md,
    width: '100%' as any,
  } : {
    flexDirection: 'row' as any,
    flexWrap: 'wrap' as any,
    gap: DESIGN_TOKENS.spacing.md,
  },
  colWebGrid: {
    width: '100%' as any,
    minWidth: 0,
    marginBottom: 0, // grid gap handles spacing — override col.marginBottom
  },
  horizontalListContent: {
    flexDirection: 'row' as any,
    gap: DESIGN_TOKENS.spacing.md,
    paddingBottom: DESIGN_TOKENS.spacing.md,
    paddingHorizontal: 4,
    ...Platform.select({
      web: {
        minWidth: 'max-content' as any,
        alignItems: 'stretch' as any,
      },
    }),
  },
  col: {
    marginBottom: DESIGN_TOKENS.spacing.md,
    ...Platform.select({
      web: {
        display: 'flex' as any,
        flexDirection: 'column' as any,
        height: '100%',
      },
    }),
  },
  col2: {
    width: Platform.select({
      web: 'calc(50% - 10px)' as any,
      default: '48%',
    }),
  },
  col1: {
    width: '100%',
  },
  colHorizontal: {
    width: Platform.select({
      web: 'min(320px, calc(100vw - 40px))' as any,
      default: 320,
    }),
    flexShrink: 0,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
    display: 'flex' as any,
    flexDirection: 'column' as any,
    ...Platform.select({
      web: {
        transition: 'border-color 0.2s ease',
        height: '100%',
      },
    }),
  },
  cardPressable: {
    flex: 1,
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
      },
    }),
  },
  imageWrap: {
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    display: 'block',
    backgroundColor: colors.backgroundTertiary,
    ...Platform.select({
      web: {
        objectFit: 'contain' as any,
        transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      },
      default: {
        resizeMode: 'contain' as any,
      },
    }),
  },
  noImage: {
    width: '100%',
    backgroundColor: colors.backgroundTertiary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minHeight: 240,
  },
  actionsWrap: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.xs,
    backgroundColor: colors.overlay,
    borderRadius: 14,
    padding: 4,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(12px) saturate(180%)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
        boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
      },
    }),
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlayLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    ...Platform.select({
      web: {
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer' as any,
        ':hover': {
          backgroundColor: colors.surface,
          transform: 'scale(1.06)',
          boxShadow: (colors.boxShadows as any)?.medium ?? '0 4px 10px rgba(0,0,0,0.16)',
        } as any,
        ':active': {
          transform: 'scale(1.02)',
        } as any,
      },
    }),
  },
  overlayBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    backgroundColor: colors.overlay,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderLight,
    flexDirection: 'column',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  overlayTitle: {
    color: colors.textOnDark,
    fontWeight: '700',
    lineHeight: 20,
    letterSpacing: -0.3,
  },
  overlayCoordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.overlayLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  overlayCoordText: {
    color: colors.textOnDark,
    fontWeight: '500',
    fontFamily: Platform.select({
      web: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
      default: undefined,
    }),
    letterSpacing: 0.2,
  },
  overlayMapChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.xs,
    marginTop: DESIGN_TOKENS.spacing.xxs,
  },
  mapChip: {
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'all 0.2s ease',
        ':hover': {
          borderColor: colors.border,
          backgroundColor: colors.backgroundSecondary,
        } as any,
      },
    }),
  },
  mapChipText: {
    color: colors.text,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  overlayCategoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DESIGN_TOKENS.spacing.xs,
    marginTop: DESIGN_TOKENS.spacing.xxs,
  },
  overlayCategoryChip: {
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.overlayLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  overlayCategoryText: {
    color: colors.textOnDark,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '500',
  },
  addButtonContainer: {
    marginTop: DESIGN_TOKENS.spacing.md,
  },
  addButtonContainerWide: {
    width: '100%',
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: DESIGN_TOKENS.radii.lg,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'all 0.2s ease',
      },
    }),
  },
  addButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  addButtonDisabled: {
    opacity: 0.65,
  },
  addButtonFullWidth: {
    width: '100%',
  },
  addButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  addButtonText: {
    fontWeight: '600',
    letterSpacing: -0.2,
    color: colors.textOnPrimary,
  },
  viewModeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    marginBottom: DESIGN_TOKENS.spacing.md,
    alignSelf: 'flex-end',
  },
  viewModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    borderRadius: DESIGN_TOKENS.radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'all 0.2s ease',
        ':hover': {
          backgroundColor: colors.backgroundSecondary,
          borderColor: colors.border,
        } as any,
      },
    }),
  },
  viewModeBtnActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  viewModeBtnText: {
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '500',
    color: colors.textMuted,
  },
  viewModeBtnTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  verticalListWrap: {
    gap: DESIGN_TOKENS.spacing.xs,
  },
  listRow: {
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        ':hover': {
          borderColor: colors.border,
          boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
        } as any,
      },
    }),
  },
  listRowPressable: {
    flexDirection: 'row',
    alignItems: 'stretch',
    ...Platform.select({
      web: { cursor: 'pointer' as any },
    }),
  },
  listRowThumb: {
    width: 96,
    minHeight: 96,
    backgroundColor: colors.backgroundSecondary,
    position: 'relative',
    overflow: 'hidden',
  },
  listRowThumbPlaceholder: {
    width: 96,
    minHeight: 96,
    backgroundColor: colors.backgroundTertiary,
  },
  listRowInfo: {
    flex: 1,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    gap: 4,
    justifyContent: 'center',
  },
  listRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  listRowBullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  listRowBulletText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryText,
  },
  listRowTitle: {
    flex: 1,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 18,
  },
  listRowCoordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: DESIGN_TOKENS.spacing.xs,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.backgroundSecondary,
  },
  listRowCoordText: {
    fontSize: 11,
    color: colors.textMuted,
    fontFamily: Platform.select({
      web: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
      default: undefined,
    }),
  },
  listRowCategory: {
    fontSize: 11,
    color: colors.textMuted,
  },
  listRowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  listRowIconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: colors.backgroundSecondary ?? colors.surface,
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'background-color 0.15s ease' as any,
        ':hover': {
          backgroundColor: colors.backgroundTertiary,
        } as any,
      },
    }),
  },
  listRowMapChip: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'background-color 0.15s ease, border-color 0.15s ease' as any,
        ':hover': {
          backgroundColor: colors.backgroundTertiary,
          borderColor: colors.border,
        } as any,
      },
    }),
  },
  listRowMapChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
  },
  listRowNavChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.primary,
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'background-color 0.15s ease, border-color 0.15s ease' as any,
        ':hover': {
          backgroundColor: colors.primarySoft,
          borderColor: colors.primaryDark,
        } as any,
      },
    }),
  },
  listRowNavChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primaryText,
  },
  listRowAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
    marginLeft: 'auto' as any,
    ...Platform.select({
      web: {
        cursor: 'pointer' as any,
        transition: 'background-color 0.15s ease' as any,
        ':hover': {
          backgroundColor: colors.primarySoft,
        } as any,
      },
    }),
  },
  listRowAddBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  globalFocusStyle: globalFocusStyles.focusable,
});
