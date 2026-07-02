import { Platform, StyleSheet } from 'react-native'
import { DESIGN_COLORS, DESIGN_TOKENS } from '@/constants/designSystem'
import type { useThemedColors } from '@/hooks/useTheme'

export const createStyles = (colors: ReturnType<typeof useThemedColors>) => StyleSheet.create({
  container: {
    flexDirection: 'column',
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.lg,
    marginHorizontal: DESIGN_TOKENS.spacing.md,
    marginBottom: DESIGN_TOKENS.spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...(Platform.OS === 'web' ? ({
      boxShadow: colors.boxShadows.light,
      transition: 'transform 200ms ease-out, box-shadow 200ms ease-out, border-color 200ms ease',
      cursor: 'pointer',
    } as any) : null),
  },
  containerCompact: {
    marginHorizontal: 0,
  },
  containerActive: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.primarySoft,
    ...(Platform.OS === 'web' ? ({ boxShadow: `0 0 0 3px ${colors.primaryAlpha30}, ${colors.boxShadows.hover}` } as any) : null),
  },
  containerGrid: {
    marginHorizontal: 0,
    marginBottom: 0,
    flex: 1,
    alignSelf: 'stretch',
  },
  colorIndicator: {
    position: 'absolute',
    top: DESIGN_TOKENS.spacing.sm,
    left: DESIGN_TOKENS.spacing.sm,
    width: 10,
    height: 10,
    borderRadius: DESIGN_TOKENS.radii.pill,
    zIndex: 2,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    ...(Platform.OS === 'web' ? ({ boxShadow: colors.boxShadows.light } as any) : null),
  },
  contentContainer: {
    padding: 0,
  },

  // ── Photo-dominant overlay (parity with components/travel/PointCard.tsx) ──
  // Bottom scrim overlay that sits over the photo: title + coords + category +
  // navigation menu + drive info. Solid dark scrim (no live backdrop-filter on
  // mobile) keeps text legible without killing GPU on scroll.
  overlayBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    flexDirection: 'column',
    gap: DESIGN_TOKENS.spacing.xs,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage:
            'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.12) 88%, rgba(0,0,0,0) 100%)',
        } as any)
      : { backgroundColor: 'rgba(0,0,0,0.5)' }),
  },
  overlayTitle: {
    color: colors.textOnDark,
    fontSize: 16,
    fontWeight: '700' as any,
    lineHeight: 21,
    letterSpacing: -0.3,
    ...(Platform.OS === 'web'
      ? ({ textShadow: '0 1px 8px rgba(0,0,0,0.5)' } as any)
      : {
          textShadowColor: 'rgba(0,0,0,0.5)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 6,
        }),
  },
  overlayTitleWithActions: {
    paddingRight: 84,
  },
  overlaySubtitle: {
    color: colors.textOnDark,
    fontSize: 12.5,
    lineHeight: 17,
    opacity: 0.92,
  },
  overlayCoordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.overlayLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  overlayCoordText: {
    flexShrink: 1,
    color: colors.textOnDark,
    fontSize: 12,
    fontWeight: '500' as any,
    fontFamily: Platform.select({
      web: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
      default: undefined,
    }),
    letterSpacing: 0.2,
  },
  overlayCoordCopyBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlayLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  overlayNavigationMenu: {
    alignSelf: 'stretch',
    marginTop: DESIGN_TOKENS.spacing.xxs,
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
    fontWeight: '500' as any,
  },
  overlayDriveInfo: {
    alignSelf: 'flex-start',
    marginTop: DESIGN_TOKENS.spacing.xxs,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.overlayLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  overlayDriveInfoText: {
    color: colors.textOnDark,
    fontSize: DESIGN_TOKENS.typography.sizes.xs,
    fontWeight: '600' as any,
  },

  // Corner action icons over the photo (edit/delete) — narrow zone, top-right.
  cornerActionsRow: {
    flexDirection: 'row',
    gap: DESIGN_TOKENS.spacing.xs,
  },
  cornerActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlayLight,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(8px)',
          cursor: 'pointer',
          transition: 'transform 120ms ease',
        } as any)
      : null),
  },
  // Selection checkbox — top-right corner over the photo.
  selectionBadge: {
    width: 32,
    height: 32,
    borderRadius: DESIGN_TOKENS.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectionBadgeSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectionBadgeUnselected: {
    backgroundColor: colors.overlayLight,
    borderColor: 'rgba(255,255,255,0.6)',
  },

  // ── No-photo fallback (content-below, inline meta) ──
  content: {
    flex: 1,
    padding: DESIGN_TOKENS.spacing.md,
    paddingTop: DESIGN_TOKENS.spacing.sm,
  },
  contentSelectionMode: {
    paddingRight: DESIGN_TOKENS.spacing.md + 40,
  },
  noPhotoSelectionBadge: {
    position: 'absolute',
    top: DESIGN_TOKENS.spacing.sm,
    right: DESIGN_TOKENS.spacing.sm,
    width: 32,
    height: 32,
    borderRadius: DESIGN_TOKENS.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    zIndex: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  headerRowNarrow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 4,
  },
  headerMain: {
    flex: 1,
    minWidth: 0,
  },
  headerMainNarrow: {
    width: '100%',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 4,
    flexShrink: 0,
  },
  headerActionsNarrow: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  webActionButton: {
    width: 32,
    height: 32,
    borderRadius: DESIGN_TOKENS.radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundSecondary,
    ...(Platform.OS === 'web' ? ({
      cursor: 'pointer',
      transition: 'background-color 150ms ease, transform 100ms ease',
    } as any) : null),
  },
  name: {
    fontSize: 17,
    fontWeight: '600' as any,
    color: colors.text,
    lineHeight: 22,
    letterSpacing: 0,
  },
  description: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    marginBottom: 6,
    lineHeight: 18,
  },
  noPhotoMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  noPhotoColorDot: {
    width: 10,
    height: 10,
    borderRadius: DESIGN_TOKENS.radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badge: {
    backgroundColor: colors.backgroundTertiary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: DESIGN_TOKENS.radii.pill,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500' as any,
    color: colors.textMuted,
    letterSpacing: 0,
  },
  address: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: 8,
  },
  coordsText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    color: colors.textMuted,
    flex: 1,
    minWidth: 0,
    opacity: 0.8,
  },
  coordsActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    flexShrink: 0,
  },
  coordsActionsRowNarrow: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  noPhotoNavigationMenu: {
    marginTop: 8,
  },
  rating: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
    marginTop: 6,
  },
  driveInfoRow: {
    marginTop: 10,
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 10,
    marginHorizontal: -DESIGN_TOKENS.spacing.md,
    marginBottom: -DESIGN_TOKENS.spacing.md,
    backgroundColor: colors.primarySoft,
    borderTopWidth: 1,
    borderTopColor: colors.primaryAlpha30,
  },
  driveInfoText: {
    fontSize: 13,
    fontWeight: '500' as any,
    color: colors.primaryDark,
  },

  // No-photo inline category chip (kept for readability without an image).
  imageBadgeText: {
    fontSize: 11,
    fontWeight: '600' as any,
    color: DESIGN_COLORS.criticalTextLight,
    letterSpacing: 0.3,
  },
})
