import { Platform } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { ThemedColors } from '@/hooks/useTheme'

/**
 * Константы наборов стилей детали путешествия объявляются ТОЛЬКО здесь.
 *
 * Смещение шапки читает `TravelDetailsShellStyles` (боковое меню на web) и
 * через него `useTravelDetailsLayout`; журнальный шрифт — тот же shell-набор и
 * `components/travel/CTASection`. До #1712 каждый из них объявлял свою копию:
 * значения совпадали, поэтому правка одной копии не меняла экран целиком и
 * искать причину пришлось бы не там. Инвариант держит гейт
 * `travelDetailsStyleKeyOwnership` — он сверяет не только ключи объектов
 * стилей, но и объявления констант в модулях наборов.
 */
export const HEADER_OFFSET_DESKTOP = 72
export const HEADER_OFFSET_MOBILE = 56
export const JOURNAL_FONT_FAMILY =
  "'Georgia', 'Times New Roman', 'Inter', serif"

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
