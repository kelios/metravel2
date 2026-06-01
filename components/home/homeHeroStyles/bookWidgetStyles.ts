// components/home/homeHeroStyles/bookWidgetStyles.ts
import { Platform } from 'react-native'

import type { HeroStyleContext } from './context'

export const createBookWidgetStyles = (ctx: HeroStyleContext) => {
  const {
    colors,
    isMobile,
    isNarrowLayout,
    viewportWidth,
    isTabletLayout,
    serif,
    sansSerif,
    editorialSerif,
    warmBgSoft,
    cardSurface,
    warmBorder,
    warmShadow,
    warmGold,
    inkStrong,
    inkMuted,
  } = ctx

  return {
    openBookContainer: {
      width: '100%',
      marginTop: isMobile ? 8 : isTabletLayout ? 16 : 12,
      position: 'relative' as const,
    },
    openBook: {
      flexDirection: 'row' as const,
      width: '100%',
      position: 'relative' as const,
      borderRadius: isMobile ? 12 : 16,
      overflow: 'hidden' as const,
      backgroundColor: cardSurface,
      ...Platform.select({
        web: {
          boxShadow: `0 4px 24px ${warmShadow}`,
        } as any,
      }),
    },
    // -- Tablet layout (770-1279px): side-by-side hero --
    tabletHeroRow: {
      flexDirection: 'row' as const,
      alignItems: 'stretch' as const,
      gap: 32,
      width: '100%',
    },
    tabletHeroLeft: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center' as const,
      gap: 20,
    },
    tabletHeroRight: {
      width: viewportWidth >= 1000 ? '45%' : '42%',
      flexShrink: 0,
      borderRadius: 20,
      overflow: 'hidden' as const,
      ...Platform.select({
        web: {
          boxShadow: `0 8px 32px ${warmShadow}, 0 2px 8px rgba(120,90,50,0.08)`,
        } as any,
      }),
    },
    tabletFeaturedImage: {
      width: '100%',
      height: '100%',
      minHeight: viewportWidth >= 1000 ? 340 : 280,
    },
    tabletFeaturedOverlay: {
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 20,
      paddingVertical: 18,
      paddingTop: 48,
      ...Platform.select({
        web: {
          backgroundImage:
            'linear-gradient(to top, rgba(12,10,8,0.92) 0%, rgba(12,10,8,0.55) 50%, rgba(12,10,8,0.15) 75%, transparent 100%)',
        } as any,
      }),
    },
    tabletFeaturedTitle: {
      fontSize: 22,
      fontWeight: '700' as const,
      color: colors.textOnDark,
      marginBottom: 4,
      letterSpacing: -0.3,
      ...Platform.select({
        web: {
          fontFamily: editorialSerif,
          textShadow: '0 2px 10px rgba(0,0,0,0.35)',
        } as any,
      }),
    },
    tabletFeaturedSubtitle: {
      fontSize: 13,
      fontWeight: '400' as const,
      color: 'rgba(255,255,255,0.85)',
      letterSpacing: 0.2,
      ...Platform.select({ web: { fontFamily: editorialSerif } as any }),
    },
    // Compact feature grid for tablet (2x2 grid)
    tabletFeatureGrid: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: 10,
      marginTop: 8,
    },
    tabletFeatureCard: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: cardSurface,
      borderWidth: 1,
      borderColor: warmBorder,
      width: viewportWidth >= 900 ? 'calc(50% - 5px)' : '100%',
      ...Platform.select({
        web: {
          transition: 'all 0.2s ease',
          boxShadow: '0 1px 4px rgba(120,96,62,0.06)',
          cursor: 'pointer',
        } as any,
      }),
    },
    tabletFeatureCardHover: {
      backgroundColor: warmBgSoft,
      borderColor: 'rgba(180,160,130,0.3)',
      ...Platform.select({
        web: {
          transform: 'translateY(-1px)',
          boxShadow: '0 4px 12px rgba(120,96,62,0.1)',
        } as any,
      }),
    },
    tabletFeatureIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: colors.primary,
      ...Platform.select({
        web: {
          boxShadow: `0 2px 6px ${colors.primary}20`,
        } as any,
      }),
    },
    tabletFeatureTextWrap: {
      flex: 1,
      gap: 2,
    },
    tabletFeatureTitle: {
      fontSize: 14,
      fontWeight: '600' as const,
      color: inkStrong,
      letterSpacing: -0.1,
      ...Platform.select({ web: { fontFamily: sansSerif } as any }),
    },
    tabletFeatureSubtitle: {
      fontSize: 12,
      fontWeight: '400' as const,
      color: inkMuted,
      ...Platform.select({ web: { fontFamily: sansSerif } as any }),
    },
    bookCover: {
      position: 'absolute' as const,
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      borderRadius: isMobile ? 12 : 16,
      zIndex: -1,
    },
    bookSpine: {
      position: 'absolute' as const,
      left: '50%',
      top: 0,
      bottom: 0,
      width: 2,
      backgroundColor: 'transparent',
      zIndex: 5,
      ...Platform.select({
        web: {
          marginLeft: -1,
          backgroundImage: `linear-gradient(90deg, rgba(0,0,0,0.04) 0%, rgba(140,100,50,0.12) 50%, rgba(0,0,0,0.04) 100%)`,
        } as any,
      }),
    },
    bookSpineShadowLeft: {
      position: 'absolute' as const,
      right: 0,
      top: 0,
      bottom: 0,
      width: isMobile ? 28 : 40,
      zIndex: 2,
      pointerEvents: 'none' as const,
      ...Platform.select({
        web: {
          backgroundImage:
            'linear-gradient(to left, rgba(0,0,0,0.06) 0%, transparent 100%)',
        } as any,
      }),
    },
    bookSpineShadowRight: {
      position: 'absolute' as const,
      left: 0,
      top: 0,
      bottom: 0,
      width: isMobile ? 28 : 40,
      zIndex: 2,
      pointerEvents: 'none' as const,
      ...Platform.select({
        web: {
          backgroundImage:
            'linear-gradient(to right, rgba(0,0,0,0.06) 0%, transparent 100%)',
        } as any,
      }),
    },
    bookPage: {
      flex: 1,
      padding: isMobile ? 14 : 20,
      gap: isMobile ? 10 : 14,
      position: 'relative' as const,
      minHeight: isMobile ? 100 : 120,
      backgroundColor: cardSurface,
      ...Platform.select({
        web: {
          transition: 'box-shadow 0.3s ease',
        } as any,
      }),
    },
    bookPageLeft: {
      borderRightWidth: 0,
      ...Platform.select({
        web: {
          borderTopLeftRadius: isMobile ? 12 : 16,
          borderBottomLeftRadius: isMobile ? 12 : 16,
        } as any,
      }),
    },
    bookPageRight: {
      borderLeftWidth: 0,
      ...Platform.select({
        web: {
          borderTopRightRadius: isMobile ? 12 : 16,
          borderBottomRightRadius: isMobile ? 12 : 16,
        } as any,
      }),
    },
    bookPageCurl: {
      position: 'absolute' as const,
      bottom: 0,
      width: 0,
      height: 0,
      zIndex: 3,
    },
    bookPageCurlLeft: { left: 0 },
    bookPageCurlRight: { right: 0 },
    bookPageGoldLine: {
      position: 'absolute' as const,
      top: 0,
      left: isMobile ? 14 : 20,
      right: isMobile ? 14 : 20,
      height: 1,
      zIndex: 4,
      ...Platform.select({
        web: {
          backgroundImage: `linear-gradient(90deg, transparent 0%, ${warmGold} 20%, ${warmGold} 80%, transparent 100%)`,
        } as any,
      }),
    },

    // -- Highlights (open book mini widget items) --
    highlightsGrid: {
      flexDirection: isNarrowLayout ? 'column' : 'row',
      gap: 10,
      width: '100%',
      marginTop: 8,
    },
    highlightCard: {
      flex: isMobile ? undefined : 1,
      minWidth: 0,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: warmBorder,
      backgroundColor: cardSurface,
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 8,
      ...Platform.select({
        web: {
          transition: 'all 0.2s ease',
          boxShadow: `0 1px 6px ${warmShadow}`,
        } as any,
      }),
    },
    bookHighlightItem: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: isMobile ? 10 : 12,
      paddingVertical: isMobile ? 10 : 12,
      paddingHorizontal: isMobile ? 12 : 16,
      borderRadius: 12,
      backgroundColor: warmBgSoft,
      borderWidth: 1,
      borderColor: warmBorder,
      ...Platform.select({
        web: {
          transition: 'all 0.2s ease',
        } as any,
      }),
    },
    bookHighlightItemHover: {
      backgroundColor: cardSurface,
      borderColor: 'rgba(180,160,130,0.25)',
      ...Platform.select({
        web: {
          transform: 'translateX(3px)',
          boxShadow: `0 2px 12px ${warmShadow}`,
        } as any,
      }),
    },
    highlightIconWrap: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      ...Platform.select({
        web: { boxShadow: `0 2px 8px ${colors.primary}25` },
      }),
    },
    bookHighlightIconWrap: {
      width: isMobile ? 30 : 34,
      height: isMobile ? 30 : 34,
      borderRadius: 10,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: colors.primary,
      ...Platform.select({
        web: {
          boxShadow: `0 2px 8px ${colors.primary}25`,
        } as any,
      }),
    },
    bookHighlightTextWrap: { flex: 1, gap: 2 },
    highlightTitle: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 17,
      fontWeight: '600',
      letterSpacing: -0.1,
    },
    highlightSubtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
    bookHighlightTitle: {
      color: colors.text,
      fontSize: isMobile ? 12 : 13,
      lineHeight: isMobile ? 16 : 18,
      fontWeight: '600',
      letterSpacing: -0.1,
      ...Platform.select({ web: { fontFamily: sansSerif } as any }),
    },
    bookHighlightSubtitle: {
      color: colors.textMuted,
      fontSize: isMobile ? 10 : 11,
      lineHeight: isMobile ? 14 : 15,
      ...Platform.select({ web: { fontFamily: sansSerif } as any }),
    },
    bookPageNumber: {
      position: 'absolute' as const,
      bottom: isMobile ? 10 : 14,
      fontSize: isMobile ? 12 : 14,
      fontWeight: '500',
      letterSpacing: 0.5,
      color: 'rgba(140,110,60,0.35)',
      ...Platform.select({
        web: {
          fontFamily: serif,
          fontStyle: 'italic',
        } as any,
      }),
    },
    bookPageNumberLeft: { left: isMobile ? 14 : 20 },
    bookPageNumberRight: { right: isMobile ? 14 : 20 },
  } as const
}
