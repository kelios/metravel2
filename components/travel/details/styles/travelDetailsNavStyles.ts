import { Platform } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { type ThemedColors } from '@/hooks/useTheme'

import { COMPACT_SPACING, COMPACT_TYPOGRAPHY } from '../TravelDetailsStyleFragments'

export const createTravelDetailsNavStyles = (colors: ThemedColors) => ({
  quickJumpWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: DESIGN_TOKENS.spacing.xs,
    gap: 0,
  },
  quickJumpScroll: {
    flexGrow: 0,
  },
  quickJumpScrollContent: {
    paddingRight: DESIGN_TOKENS.spacing.md,
  },
  quickJumpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    // ✅ УЛУЧШЕНИЕ: Увеличенные touch targets (min 44x44)
    minHeight: 44,
    minWidth: 44,
    paddingVertical: Platform.select({
      default: 10, // увеличено с 8 для лучшего touch target
      web: 8,
    }),
    paddingHorizontal: Platform.select({
      default: 16, // увеличено с 14 для лучшего touch target
      web: 16,
    }),
    borderRadius: DESIGN_TOKENS.radii.pill,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: 'solid',
    backgroundColor: colors.surface,
    marginRight: DESIGN_TOKENS.spacing.xs,
    marginBottom: DESIGN_TOKENS.spacing.xs,
    gap: 6,
    ...(Platform.OS === 'web'
      ? ({
          transition: 'background-color 0.2s ease, color 0.2s ease, transform 0.15s ease',
          cursor: 'pointer',
          // ✅ УЛУЧШЕНИЕ: Микроинтеракция при hover
          ':hover': {
            backgroundColor: colors.primarySoft,
            transform: 'translateY(-1px)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          },
          ':active': {
            transform: 'translateY(0)',
          },
        } as any)
      : {}),
  },
  quickJumpChipPressed: {
    backgroundColor: colors.primarySoft,
  },
  quickJumpLabel: {
    fontSize: 13,
    fontWeight: '500' as any,
    color: colors.textMuted,
    letterSpacing: 0,
  },

  descriptionIntroWrapper: {
    marginBottom: COMPACT_SPACING.section.mobile + 4, // было lg (24px)
  },

  descriptionIntroText: {
    fontSize: COMPACT_TYPOGRAPHY.body.mobile,
    color: colors.textMuted,
    lineHeight: Platform.select({ default: 24, web: 24 }),
    letterSpacing: 0,
  },

  backToTopWrapper: {
    alignItems: 'center',
    paddingVertical: DESIGN_TOKENS.spacing.lg,
  },

  backToTopText: {
    fontSize: DESIGN_TOKENS.typography.sizes.sm,
    color: colors.textMuted,
  },

  navigationArrowsContainer: {
    marginBottom: DESIGN_TOKENS.spacing.xl,
  },

  authorCardContainer: {
    marginBottom: DESIGN_TOKENS.spacing.md,
  },

  shareButtonsContainer: {
    marginBottom: DESIGN_TOKENS.spacing.md,
  },
}) as const
