// components/home/homeHeroStyles/ctaStyles.ts
import { Platform } from 'react-native'
import { DESIGN_TOKENS } from '@/constants/designSystem'

import type { HeroStyleContext } from './context'

export const createCtaStyles = (ctx: HeroStyleContext) => {
  const {
    colors,
    isMobile,
    showSideSlider,
    stackHeroButtons,
    isCompactBookLayout,
    isVeryCompactBookLayout,
    sansSerif,
    editorialSerif,
    warmBgSoft,
    cardSurface,
    warmBorder,
    warmShadow,
    inkStrong,
    inkMuted,
  } = ctx

  return {
    buttonsContainer: {
      flexDirection: stackHeroButtons ? 'column' : 'row',
      justifyContent: 'flex-start',
      alignItems: stackHeroButtons ? 'stretch' : 'center',
      gap: isMobile ? 10 : 10,
      width: '100%',
      flexWrap: 'nowrap',
      flexShrink: 0,
      marginTop: isMobile ? 8 : showSideSlider ? 0 : 12,
      ...Platform.select({
        web: showSideSlider
          ? ({
              alignSelf: 'start',
            } as any)
          : {},
      }),
    },
    primaryButton: {
      paddingHorizontal: isMobile
        ? 22
        : showSideSlider
          ? isCompactBookLayout
            ? 20
            : 24
          : 24,
      paddingVertical: isMobile
        ? 12
        : showSideSlider
          ? isCompactBookLayout
            ? 8
            : 10
          : 12,
      minHeight: isMobile ? 46 : 44,
      borderRadius: DESIGN_TOKENS.radii.md,
      width: stackHeroButtons ? '100%' : undefined,
      ...Platform.select({
        web: {
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: colors.boxShadows.light,
        } as any,
      }),
    },
    primaryButtonHover: {
      backgroundColor: colors.primaryDark,
      ...Platform.select({
        web: {
          transform: 'translateY(-1px)',
          boxShadow: colors.boxShadows.medium,
        } as any,
      }),
    },
    primaryButtonText: {
      fontSize: isMobile ? 15 : isCompactBookLayout ? 15 : 15,
      fontWeight: '600',
      color: colors.textOnPrimary,
      letterSpacing: 0.1,
      ...Platform.select({ web: { fontFamily: sansSerif } as any }),
    },
    secondaryButton: {
      paddingHorizontal: isMobile
        ? 20
        : showSideSlider
          ? isCompactBookLayout
            ? 20
            : 24
          : 24,
      paddingVertical: isMobile
        ? 12
        : showSideSlider
          ? isCompactBookLayout
            ? 8
            : 10
          : 12,
      minHeight: isMobile ? 46 : 44,
      borderRadius: DESIGN_TOKENS.radii.md,
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colors.border,
      width: stackHeroButtons ? '100%' : undefined,
      ...Platform.select({
        web: {
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: 'none',
        } as any,
      }),
    },
    secondaryButtonHover: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryAlpha30,
      ...Platform.select({
        web: {
          transform: 'translateY(-1px)',
        } as any,
      }),
    },
    secondaryButtonText: {
      fontSize: isCompactBookLayout ? 14 : 15,
      fontWeight: '600',
      color: colors.text,
      ...Platform.select({
        web: { fontFamily: editorialSerif, letterSpacing: '0.01em' } as any,
      }),
    },
    singleCtaButton: {
      width: stackHeroButtons ? '100%' : undefined,
      alignSelf: stackHeroButtons ? 'stretch' : 'flex-start',
    },

    // -- Bookmark rail (desktop left page inline mood cards) --
    // Horizontal pills layout — simpler, cleaner
    bookmarkRail: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: showSideSlider ? 7 : 6,
      alignItems: 'center',
      alignContent: 'flex-start',
      overflow: 'hidden',
      marginTop: isCompactBookLayout ? 8 : 14,
    },
    bookmarkChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 15,
      paddingVertical: isVeryCompactBookLayout ? 7 : 9,
      borderRadius: DESIGN_TOKENS.radii.pill,
      borderWidth: 1,
      borderColor: warmBorder,
      backgroundColor: 'rgba(255,252,245,0.88)',
      flexBasis: 'auto',
      maxWidth: 'none' as any,
      flexShrink: 0,
      minWidth: 0,
      minHeight: 44,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'background-color 0.15s ease, border-color 0.15s ease',
          boxShadow: '0 1px 0 rgba(120,96,62,0.08)',
        } as any,
      }),
    },
    bookmarkChipAccent: {
      width: 0,
      height: 0,
    },
    bookmarkChipHover: {
      backgroundColor: cardSurface,
      borderColor: colors.brand,
      ...Platform.select({ web: {} }),
    },
    bookmarkChipIcon: {
      width: 0,
      height: 0,
    },

    // -- Mood chips (mobile horizontal scroll) --
    moodChipsContainer: {
      marginTop: showSideSlider ? 24 : 20,
      paddingTop: 18,
      borderTopWidth: showSideSlider ? 0 : 1,
      borderTopColor: warmBorder,
      width: '100%',
    },
    moodChipsScrollContent: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 0,
      justifyContent: 'flex-start',
      flexWrap: 'nowrap' as const,
      ...Platform.select({
        web: {
          minWidth: 'max-content',
          paddingBottom: 4,
        } as any,
      }),
    },
    moodChipsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      width: '100%',
    },
    moodChipWrapItem: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: '44%',
      minWidth: 140,
    },
    moodChip: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      gap: 10,
      paddingHorizontal: 20,
      paddingVertical: 13,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: cardSurface,
      borderWidth: 1.5,
      borderColor: warmBorder,
      ...(Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 8px rgba(120,96,62,0.06)',
        } as any,
      }) as any),
    },
    moodChipHover: {
      backgroundColor: warmBgSoft,
      borderColor: colors.brand,
      ...Platform.select({
        web: {
          transform: 'translateY(-1px)',
          boxShadow: '0 4px 12px rgba(120,96,62,0.12)',
        } as any,
      }),
    },
    moodChipAccent: { width: 0, height: 0 },
    moodChipIcon: {
      width: 0,
      height: 0,
    },
    moodChipText: { gap: 0 },
    moodChipTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: inkStrong,
      letterSpacing: -0.12,
      lineHeight: 22,
      ...Platform.select({ web: { fontFamily: editorialSerif } as any }),
    },
    moodChipMeta: {
      fontSize: 10,
      fontWeight: '400',
      color: inkMuted,
      letterSpacing: 0.05,
      lineHeight: 14,
      ...Platform.select({ web: { fontFamily: sansSerif } as any }),
    },

    // -- Popular section (mobile) --
    popularSection: { marginTop: isMobile ? 32 : 40, width: '100%' },
    popularTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 18,
    },
    popularTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1.6,
      ...Platform.select({ web: { fontFamily: sansSerif } as any }),
    },
    popularSeeAll: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 8,
      paddingVertical: 4,
      ...Platform.select({
        web: {
          cursor: 'pointer',
        } as any,
      }),
    },
    popularSeeAllText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primaryText,
      ...Platform.select({ web: { fontFamily: sansSerif } as any }),
    },
    popularPreviewRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      gap: 16,
      overflow: 'hidden',
      width: '100%',
      paddingBottom: 4,
    },
    popularScrollContent: {
      flexDirection: 'row',
      gap: 16,
      paddingRight: 16,
      ...Platform.select({
        web: {
          minWidth: 'max-content',
          paddingBottom: 4,
        } as any,
      }),
    },
    popularGrid: {
      width: '100%',
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 14,
      alignItems: 'stretch',
    },

    // -- Featured card (mobile hero image) --
    featuredCard: {
      width: '100%',
      borderRadius: 24,
      overflow: 'hidden',
      backgroundColor: cardSurface,
      borderWidth: 0,
      borderColor: 'transparent',
      marginBottom: 28,
      position: 'relative' as const,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: `0 8px 32px ${warmShadow}, 0 2px 8px rgba(120,90,50,0.08)`,
        } as any,
      }),
    },
    featuredCardHover: {
      ...Platform.select({
        web: {
          transform: 'translateY(-4px) scale(1.005)',
          boxShadow: `0 16px 48px rgba(120,90,50,0.18), 0 4px 12px rgba(120,90,50,0.12)`,
          borderColor: 'transparent',
        } as any,
      }),
    },
    featuredCardImage: { width: '100%', aspectRatio: 16 / 9 },
    featuredCardOverlay: {
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 24,
      paddingVertical: 22,
      paddingTop: 64,
      ...Platform.select({
        web: {
          backgroundImage:
            'linear-gradient(to top, rgba(12,10,8,0.94) 0%, rgba(12,10,8,0.60) 45%, rgba(12,10,8,0.20) 70%, transparent 100%)',
        } as any,
      }),
    },
    featuredCardTitle: {
      fontSize: isMobile ? 20 : 24,
      fontWeight: '700',
      color: colors.textOnDark,
      marginBottom: 6,
      letterSpacing: -0.4,
      ...Platform.select({
        web: {
          fontFamily: editorialSerif,
          textShadow: '0 2px 12px rgba(0,0,0,0.4)',
        } as any,
      }),
    },
    featuredCardSubtitle: {
      fontSize: isMobile ? 13 : 14,
      fontWeight: '400',
      color: 'rgba(255,255,255,0.85)',
      letterSpacing: 0.3,
      ...Platform.select({ web: { fontFamily: editorialSerif } as any }),
    },

    // -- Image card (horizontal scroll items) --
    imageCard: {
      width: isMobile ? 210 : 240,
      borderRadius: 18,
      backgroundColor: cardSurface,
      borderWidth: 0,
      borderColor: 'transparent',
      overflow: 'hidden',
      ...Platform.select({
        web: {
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          cursor: 'pointer',
          boxShadow: `0 4px 16px ${warmShadow}, 0 1px 4px rgba(120,90,50,0.06)`,
        } as any,
      }),
    },
    imageCardGrid: {
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: 'auto',
      minWidth: 0,
      maxWidth: '100%',
    },
    imageCardHover: {
      ...Platform.select({
        web: {
          transform: 'translateY(-4px) scale(1.02)',
          boxShadow: `0 12px 36px rgba(120,90,50,0.14), 0 4px 12px rgba(120,90,50,0.08)`,
          borderColor: 'transparent',
        } as any,
      }),
    },
    imageCardImage: {
      width: isMobile ? 210 : 240,
      height: isMobile ? 140 : 165,
    },
    imageCardContent: { padding: 16, gap: 6 },
    imageCardTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      lineHeight: 20,
      letterSpacing: -0.2,
      ...Platform.select({ web: { fontFamily: editorialSerif } as any }),
    },
    imageCardSubtitle: {
      fontSize: 13,
      fontWeight: '400',
      color: colors.textMuted,
      lineHeight: 18,
      ...Platform.select({ web: { fontFamily: sansSerif } as any }),
    },
  } as const
}
