import { Platform } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { ThemedColors } from '@/hooks/useTheme'

export const HEADER_OFFSET_DESKTOP = 72
export const HEADER_OFFSET_MOBILE = 56

export const COMPACT_SPACING = {
  hero: {
    mobile: 14,
    desktop: 28,
  },
  section: {
    mobile: 12,
    desktop: 24,
  },
  card: {
    mobile: 10,
    desktop: 16,
  },
  margin: {
    section: 14,
    card: 8,
  },
} as const

export const COMPACT_TYPOGRAPHY = {
  title: {
    mobile: 22,
    desktop: 24,
  },
  subtitle: {
    mobile: 17,
    desktop: 19,
  },
  body: {
    mobile: 14,
    desktop: 15,
  },
  caption: {
    mobile: 12,
    desktop: 13,
  },
} as const

export const FLUID_TYPOGRAPHY = {
  hero: {
    minSize: 24,
    maxSize: 32,
  },
  h1: {
    minSize: 22,
    maxSize: 24,
  },
  h2: {
    minSize: 18,
    maxSize: 20,
  },
  body: {
    minSize: 14,
    maxSize: 16,
  },
} as const

export const createTravelDetailsHeroStyles = (colors: ThemedColors) => ({
  sliderContainer: {
    width: '100%',
    borderRadius: DESIGN_TOKENS.radii.xl,
    overflow: 'hidden',
    marginBottom: 0,
    backgroundColor: colors.surfaceMuted,
    position: 'relative' as any,
  },

  heroOverlay: {
    position: 'absolute' as any,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    paddingHorizontal: Platform.select({ default: 16, web: 28 }),
    paddingBottom: Platform.select({ default: 20, web: 28 }),
    paddingTop: Platform.select({ default: 60, web: 80 }),
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage:
            'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.35) 35%, rgba(0,0,0,0.1) 65%, transparent 100%)',
        } as any)
      : {}),
  },
  heroTitle: {
    fontSize: Platform.select({ default: 24, web: 30 }),
    fontWeight: '700' as any,
    color: colors.textOnDark,
    letterSpacing: -0.4,
    lineHeight: Platform.select({ default: 30, web: 38 }),
    ...(Platform.OS === 'web'
      ? ({
          textShadow: '0 2px 12px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.4)',
        } as any)
      : {
          textShadowColor: 'rgba(0,0,0,0.7)',
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 6,
        }),
  },
  heroMeta: {
    fontSize: Platform.select({ default: 14, web: 16 }),
    fontWeight: '500' as any,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 8,
    letterSpacing: 0.3,
    ...(Platform.OS === 'web'
      ? ({
          textShadow: '0 1px 6px rgba(0,0,0,0.4)',
        } as any)
      : {
          textShadowColor: 'rgba(0,0,0,0.4)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 3,
        }),
  },
  heroFavoriteBtn: {
    position: 'absolute' as any,
    top: Platform.select({ default: 14, web: 14 }),
    right: Platform.select({ default: 14, web: 14 }),
    zIndex: 3,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center' as any,
    justifyContent: 'center' as any,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          backdropFilter: 'blur(20px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(20px) saturate(1.8)',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          ':hover': {
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderColor: 'rgba(255,255,255,0.3)',
            transform: 'scale(1.08)',
          },
        } as any)
      : {}),
  },
  heroFavoriteBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 16px rgba(255,107,0,0.4)',
          ':hover': {
            backgroundColor: colors.primary,
            borderColor: colors.primary,
            transform: 'scale(1.08)',
            boxShadow: '0 6px 20px rgba(255,107,0,0.5)',
          },
        } as any)
      : {}),
  },
  heroFavoriteBtnMobile: {
    width: 'auto' as any,
    height: 'auto' as any,
    borderRadius: DESIGN_TOKENS.radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row' as any,
    gap: 6,
    minWidth: 44,
    minHeight: 44,
  },
  heroFavoriteBtnLabel: {
    fontSize: 13,
    fontWeight: '600' as any,
    color: colors.textOnDark,
    ...(Platform.OS === 'web'
      ? ({
          textShadow: '0 1px 4px rgba(0,0,0,0.4)',
        } as any)
      : {
          textShadowColor: 'rgba(0,0,0,0.4)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 3,
        }),
  },
  heroFavoriteBtnLabelActive: {
    color: colors.textOnPrimary,
  },
})

export const createTravelDetailsMobileInsightStyles = (colors: ThemedColors) => ({
  mobileInsightTabsWrapper: {
    backgroundColor: 'transparent',
    padding: 0,
    paddingTop: DESIGN_TOKENS.spacing.xs,
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  mobileInsightLabel: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  mobileInsightTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: 4,
  },
  mobileInsightChip: {
    flex: 1,
    alignItems: 'center' as const,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    gap: 6,
    minHeight: 44,
  },
  mobileInsightChipActive: {
    borderBottomColor: colors.primary,
  },
  mobileInsightChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textMuted,
  },
  mobileInsightChipTextActive: {
    color: colors.text,
    fontWeight: '600',
  },
  mobileInsightChipBadge: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textMuted,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden' as const,
  },
  mobileInsightChipBadgeActive: {
    color: colors.text,
    backgroundColor: colors.primarySoft,
  },
})

export const createTravelDetailsDecisionSummaryStyles = (
  colors: ThemedColors,
) => ({
  decisionSummaryBox: {
    marginBottom: DESIGN_TOKENS.spacing.xl,
    padding: Platform.select({
      default: DESIGN_TOKENS.spacing.lg,
      web: DESIGN_TOKENS.spacing.xl,
    }),
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.backgroundSecondary,
    ...(Platform.OS === 'web'
      ? ({
          transition: 'border-color 0.2s ease',
        } as any)
      : {}),
  },
  decisionSummaryTitle: {
    fontSize: Platform.select({ default: 20, web: 22 }),
    fontWeight: DESIGN_TOKENS.typography.weights.semibold as any,
    color: colors.text,
    marginBottom: DESIGN_TOKENS.spacing.sm,
  },
  decisionSummaryList: {
    gap: DESIGN_TOKENS.spacing.md,
  },
  decisionSummaryBulletRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: DESIGN_TOKENS.spacing.sm,
  },
  decisionSummaryBulletIcon: {
    width: 20,
    marginTop: DESIGN_TOKENS.spacing.xxs,
    opacity: 0.75,
  },
  decisionSummaryBulletText: {
    flex: 1,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    lineHeight: Platform.select({ default: 28, web: 26 }),
    color: colors.text,
    fontWeight: DESIGN_TOKENS.typography.weights.regular as any,
  },
  decisionSummarySubBulletRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: DESIGN_TOKENS.spacing.sm,
    paddingLeft: DESIGN_TOKENS.spacing.sm + DESIGN_TOKENS.spacing.xs,
  },
  decisionSummarySubBulletIcon: {
    width: 20,
    marginTop: DESIGN_TOKENS.spacing.xs,
    opacity: 0.6,
  },
  decisionSummarySubBulletText: {
    flex: 1,
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    lineHeight: Platform.select({ default: 24, web: 22 }),
    color: colors.text,
    opacity: 0.9,
    fontWeight: DESIGN_TOKENS.typography.weights.regular as any,
  },
  decisionSummaryBadge: {
    paddingHorizontal: DESIGN_TOKENS.spacing.sm,
    paddingVertical: DESIGN_TOKENS.spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
  },
  decisionSummaryBadgeInfo: {
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.border,
  },
  decisionSummaryBadgePositive: {
    backgroundColor: colors.successSoft,
    borderColor: colors.successLight,
  },
  decisionSummaryBadgeNegative: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerLight,
  },
  decisionSummaryBadgeText: {
    fontSize: 14,
    fontWeight: '800' as any,
    letterSpacing: 0.2,
  },
  decisionSummaryBadgeTextInfo: {
    color: colors.text,
  },
  decisionSummaryBadgeTextPositive: {
    color: colors.successDark,
  },
  decisionSummaryBadgeTextNegative: {
    color: colors.dangerDark,
  },
  decisionSummaryText: {
    flex: 1,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    lineHeight: Platform.select({ default: 24, web: 22 }),
    color: colors.text,
    fontWeight: DESIGN_TOKENS.typography.weights.medium,
  },
})

export const createTravelDetailsStatusStyles = (colors: ThemedColors) => ({
  errorContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    paddingVertical: DESIGN_TOKENS.spacing.xl + DESIGN_TOKENS.spacing.xs,
  },
  errorTitle: {
    fontSize: DESIGN_TOKENS.typography.sizes.lg,
    fontWeight: '600',
    color: colors.text,
    marginTop: DESIGN_TOKENS.spacing.lg,
    marginBottom: DESIGN_TOKENS.spacing.xs,
    textAlign: 'center' as const,
  },
  errorText: {
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    color: colors.textMuted,
    textAlign: 'center' as const,
    marginBottom: DESIGN_TOKENS.spacing.xl,
    lineHeight: 24,
  },
  errorButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: DESIGN_TOKENS.spacing.xl,
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    borderRadius: 8,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  errorButtonText: {
    color: colors.textOnPrimary,
    fontSize: DESIGN_TOKENS.typography.sizes.md,
    fontWeight: '600',
  },
  loadingSkeletonWrap: {
    width: '100%' as any,
  },
  loadingSkeletonHero: {
    height: 260,
    margin: DESIGN_TOKENS.spacing.md,
    borderRadius: DESIGN_TOKENS.radii.md,
    backgroundColor: colors.backgroundSecondary,
  },
  loadingSkeletonContent: {
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
  },
  loadingSkeletonSpacer: {
    height: DESIGN_TOKENS.spacing.md,
  },
})
