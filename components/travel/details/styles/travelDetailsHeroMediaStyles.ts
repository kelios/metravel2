import { Platform } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { type ThemedColors } from '@/hooks/useTheme'

export const createTravelDetailsHeroMediaStyles = (colors: ThemedColors) => ({
  videoContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: DESIGN_TOKENS.radii.md,
    overflow: 'hidden',
    backgroundColor: colors.text,
  },

  playOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: DESIGN_TOKENS.spacing.lg,
    backgroundColor: colors.overlay,
  },
  neutralActionButton: {
    alignSelf: 'flex-start',
    paddingVertical: DESIGN_TOKENS.spacing.sm,
    paddingHorizontal: DESIGN_TOKENS.spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundSecondary,
  },
  neutralActionButtonPressed: {
    opacity: 0.92,
    backgroundColor: colors.backgroundTertiary,
  },
  neutralActionButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600' as any,
  },
  videoHintText: {
    color: colors.textOnDark,
    fontSize: 14,
    marginTop: DESIGN_TOKENS.spacing.sm,
    textAlign: 'center',
    fontWeight: DESIGN_TOKENS.typography.weights.medium as any,
  },

  descriptionContainer: {
    width: '100%',
    backgroundColor: 'transparent',
    borderRadius: 0,
    padding: Platform.select({
      default: 0,
      web: 0,
    }),
    paddingTop: Platform.select({
      default: 4,
      web: 8,
    }),
    borderWidth: 0,
    borderColor: 'transparent',
  },
}) as const
