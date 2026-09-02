import { Platform } from 'react-native'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { type ThemedColors } from '@/hooks/useTheme'

export const createTravelDetailsHeroMediaStyles = (colors: ThemedColors) => ({
  heroOverlay: {
    position: 'absolute' as any,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    paddingHorizontal: Platform.select({ default: 16, web: 32 }),
    paddingBottom: Platform.select({ default: 24, web: 32 }),
    paddingTop: Platform.select({ default: 60, web: 80 }),
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage:
            'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.42) 30%, rgba(0,0,0,0.12) 60%, transparent 100%)',
        } as any)
      : {}),
  },
  heroTitle: {
    fontSize: Platform.select({ default: 26, web: 34 }),
    fontWeight: '700' as any,
    color: colors.textOnDark,
    letterSpacing: -0.5,
    lineHeight: Platform.select({ default: 32, web: 42 }),
    ...(Platform.OS === 'web'
      ? ({
          textShadow: '0 2px 16px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.3)',
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
