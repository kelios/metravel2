import { Platform } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { type ThemedColors } from '@/hooks/useTheme'

export const createTravelDetailsSectionHeaderStyles = (colors: ThemedColors) => ({
  // ✅ РЕДИЗАЙН: Современные карточки с улучшенными тенями
  // ✅ РЕДИЗАЙН: Унифицированные карточки с единой системой радиусов (12px)
  sectionHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Platform.select({
      default: 14,
      web: 16,
    }),
    paddingHorizontal: Platform.select({
      default: 16,
      web: 20,
    }),
    backgroundColor: colors.surface,
    borderRadius: DESIGN_TOKENS.radii.sm,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: 'solid',
    minHeight: 56,
    ...(Platform.OS === 'web'
      ? ({
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          cursor: 'pointer',
          ':hover': {
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.primary,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            transform: 'translateY(-1px)',
          } as any,
        } as any)
      : {}),
  },
  sectionHeaderPositive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  sectionHeaderNegative: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
  },
  sectionHeaderInfo: {
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
  },
  sectionHeaderActive: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  sectionHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    flexShrink: 1,
    flexGrow: 1,
  },

  sectionHeaderIcon: {
    width: Platform.select({ default: 28, web: 30 }),
    height: Platform.select({ default: 28, web: 30 }),
    borderRadius: Platform.select({ default: 8, web: 8 }),
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: 'solid',
  },
  sectionHeaderCover: {
    width: Platform.select({ default: 52, web: 56 }),
    height: Platform.select({ default: 52, web: 56 }),
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: 'solid',
    flexShrink: 0,
  },
  sectionHeaderCoverImage: {
    width: '100%',
    height: '100%',
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
    flexShrink: 0,
  },
  sectionHeaderBadge: {
    fontSize: 12,
    fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
    color: colors.textMuted,
    backgroundColor: colors.brandLight,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.xxs,
    borderRadius: DESIGN_TOKENS.radii.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: 'solid',
    flexShrink: 0,
  },

  sectionHeaderText: {
    fontSize: Platform.select({
      default: 18,
      web: 20,
    }),
    fontWeight: '600' as any,
    color: colors.text,
    letterSpacing: 0,
    lineHeight: Platform.select({
      default: 24,
      web: 26,
    }),
    flexShrink: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.sm,
  },
  pointsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: DESIGN_TOKENS.spacing.md,
    flexWrap: 'wrap',
  },
  pointsExportWrap: {
    alignItems: 'flex-end',
    gap: DESIGN_TOKENS.spacing.xxs,
    flexShrink: 1,
  },
  pointsExportActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DESIGN_TOKENS.spacing.xs,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    flexShrink: 0,
  },
  pointsExportButton: {
    minHeight: 44,
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    ...Platform.select({
      web: {
        boxShadow: 'none',
      },
    }),
  },
  pointsExportButtonText: {
    fontSize: 12,
    color: colors.text,
  },
  pointsExportHint: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
    textAlign: 'right',
  },
  sectionSubtitle: {
    fontSize: Platform.select({ default: 13, web: 14 }),
    color: colors.textMuted,
    marginTop: DESIGN_TOKENS.spacing.xs,
    lineHeight: Platform.select({ default: 20, web: 22 }),
  },
  excursionsWidgetCard: {
    borderRadius: DESIGN_TOKENS.radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: 'solid',
    backgroundColor: colors.surface,
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }
      : colors.shadows.light),
  },
}) as const
