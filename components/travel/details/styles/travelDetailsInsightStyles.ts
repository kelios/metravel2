import { DESIGN_TOKENS } from '@/constants/designSystem'
import { type ThemedColors } from '@/hooks/useTheme'

export const createTravelDetailsInsightStyles = (colors: ThemedColors) => ({
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
}) as const
