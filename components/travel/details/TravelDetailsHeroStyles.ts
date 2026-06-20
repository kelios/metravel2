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
    quickJumpStickyMobile: {
      ...(Platform.OS === 'web'
        ? ({
            position: 'sticky',
            top: 0,
            zIndex: 20,
            marginTop: 0,
            marginBottom: DESIGN_TOKENS.spacing.md,
            paddingTop: DESIGN_TOKENS.spacing.xs,
            paddingBottom: DESIGN_TOKENS.spacing.xs,
            backgroundColor: colors.background,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.borderLight,
          } as any)
        : {}),
    },
    quickJumpStickyNativeBar: {
      width: '100%',
      backgroundColor: colors.background,
      paddingTop: DESIGN_TOKENS.spacing.xs,
      paddingBottom: DESIGN_TOKENS.spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderLight,
    },
    quickJumpStickyNativeInner: {
      marginTop: 0,
      marginBottom: 0,
      width: '100%',
    },
    quickJumpScrollWrap: {
      position: 'relative' as any,
      width: '100%',
    },
    quickJumpScrollFade: {
      position: 'absolute' as any,
      top: 0,
      bottom: 0,
      right: 0,
      width: 28,
      zIndex: 2,
      pointerEvents: 'none' as any,
      ...(Platform.OS === 'web'
        ? ({
            backgroundImage: `linear-gradient(to right, rgba(255,255,255,0), ${colors.surface})`,
          } as any)
        : {}),
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
        default: 44,
        web: 44,
      }),
      paddingVertical: Platform.select({
        default: 10,
        web: 8,
      }),
      paddingHorizontal: Platform.select({
        default: 16,
        web: 16,
      }),
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: colors.borderLight,
      borderStyle: 'solid',
      backgroundColor: colors.surface,
      marginRight: DESIGN_TOKENS.spacing.xs,
      marginBottom: DESIGN_TOKENS.spacing.xs,
      gap: 8,
      ...(Platform.OS === 'web'
        ? ({
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            cursor: 'pointer',
            ':hover': {
              backgroundColor: colors.primarySoft,
              borderColor: colors.primary,
              transform: 'translateY(-1px)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            } as any,
          } as any)
        : {}),
    },
    quickJumpChipPressed: {
      backgroundColor: colors.primarySoft,
    },
    quickJumpChipPrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 6px 16px rgba(255,107,0,0.22)',
            ':hover': {
              backgroundColor: colors.primary,
              borderColor: colors.primary,
              transform: 'translateY(-1px)',
              boxShadow: '0 8px 20px rgba(255,107,0,0.28)',
            } as any,
          } as any)
        : {}),
    },
    quickJumpLabel: {
      fontSize: 13,
      fontWeight: '500' as any,
      color: colors.text,
      letterSpacing: 0,
      lineHeight: 18,
    },
    quickJumpLabelPrimary: {
      color: colors.textOnPrimary,
      fontWeight: '800' as any,
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
      letterSpacing: 0,
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
      borderRadius: DESIGN_TOKENS.radii.md,
      overflow: 'hidden',
      marginBottom: 0,
      backgroundColor: colors.surface,
      position: 'relative' as any,
      borderWidth: Platform.select({ default: 1, web: 1 }),
      borderColor: colors.borderLight,
      borderStyle: 'solid',
      ...(Platform.OS === 'web'
        ? ({
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          } as any)
        : {
            shadowColor: colors.text,
            shadowOpacity: 0.1,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 10 },
            elevation: 4,
          }),
    },
    heroFavoriteBtn: {
      position: 'absolute' as any,
      top: 14,
      right: 14,
      zIndex: 3,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0,0,0,0.45)',
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
