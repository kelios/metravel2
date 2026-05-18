import { Platform, StyleSheet } from 'react-native'
import { useMemo } from 'react'

import { DESIGN_TOKENS } from '@/constants/designSystem'
import { useThemedColors, type ThemedColors } from '@/hooks/useTheme'

const COMPACT_SECTION_DESKTOP = 24
const JOURNAL_FONT_FAMILY =
  "'Georgia', 'Times New Roman', 'Inter', serif"

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
        default: 44,
        web: 38,
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
      borderColor: colors.borderStrong,
      borderStyle: 'solid',
      backgroundColor: colors.surface,
      marginRight: DESIGN_TOKENS.spacing.xs,
      marginBottom: DESIGN_TOKENS.spacing.xs,
      gap: 8,
      ...(Platform.OS === 'web'
        ? ({
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            cursor: 'pointer',
            boxShadow: `0 1px 0 ${colors.primarySoft}`,
            ':hover': {
              backgroundColor: colors.primarySoft,
              borderColor: colors.primary,
              transform: 'translateY(-1px)',
              boxShadow: `0 2px 0 ${colors.brandSoft}`,
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
      ...(Platform.OS === 'web'
        ? ({
            fontFamily: JOURNAL_FONT_FAMILY,
            fontStyle: 'italic',
          } as any)
        : {}),
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
      ...(Platform.OS === 'web'
        ? ({
            fontFamily: JOURNAL_FONT_FAMILY,
            fontStyle: 'italic',
          } as any)
        : {}),
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
      borderWidth: Platform.select({ default: 1, web: 10 }),
      borderColor: colors.borderStrong,
      borderStyle: 'solid',
      ...(Platform.OS === 'web'
        ? ({
            boxShadow:
              `0 0 0 1px ${colors.borderLight}, 0 14px 34px rgba(45, 45, 45, 0.08), 10px 10px 0 ${colors.brandSoft}`,
          } as any)
        : {
            shadowColor: colors.text,
            shadowOpacity: 0.1,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 10 },
            elevation: 4,
          }),
    },
    heroSketchOverlay: {
      position: 'absolute' as any,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 1,
      pointerEvents: 'none' as any,
      ...(Platform.OS === 'web'
        ? ({
            backgroundImage:
              'repeating-linear-gradient(108deg, rgba(255,255,255,0.04) 0, rgba(255,255,255,0.04) 1px, transparent 1px, transparent 7px), repeating-linear-gradient(0deg, rgba(42,42,42,0.035) 0, rgba(42,42,42,0.035) 1px, transparent 1px, transparent 11px)',
            mixBlendMode: 'soft-light',
          } as any)
        : {}),
    },
    heroPhotoTapeLeft: {
      position: 'absolute' as any,
      top: Platform.select({ default: 10, web: 12 }),
      left: Platform.select({ default: 18, web: 22 }),
      zIndex: 6,
      width: Platform.select({ default: 64, web: 78 }),
      height: Platform.select({ default: 18, web: 20 }),
      borderRadius: 4,
      backgroundColor: colors.brandSoft,
      opacity: 0.78,
      transform: [{ rotate: '-4deg' }],
      pointerEvents: 'none' as any,
    },
    heroPhotoTapeRight: {
      position: 'absolute' as any,
      top: Platform.select({ default: 10, web: 12 }),
      right: Platform.select({ default: 54, web: 66 }),
      zIndex: 6,
      width: Platform.select({ default: 58, web: 72 }),
      height: Platform.select({ default: 18, web: 20 }),
      borderRadius: 4,
      backgroundColor: colors.primarySoft,
      opacity: 0.72,
      transform: [{ rotate: '5deg' }],
      pointerEvents: 'none' as any,
    },
    heroOverlay: {
      position: 'absolute' as any,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 2,
      paddingHorizontal: Platform.select({ default: 16, web: 40 }),
      paddingBottom: Platform.select({ default: 24, web: 40 }),
      paddingTop: Platform.select({ default: 56, web: 80 }),
      ...(Platform.OS === 'web'
        ? ({
            backgroundImage:
              'linear-gradient(to top, rgba(7,12,19,0.72) 0%, rgba(7,12,19,0.44) 34%, rgba(7,12,19,0.14) 64%, transparent 84%)',
          } as any)
        : { backgroundColor: 'rgba(7,12,19,0.45)' }),
    },
    heroTitleWrap: {
      alignSelf: 'flex-start',
      maxWidth: Platform.OS === 'web' ? 720 : '92%',
      backgroundColor: colors.surfaceMuted,
      borderRadius: DESIGN_TOKENS.radii.sm,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      paddingHorizontal: Platform.select({ default: 12, web: 16 }),
      paddingVertical: Platform.select({ default: 9, web: 12 }),
      ...(Platform.OS === 'web'
        ? ({
            backdropFilter: 'blur(6px)',
            boxShadow: `0 2px 0 ${colors.brandSoft}`,
          } as any)
        : {}),
    },
    heroTitle: {
      fontSize: Platform.select({ default: 18, web: 28 }),
      fontWeight: '600' as any,
      color: colors.text,
      letterSpacing: 0,
      lineHeight: Platform.select({ default: 24, web: 36 }),
      ...(Platform.OS === 'web'
        ? ({
            fontFamily: JOURNAL_FONT_FAMILY,
            fontStyle: 'italic',
            textShadow: 'none',
          } as any)
        : {
            textShadowColor: 'transparent',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 0,
          }),
      maxWidth: Platform.OS === 'web' ? 680 : '100%',
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
