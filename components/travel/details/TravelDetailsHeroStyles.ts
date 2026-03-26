import { Platform, StyleSheet } from 'react-native'
import { useMemo } from 'react'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

const COMPACT_SECTION_DESKTOP = 24

export const getTravelDetailsHeroStyles = (colors: ThemedColors) =>
  StyleSheet.create({
    sectionContainer: {
      marginBottom: Platform.select({
        default: COMPACT_SECTION_DESKTOP + 8,
        web: COMPACT_SECTION_DESKTOP + 16,
      }),
      width: '100%',
    },
    contentStable: {
      minHeight: DESIGN_TOKENS.spacing.xxl,
    },
    quickFactsContainer: {
      marginBottom: DESIGN_TOKENS.spacing.xs,
    },
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
      minHeight: Platform.select({
        default: 34,
        web: 34,
      }),
      paddingVertical: 8,
      paddingHorizontal: Platform.select({
        default: 14,
        web: 16,
      }),
      borderRadius: DESIGN_TOKENS.radii.pill,
      borderWidth: 0,
      backgroundColor: colors.backgroundSecondary,
      marginRight: DESIGN_TOKENS.spacing.xs,
      marginBottom: DESIGN_TOKENS.spacing.xs,
      gap: 6,
      ...(Platform.OS === 'web'
        ? ({
            transition: 'background-color 0.2s ease, color 0.2s ease',
            cursor: 'pointer',
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
      lineHeight: 16,
    },
    authorCardContainer: {
      marginBottom: DESIGN_TOKENS.spacing.md,
    },
    sectionHeaderText: {
      fontSize: Platform.select({
        default: 18,
        web: 20,
      }),
      fontWeight: '600' as any,
      color: colors.text,
      letterSpacing: -0.2,
      lineHeight: Platform.select({
        default: 24,
        web: 26,
      }),
      flexShrink: 1,
    },
    sectionSubtitle: {
      fontSize: Platform.select({ default: 13, web: 14 }),
      color: colors.textMuted,
      marginTop: DESIGN_TOKENS.spacing.xs,
      lineHeight: Platform.select({ default: 20, web: 22 }),
    },
    sliderContainer: {
      width: '100%',
      borderRadius: DESIGN_TOKENS.radii.xl,
      overflow: 'hidden',
      marginBottom: 0,
      backgroundColor: Platform.OS === 'web' ? 'transparent' : colors.surfaceMuted,
      position: 'relative' as any,
      borderWidth: 1,
      borderColor: Platform.OS === 'web' ? 'rgba(255,255,255,0.12)' : 'transparent',
      ...(Platform.OS === 'web'
        ? ({
            boxShadow:
              '0 22px 60px rgba(16,24,40,0.18), 0 6px 18px rgba(16,24,40,0.1)',
          } as any)
        : {
            shadowColor: colors.text,
            shadowOpacity: 0.12,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 8 },
            elevation: 3,
          }),
    },
    heroOverlay: {
      position: 'absolute' as any,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 2,
      paddingHorizontal: Platform.select({ default: 16, web: 28 }),
      paddingBottom: Platform.select({ default: 20, web: 28 }),
      paddingTop: Platform.select({ default: 48, web: 72 }),
      ...(Platform.OS === 'web'
        ? ({
            backgroundImage:
              'linear-gradient(to top, rgba(7,12,19,0.82) 0%, rgba(7,12,19,0.34) 42%, transparent 72%)',
          } as any)
        : {}),
    },
    heroTitleWrap: {
      alignSelf: 'flex-start',
      maxWidth: Platform.select({ default: '100%', web: 760 }) as any,
    },
    heroTitle: {
      fontSize: Platform.select({ default: 26, web: 32 }),
      fontWeight: '700' as any,
      color: colors.textOnDark,
      letterSpacing: Platform.select({ default: -0.5, web: -0.7 }),
      lineHeight: Platform.select({ default: 32, web: 40 }),
      ...(Platform.OS === 'web'
        ? ({
            textShadow: '0 2px 16px rgba(0,0,0,0.52)',
          } as any)
        : {
            textShadowColor: 'rgba(0,0,0,0.7)',
            textShadowOffset: { width: 0, height: 2 },
            textShadowRadius: 6,
          }),
      maxWidth: Platform.select({ default: '100%', web: 720 }) as any,
    },
    heroFavoriteBtn: {
      position: 'absolute' as any,
      top: 14,
      right: 14,
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

export const useTravelDetailsHeroStyles = () => {
  const colors = useThemedColors()
  return useMemo(() => getTravelDetailsHeroStyles(colors), [colors])
}
