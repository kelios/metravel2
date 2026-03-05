// components/home/homeHeroStyles.ts
// Premium "My Travel Book" — digital scrapbook aesthetic
// Visual inspiration: Apple Photos + Notion + modern travel apps

import { StyleSheet, Platform } from 'react-native';
import { DESIGN_TOKENS } from '@/constants/designSystem';
import type { useThemedColors } from '@/hooks/useTheme';

type Colors = ReturnType<typeof useThemedColors>;

interface HeroStyleParams {
  colors: Colors;
  isMobile: boolean;
  isSmallPhone: boolean;
  isNarrowLayout: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  showSideSlider: boolean;
  sliderHeight: number;
  /** RESP-05: landscape orientation on mobile */
  isLandscape?: boolean;
}

export const createHomeHeroStyles = ({
  colors, isMobile, isSmallPhone, isNarrowLayout, isTablet, isDesktop, showSideSlider, sliderHeight,
  isLandscape = false,
}: HeroStyleParams) => {
  // Premium warm palette — earthy, natural tones
  const warmBg = '#FAF7F2';
  const warmBgSoft = '#F5F0E8';
  const cardSurface = '#FFFFFF';
  const warmBorder = 'rgba(180,160,130,0.15)';
  const warmShadow = 'rgba(120,90,50,0.08)';
  const warmGold = 'rgba(190,160,90,0.6)';
  const serif = 'Georgia, "Times New Roman", serif';
  const sansSerif = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", sans-serif';

  return StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: isMobile ? (isLandscape ? 8 : 16) : 24,
    paddingBottom: isMobile ? (isLandscape ? 12 : 28) : 28,
    backgroundColor: warmBg,
    ...Platform.select({ web: {
      backgroundImage: `linear-gradient(180deg, ${warmBg} 0%, #F0EBE0 100%)`,
    } }),
  },

  // -- Shell & book wrapper --
  heroShell: {
    width: '100%', borderRadius: 0, borderWidth: 0,
    backgroundColor: 'transparent', paddingHorizontal: 0, paddingVertical: 0,
    position: 'relative' as const, overflow: 'visible' as const,
  },
  bookWrapper: {
    width: '100%', position: 'relative' as const,
    ...Platform.select({ web: {
      backgroundImage: 'url(/assets/images/open-book-bg.jpg)',
      backgroundSize: '100% 100%',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center center',
      paddingLeft: isMobile ? '5%' : '8%',
      paddingRight: isMobile ? '5%' : '8%',
      paddingTop: isMobile ? '4%' : '5%',
      paddingBottom: isMobile ? '8%' : '10%',
    } as any }),
  },
  bookCoverOuter: {
    position: 'absolute' as const, left: 0, right: 0, top: 0, bottom: 0, zIndex: -1,
  },
  // -- Two-page layout --
  heroRow: {
    flexDirection: showSideSlider ? 'row' : 'column', alignItems: 'stretch',
    justifyContent: 'flex-start', gap: 0, width: '100%',
    position: 'relative' as const,
    ...Platform.select({ web: showSideSlider ? {
      borderRadius: isMobile ? 8 : 10,
      overflow: 'hidden',
      minHeight: sliderHeight + (isMobile ? 40 : 80),
      border: '2px solid rgba(30,24,18,0.85)',
      boxShadow: 'inset 0 0 0 6px rgba(255,255,255,0.92), inset 0 0 0 7px rgba(30,24,18,0.12)',
    } as any : {} }),
  },
  heroBookSpine: {
    position: 'absolute' as const, left: '50%', top: 0, bottom: 0,
    width: isMobile ? 12 : 20, zIndex: 10,
    ...Platform.select({ web: {
      marginLeft: isMobile ? -6 : -10,
      backgroundImage: `linear-gradient(90deg,
        rgba(20,16,12,0.18) 0%,
        rgba(20,16,12,0.28) 20%,
        rgba(255,255,255,0.12) 35%,
        rgba(255,255,255,0.18) 50%,
        rgba(255,255,255,0.12) 65%,
        rgba(20,16,12,0.28) 80%,
        rgba(20,16,12,0.18) 100%)`,
      boxShadow: '2px 0 8px rgba(20,16,12,0.15), -2px 0 8px rgba(20,16,12,0.15)',
    } as any }),
  },

  // -- Left page (text content) --
  heroSection: {
    alignItems: isMobile ? 'stretch' : 'flex-start', gap: isMobile ? 16 : 18,
    width: showSideSlider ? '50%' : '100%', maxWidth: showSideSlider ? undefined : (isMobile ? '100%' : 720),
    flexShrink: 0,
    paddingHorizontal: isMobile ? 20 : 48,
    paddingVertical: isMobile ? 28 : 32,
    paddingRight: showSideSlider ? (isMobile ? 28 : 56) : undefined,
    position: 'relative' as const,
    ...Platform.select({ web: showSideSlider ? {
      backgroundColor: '#FDFCF9',
      borderTopLeftRadius: isMobile ? 6 : 8,
      borderBottomLeftRadius: isMobile ? 6 : 8,
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
    } as any : {
      backgroundColor: '#FDFCF9',
      borderRadius: isMobile ? 8 : 10,
      border: '2px solid rgba(30,24,18,0.85)',
      boxShadow: 'inset 0 0 0 6px rgba(255,255,255,0.9), inset 0 0 0 7px rgba(30,24,18,0.10)',
    } as any }),
  },
  heroPageGoldLine: {
    position: 'absolute' as const, top: isMobile ? 14 : 18, left: isMobile ? 16 : 24, right: isMobile ? 16 : 24,
    bottom: isMobile ? 14 : 18, zIndex: 5, borderWidth: 0,
    ...Platform.select({ web: {
      border: '1px solid rgba(30,24,18,0.20)',
      borderRadius: 2,
      pointerEvents: 'none',
    } as any }),
  },
  heroPageCurlLeft: {
    position: 'absolute' as const, bottom: 0, left: 0,
    width: 0, height: 0, zIndex: 3,
  },

  // -- Right page (slider / photo) --
  sliderSection: {
    flex: 1, minWidth: 0, width: showSideSlider ? '50%' : 320, maxWidth: showSideSlider ? undefined : 600,
    position: 'relative' as const, alignSelf: 'stretch',
    minHeight: sliderHeight + (isMobile ? 40 : 64),
    ...Platform.select({ web: showSideSlider ? {
      backgroundColor: '#F8F5EE',
      borderTopRightRadius: isMobile ? 6 : 8,
      borderBottomRightRadius: isMobile ? 6 : 8,
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
      padding: isMobile ? 20 : 32,
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
    } as any : {} }),
  },
  sliderPageGoldLine: {
    position: 'absolute' as const, top: isMobile ? 14 : 18, left: isMobile ? 16 : 24, right: isMobile ? 16 : 24,
    bottom: isMobile ? 14 : 18, zIndex: 5, borderWidth: 0,
    ...Platform.select({ web: {
      border: '1px solid rgba(30,24,18,0.18)',
      borderRadius: 2,
      pointerEvents: 'none',
    } as any }),
  },
  heroPageCurlRight: {
    position: 'absolute' as const, bottom: 0, right: 0,
    width: 0, height: 0, zIndex: 3,
  },
  sliderPageNumber: {
    position: 'absolute' as const, bottom: isMobile ? 10 : 14, right: isMobile ? 14 : 20,
    fontSize: isMobile ? 10 : 11, fontWeight: '400', letterSpacing: 0.4,
    color: 'rgba(140,110,60,0.3)', zIndex: 5,
    ...Platform.select({ web: {
      fontFamily: serif,
      fontStyle: 'italic',
    } as any }),
  },

  // -- Slider / immersive photo --
  sliderContainer: {
    width: '100%', flex: 1, minHeight: sliderHeight, borderRadius: isMobile ? 4 : 6, overflow: 'hidden',
    backgroundColor: '#1A1A1A', borderWidth: 0,
    ...Platform.select({ web: {
      boxShadow: '0 2px 12px rgba(10,8,6,0.25)',
      border: '1px solid rgba(30,24,18,0.30)',
      minHeight: sliderHeight,
      flexGrow: 1,
      flexShrink: 0,
    } as any }),
  },
  slideWrapper: {
    position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0,
    ...Platform.select({ web: { transition: 'opacity 0.6s ease' } as any }),
  },
  slideImage: {
    width: '100%', height: '100%',
    ...Platform.select({ web: { filter: 'saturate(1.05) contrast(1.02)' } }),
  },
  slideOverlay: {
    position: 'absolute' as const, bottom: 0, left: 0, right: 0, zIndex: 2,
    paddingHorizontal: 24, paddingTop: 72, paddingBottom: 24, pointerEvents: 'none' as const,
    ...Platform.select({ web: {
      backgroundImage: 'linear-gradient(to top, rgba(15,12,8,0.85) 0%, rgba(15,12,8,0.4) 55%, transparent 100%)',
    } }),
  },
  slideCaption: {
    borderRadius: 14, backgroundColor: 'rgba(20,18,14,0.5)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 18, paddingVertical: 14,
    maxWidth: '94%', alignSelf: 'flex-start',
    ...Platform.select({ web: { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' } }),
  },
  slideTitle: {
    fontSize: isMobile ? 18 : 24, fontWeight: '600', color: '#FFFFFF', marginBottom: 4, letterSpacing: -0.3,
    ...Platform.select({ web: {
      fontFamily: sansSerif,
      textShadow: '0 1px 6px rgba(0,0,0,0.4)',
    } as any }),
  },
  slideSubtitle: {
    fontSize: 12, fontWeight: '400', color: 'rgba(255,255,255,0.75)', letterSpacing: 0.3,
    ...Platform.select({ web: { fontFamily: sansSerif } as any }),
  },

  // -- Slider navigation --
  sliderNav: {
    position: 'absolute' as const, top: '50%', left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16,
    ...Platform.select({ web: { transform: 'translateY(-50%)' } }),
  },
  sliderNavBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    ...Platform.select({ web: {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    } }),
  },
  sliderNavBtnHover: {
    backgroundColor: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.35)',
    ...Platform.select({ web: { transform: 'scale(1.06)' } }),
  },
  sliderDots: {
    position: 'absolute' as const, bottom: 14, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 8, zIndex: 3,
  },
  sliderDot: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.2s ease' } }),
  },
  sliderDotActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  slideCounter: {
    position: 'absolute' as const, bottom: 16, right: 16, zIndex: 4, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: DESIGN_TOKENS.radii.pill, backgroundColor: 'rgba(20,18,14,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    ...Platform.select({ web: { backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' } }),
  },
  slideCounterText: {
    fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.4,
    ...Platform.select({ web: { fontFamily: sansSerif } as any }),
  },

  // -- Typography --
  title: {
    fontSize: isSmallPhone ? 28 : isMobile ? 34 : isTablet ? 46 : (isDesktop ? 54 : 50),
    fontWeight: '700', color: '#2A1F14', letterSpacing: -1.2,
    lineHeight: isSmallPhone ? 34 : isMobile ? 42 : isTablet ? 54 : (isDesktop ? 64 : 60), textAlign: 'left',
    ...Platform.select({ web: { fontFamily: sansSerif } as any }),
  },
  titleAccent: {
    fontSize: isSmallPhone ? 28 : isMobile ? 34 : isTablet ? 46 : (isDesktop ? 54 : 50),
    fontWeight: '700', color: colors.brand, letterSpacing: -1.2,
    lineHeight: isSmallPhone ? 34 : isMobile ? 42 : isTablet ? 54 : (isDesktop ? 64 : 60), textAlign: 'left',
    ...Platform.select({ web: { fontFamily: sansSerif } as any }),
  },
  subtitle: {
    fontSize: isMobile ? 15 : 17, fontWeight: '400', color: '#6B5D4F',
    lineHeight: isMobile ? 24 : 28, textAlign: 'left', maxWidth: 480, alignSelf: 'flex-start',
    letterSpacing: 0.1,
    ...Platform.select({ web: { fontFamily: sansSerif } as any }),
  },

  // -- Open book mini widget (tablet non-slider layout) --
  openBookContainer: {
    width: '100%', marginTop: isMobile ? 8 : 12, position: 'relative' as const,
  },
  openBook: {
    flexDirection: 'row' as const, width: '100%', position: 'relative' as const,
    borderRadius: isMobile ? 12 : 16, overflow: 'hidden' as const,
    backgroundColor: cardSurface,
    ...Platform.select({ web: {
      boxShadow: `0 4px 24px ${warmShadow}`,
    } as any }),
  },
  bookCover: {
    position: 'absolute' as const, left: 0, right: 0, top: 0, bottom: 0,
    borderRadius: isMobile ? 12 : 16, zIndex: -1,
  },
  bookmarkRibbon: {
    position: 'absolute' as const, top: -8, right: isMobile ? 20 : 32,
    width: isMobile ? 18 : 22, height: isMobile ? 44 : 56, zIndex: 10,
    ...Platform.select({ web: {
      backgroundImage: `linear-gradient(180deg, ${colors.brand} 0%, ${colors.brandDark || colors.brand} 100%)`,
      clipPath: 'polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%)',
      boxShadow: '1px 3px 8px rgba(0,0,0,0.12)',
    } as any }),
  },
  bookSpine: {
    position: 'absolute' as const, left: '50%', top: 0, bottom: 0, width: 2,
    backgroundColor: 'transparent', zIndex: 5,
    ...Platform.select({ web: {
      marginLeft: -1,
      backgroundImage: `linear-gradient(90deg, rgba(0,0,0,0.04) 0%, rgba(140,100,50,0.12) 50%, rgba(0,0,0,0.04) 100%)`,
    } as any }),
  },
  bookSpineShadowLeft: {
    position: 'absolute' as const, right: 0, top: 0, bottom: 0, width: isMobile ? 20 : 28,
    zIndex: 2, pointerEvents: 'none' as const,
    ...Platform.select({ web: {
      backgroundImage: 'linear-gradient(to left, rgba(0,0,0,0.03) 0%, transparent 100%)',
    } as any }),
  },
  bookSpineShadowRight: {
    position: 'absolute' as const, left: 0, top: 0, bottom: 0, width: isMobile ? 20 : 28,
    zIndex: 2, pointerEvents: 'none' as const,
    ...Platform.select({ web: {
      backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.03) 0%, transparent 100%)',
    } as any }),
  },
  bookPage: {
    flex: 1, padding: isMobile ? 14 : 20, gap: isMobile ? 10 : 14,
    position: 'relative' as const, minHeight: isMobile ? 100 : 120,
    backgroundColor: cardSurface,
    ...Platform.select({ web: {
      transition: 'box-shadow 0.3s ease',
    } as any }),
  },
  bookPageLeft: {
    borderRightWidth: 0,
    ...Platform.select({ web: {
      borderTopLeftRadius: isMobile ? 12 : 16,
      borderBottomLeftRadius: isMobile ? 12 : 16,
    } as any }),
  },
  bookPageRight: {
    borderLeftWidth: 0,
    ...Platform.select({ web: {
      borderTopRightRadius: isMobile ? 12 : 16,
      borderBottomRightRadius: isMobile ? 12 : 16,
    } as any }),
  },
  bookPageCurl: {
    position: 'absolute' as const, bottom: 0, width: 0, height: 0, zIndex: 3,
  },
  bookPageCurlLeft: { left: 0 },
  bookPageCurlRight: { right: 0 },
  bookPageGoldLine: {
    position: 'absolute' as const, top: 0, left: isMobile ? 14 : 20, right: isMobile ? 14 : 20,
    height: 1, zIndex: 4,
    ...Platform.select({ web: {
      backgroundImage: `linear-gradient(90deg, transparent 0%, ${warmGold} 20%, ${warmGold} 80%, transparent 100%)`,
    } as any }),
  },

  // -- Highlights (open book mini widget items) --
  highlightsGrid: { flexDirection: isNarrowLayout ? 'column' : 'row', gap: 10, width: '100%', marginTop: 8 },
  highlightCard: {
    flex: isMobile ? undefined : 1, minWidth: 0, borderRadius: 14, borderWidth: 1,
    borderColor: warmBorder, backgroundColor: cardSurface, paddingVertical: 14, paddingHorizontal: 16, gap: 8,
    ...Platform.select({ web: {
      transition: 'all 0.2s ease',
      boxShadow: `0 1px 6px ${warmShadow}`,
    } }),
  },
  bookHighlightItem: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: isMobile ? 10 : 12,
    paddingVertical: isMobile ? 10 : 12, paddingHorizontal: isMobile ? 12 : 16,
    borderRadius: 12,
    backgroundColor: warmBgSoft,
    borderWidth: 1, borderColor: warmBorder,
    ...Platform.select({ web: {
      transition: 'all 0.2s ease',
    } as any }),
  },
  bookHighlightItemHover: {
    backgroundColor: cardSurface, borderColor: 'rgba(180,160,130,0.25)',
    ...Platform.select({ web: {
      transform: 'translateX(3px)',
      boxShadow: `0 2px 12px ${warmShadow}`,
    } as any }),
  },
  highlightIconWrap: {
    width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary,
    ...Platform.select({ web: { boxShadow: `0 2px 8px ${colors.primary}25` } }),
  },
  bookHighlightIconWrap: {
    width: isMobile ? 30 : 34, height: isMobile ? 30 : 34, borderRadius: 10,
    alignItems: 'center' as const, justifyContent: 'center' as const,
    backgroundColor: colors.primary,
    ...Platform.select({ web: {
      boxShadow: `0 2px 8px ${colors.primary}25`,
    } }),
  },
  bookHighlightTextWrap: { flex: 1, gap: 2 },
  highlightTitle: { color: '#2A1F14', fontSize: 13, lineHeight: 17, fontWeight: '600', letterSpacing: -0.1 },
  highlightSubtitle: { color: '#8B7D6B', fontSize: 12, lineHeight: 16 },
  bookHighlightTitle: {
    color: '#2A1F14', fontSize: isMobile ? 12 : 13, lineHeight: isMobile ? 16 : 18, fontWeight: '600', letterSpacing: -0.1,
    ...Platform.select({ web: { fontFamily: sansSerif } as any }),
  },
  bookHighlightSubtitle: {
    color: '#8B7D6B', fontSize: isMobile ? 10 : 11, lineHeight: isMobile ? 14 : 15,
    ...Platform.select({ web: { fontFamily: sansSerif } as any }),
  },
  bookPageNumber: {
    position: 'absolute' as const, bottom: isMobile ? 8 : 12,
    fontSize: isMobile ? 10 : 11, fontWeight: '400', letterSpacing: 0.4,
    color: 'rgba(140,110,60,0.25)',
    ...Platform.select({ web: {
      fontFamily: serif,
      fontStyle: 'italic',
    } as any }),
  },
  bookPageNumberLeft: { left: isMobile ? 14 : 20 },
  bookPageNumberRight: { right: isMobile ? 14 : 20 },

  // -- CTA Buttons --
  buttonsContainer: {
    flexDirection: isNarrowLayout ? 'column' : 'row', justifyContent: 'flex-start', alignItems: 'center',
    gap: isMobile ? 10 : 14,
    width: '100%',
    flexWrap: isNarrowLayout ? 'nowrap' : 'wrap',
    marginTop: isMobile ? 8 : 12,
  },
  primaryButton: {
    paddingHorizontal: isMobile ? 28 : 40, paddingVertical: isMobile ? 14 : 17, minHeight: isMobile ? 50 : 56,
    borderRadius: DESIGN_TOKENS.radii.pill, width: isMobile ? '100%' : undefined,
    backgroundColor: colors.brand,
    ...Platform.select({ web: {
      transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: `0 4px 16px ${colors.brand}35, 0 1px 3px ${colors.brand}20`,
    } }),
  },
  primaryButtonHover: {
    backgroundColor: colors.brandDark,
    ...Platform.select({ web: {
      transform: 'translateY(-2px)',
      boxShadow: `0 8px 24px ${colors.brand}45, 0 2px 6px ${colors.brand}28`,
    } }),
  },
  primaryButtonText: {
    fontSize: isMobile ? 15 : 16, fontWeight: '600', color: colors.textOnPrimary, letterSpacing: 0.1,
    ...Platform.select({ web: { fontFamily: sansSerif } as any }),
  },
  secondaryButton: {
    paddingHorizontal: isMobile ? 20 : 28, paddingVertical: isMobile ? 13 : 17, minHeight: isMobile ? 50 : 56,
    borderRadius: DESIGN_TOKENS.radii.pill, backgroundColor: cardSurface, borderWidth: 1.5, borderColor: warmBorder,
    width: isMobile ? '100%' : undefined,
    ...Platform.select({ web: {
      transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
    } }),
  },
  secondaryButtonHover: {
    backgroundColor: warmBg, borderColor: 'rgba(180,160,130,0.3)',
    ...Platform.select({ web: {
      transform: 'translateY(-2px)',
      boxShadow: `0 4px 16px ${warmShadow}`,
    } }),
  },
  secondaryButtonText: {
    fontSize: 15, fontWeight: '600', color: '#2A1F14',
    ...Platform.select({ web: { fontFamily: sansSerif } as any }),
  },

  // -- Bookmark rail (desktop left page inline mood cards) --
  bookmarkRail: {
    width: '100%', gap: 2, alignItems: 'stretch',
    ...Platform.select({ web: {
      borderLeftWidth: 1.5,
      borderLeftColor: 'rgba(100,90,75,0.22)',
      paddingLeft: 16,
      marginLeft: 2,
    } as any }),
  },
  bookmarkChip: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5, borderColor: 'rgba(100,90,75,0.20)',
    backgroundColor: cardSurface,
    ...Platform.select({ web: {
      cursor: 'pointer',
      transition: 'all 0.18s ease',
      boxShadow: '1px 2px 0px rgba(100,90,75,0.08)',
    } }),
  },
  bookmarkChipHover: {
    backgroundColor: warmBgSoft, borderColor: 'rgba(180,160,130,0.28)',
    ...Platform.select({ web: {
      transform: 'translateX(4px)',
      boxShadow: `0 3px 12px ${warmShadow}`,
    } }),
  },
  bookmarkChipIcon: {
    width: 30, height: 30, borderRadius: 6, backgroundColor: 'transparent',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(100,90,75,0.22)',
  },

  // -- Mood chips (mobile horizontal scroll) --
  moodChipsContainer: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: warmBorder, width: '100%' },
  moodChipsScrollContent: {
    flexDirection: showSideSlider ? 'column' : 'row', gap: showSideSlider ? 6 : 10, paddingHorizontal: 0,
    justifyContent: showSideSlider ? 'flex-start' : 'center', flexWrap: showSideSlider ? 'nowrap' : 'nowrap',
  },
  moodChip: showSideSlider ? {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingLeft: 0, paddingRight: 16, paddingVertical: 0,
    borderRadius: 14, backgroundColor: cardSurface,
    borderWidth: 1, borderColor: warmBorder,
    overflow: 'hidden', minHeight: 52,
    ...Platform.select({ web: {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      boxShadow: `0 1px 6px ${warmShadow}`,
    } }) as any,
  } : {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: DESIGN_TOKENS.radii.pill, backgroundColor: cardSurface,
    borderWidth: 1, borderColor: warmBorder,
    ...Platform.select({ web: {
      cursor: 'pointer',
      transition: 'all 0.18s ease',
      boxShadow: `0 1px 4px ${warmShadow}`,
    } }) as any,
  },
  moodChipHover: {
    backgroundColor: warmBgSoft, borderColor: 'rgba(180,160,130,0.3)',
    ...Platform.select({ web: showSideSlider ? {
      transform: 'translateY(-1px)',
      boxShadow: `0 4px 16px ${warmShadow}`,
    } : {
      boxShadow: `0 2px 8px ${warmShadow}`,
    } }),
  },
  moodChipAccent: showSideSlider ? {
    width: 3, alignSelf: 'stretch',
    borderTopLeftRadius: 14, borderBottomLeftRadius: 14,
    backgroundColor: colors.brand, opacity: 0.7,
  } : { width: 0, height: 0 },
  moodChipIcon: showSideSlider ? {
    width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(190,160,90,0.1)',
    justifyContent: 'center', alignItems: 'center',
  } : {
    width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(190,160,90,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  moodChipText: { gap: showSideSlider ? 2 : 1, flex: showSideSlider ? 1 : undefined },
  moodChipTitle: {
    fontSize: showSideSlider ? 14 : 13, fontWeight: '600', color: '#2A1F14', letterSpacing: showSideSlider ? -0.2 : -0.1,
    ...Platform.select({ web: { fontFamily: sansSerif } as any }),
  },
  moodChipMeta: {
    fontSize: showSideSlider ? 11 : 10, fontWeight: '400', color: '#8B7D6B', letterSpacing: 0.1,
    ...Platform.select({ web: { fontFamily: sansSerif } as any }),
  },

  // -- Popular section (mobile) --
  popularSection: { marginTop: isMobile ? 28 : 44, width: '100%' },
  popularTitle: {
    fontSize: 11, fontWeight: '600', color: '#8B7D6B', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1.2,
    ...Platform.select({ web: { fontFamily: sansSerif } as any }),
  },
  popularScrollContent: { flexDirection: 'row', gap: 14, paddingRight: 16 },

  // -- Featured card (mobile hero image) --
  featuredCard: {
    width: '100%', borderRadius: 20, overflow: 'hidden',
    backgroundColor: cardSurface, borderWidth: 1, borderColor: warmBorder,
    marginBottom: 20, position: 'relative' as const,
    ...Platform.select({ web: {
      cursor: 'pointer',
      transition: 'all 0.22s ease',
      boxShadow: `0 4px 20px ${warmShadow}`,
    } }),
  },
  featuredCardHover: {
    ...Platform.select({ web: {
      transform: 'translateY(-3px)',
      boxShadow: `0 8px 32px rgba(120,90,50,0.14)`,
      borderColor: 'rgba(180,160,130,0.3)',
    } }),
  },
  featuredCardImage: { width: '100%', aspectRatio: 16 / 9 },
  featuredCardOverlay: {
    position: 'absolute' as const, bottom: 0, left: 0, right: 0,
    paddingHorizontal: 18, paddingVertical: 16, paddingTop: 44,
    ...Platform.select({ web: {
      backgroundImage: 'linear-gradient(to top, rgba(15,12,8,0.88) 0%, rgba(15,12,8,0.35) 60%, transparent 100%)',
    } }),
  },
  featuredCardTitle: {
    fontSize: 18, fontWeight: '600', color: '#FFFFFF', marginBottom: 3, letterSpacing: -0.2,
    ...Platform.select({ web: { fontFamily: sansSerif } as any }),
  },
  featuredCardSubtitle: {
    fontSize: 12, fontWeight: '400', color: 'rgba(255,255,255,0.75)', letterSpacing: 0.2,
    ...Platform.select({ web: { fontFamily: sansSerif } as any }),
  },

  // -- Image card (horizontal scroll items) --
  imageCard: {
    width: isMobile ? 200 : 220, borderRadius: 16, backgroundColor: cardSurface,
    borderWidth: 1, borderColor: warmBorder, overflow: 'hidden',
    ...Platform.select({ web: {
      transition: 'all 0.22s ease',
      cursor: 'pointer',
      boxShadow: `0 2px 10px ${warmShadow}`,
    } }),
  },
  imageCardHover: {
    ...Platform.select({ web: {
      transform: 'translateY(-3px)',
      boxShadow: `0 8px 28px rgba(120,90,50,0.12)`,
      borderColor: 'rgba(180,160,130,0.3)',
    } }),
  },
  imageCardImage: { width: isMobile ? 200 : 220, height: isMobile ? 135 : 155 },
  imageCardContent: { padding: 14, gap: 4 },
  imageCardTitle: {
    fontSize: 14, fontWeight: '600', color: '#2A1F14', lineHeight: 19, letterSpacing: -0.2,
    ...Platform.select({ web: { fontFamily: sansSerif } as any }),
  },
  imageCardSubtitle: {
    fontSize: 12, fontWeight: '400', color: '#8B7D6B', lineHeight: 17,
    ...Platform.select({ web: { fontFamily: sansSerif } as any }),
  },
});
};
