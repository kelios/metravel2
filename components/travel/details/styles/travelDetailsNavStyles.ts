import { Platform } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { type ThemedColors } from '@/hooks/useTheme'

import { COMPACT_SPACING, COMPACT_TYPOGRAPHY } from '../TravelDetailsStyleFragments'

// Чипы быстрых переходов рисует только hero-набор
// (`TravelHeroQuickJumps` → `useTravelDetailsHeroStyles`), поэтому их стили
// живут там же. Здесь был второй, ни разу не прочитанный комплект `quickJump*`:
// он расходился с hero по цвету подписи и touch target и снят целиком (#1704).
export const createTravelDetailsNavStyles = (colors: ThemedColors) => ({
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
