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
  viewportWidth?: number;
  showSideSlider: boolean;
  sliderHeight: number;
  /** RESP-05: landscape orientation on mobile */
  isLandscape?: boolean;
  /** Measured height of book wrapper (width * 765/1040), 0 before first layout */
  bookHeight?: number;
  stackHeroButtons?: boolean;
}

export const createHomeHeroStyles = ({
  colors, isMobile, isSmallPhone, isNarrowLayout, isTablet, isDesktop, viewportWidth = 0, showSideSlider, sliderHeight,
  isLandscape = false, bookHeight = 0, stackHeroButtons = false,
}: HeroStyleParams) => {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  // Width of one page = half of book width; book width = bookHeight * 1040/765
  const pageWidth = bookHeight > 0 ? Math.round(bookHeight * 1040 / 765 / 2) : 0;
  const hasBookLayout = showSideSlider && bookHeight > 0;
  const isOver1200Desktop = showSideSlider && viewportWidth >= 1200;
  const isLargeDesktopBook = showSideSlider && viewportWidth >= 1920;
  const isUltraWideBook = showSideSlider && viewportWidth >= 2560;
  const isCompactBookLayout = hasBookLayout && bookHeight <= 760;
  const leftPageWidth = showSideSlider ? (isOver1200Desktop ? '54%' : isDesktop ? '64%' : isTablet ? '58%' : '54%') : '100%';
  const rightPageWidth = showSideSlider ? (isDesktop ? '36%' : isTablet ? '42%' : '46%') : 320;
  const bookScale = hasBookLayout ? bookHeight / 864 : 1;
  const desktopTypographyScale = !hasBookLayout ? 1 : isUltraWideBook ? 1.08 : isLargeDesktopBook ? 1.04 : isOver1200Desktop ? 1.08 : 1;
  const desktopSubtitleWidthScale = !hasBookLayout ? 1 : isUltraWideBook ? 1.18 : isLargeDesktopBook ? 1.1 : isOver1200Desktop ? 1.08 : 1;
  const leftPageSafeInset = !hasBookLayout ? 0 : isUltraWideBook ? 68 : isLargeDesktopBook ? 56 : isOver1200Desktop ? 52 : 18;
  const titleScaleMax = isUltraWideBook ? 58 : isLargeDesktopBook ? 50 : 42;
  const titleLineHeightMax = isUltraWideBook ? 66 : isLargeDesktopBook ? 56 : 50;
  const subtitleScaleMax = isUltraWideBook ? 17 : isLargeDesktopBook ? 15 : 14;
  const subtitleLineHeightMax = isUltraWideBook ? 26 : isLargeDesktopBook ? 22 : 22;
  const subtitleWidthMax = isUltraWideBook ? 440 : isLargeDesktopBook ? 380 : 330;
  const leftPagePaddingLeftMax = isUltraWideBook ? 280 : isLargeDesktopBook ? 240 : 190;
  const leftPagePaddingRightMax = isUltraWideBook ? 220 : isLargeDesktopBook ? 200 : 120;
  const leftPagePaddingTopMax = isUltraWideBook ? 128 : isLargeDesktopBook ? 116 : 98;
  const leftPagePaddingBottomMax = isUltraWideBook ? 148 : isLargeDesktopBook ? 132 : 121;
  const leftPageRowGapMax = isUltraWideBook ? 14 : isLargeDesktopBook ? 12 : 10;
  // Baseline tuned from validated desktop layout (bookHeight ~= 864)
  const leftPagePaddingLeft = hasBookLayout ? clamp(Math.round(190 * bookScale) + leftPageSafeInset, 96, leftPagePaddingLeftMax + leftPageSafeInset) : 100;
  const leftPagePaddingRight = hasBookLayout ? clamp(Math.round(120 * bookScale), 28, leftPagePaddingRightMax) : 16;
  const leftPagePaddingTop = hasBookLayout ? clamp(Math.round(98 * bookScale), 40, leftPagePaddingTopMax) : 48;
  const leftPagePaddingBottom = hasBookLayout ? clamp(Math.round(121 * bookScale), 72, leftPagePaddingBottomMax) : 110;
  const leftPageRowGap = hasBookLayout ? clamp(Math.round(10 * bookScale), 6, leftPageRowGapMax) : 8;
  const baseDesktopBookTitleSize = hasBookLayout
    ? Math.min(Math.round(pageWidth * 0.072), Math.round(bookHeight * 0.056))
    : 54;
  const baseDesktopBookTitleLineHeight = hasBookLayout
    ? Math.min(Math.round(pageWidth * 0.088), Math.round(bookHeight * 0.068))
    : 64;
  const baseDesktopBookSubtitleSize = hasBookLayout
    ? Math.min(Math.round(pageWidth * 0.027), Math.round(bookHeight * 0.024))
    : 17;
  const baseDesktopBookSubtitleLineHeight = hasBookLayout
    ? Math.min(Math.round(pageWidth * 0.042), Math.round(bookHeight * 0.034))
    : 28;
  const desktopBookTitleSize = hasBookLayout
    ? clamp(Math.round(baseDesktopBookTitleSize * desktopTypographyScale), 24, titleScaleMax)
    : 54;
  const desktopBookTitleLineHeight = hasBookLayout
    ? clamp(Math.round(baseDesktopBookTitleLineHeight * desktopTypographyScale), 30, titleLineHeightMax)
    : 64;
  const desktopBookSubtitleSize = hasBookLayout
    ? clamp(Math.round(baseDesktopBookSubtitleSize * desktopTypographyScale), 12, subtitleScaleMax)
    : 17;
  const desktopBookSubtitleLineHeight = hasBookLayout
    ? clamp(Math.round(baseDesktopBookSubtitleLineHeight * desktopTypographyScale), 18, subtitleLineHeightMax)
    : 28;
  const desktopBookSubtitleMaxWidth = hasBookLayout
    ? clamp(Math.round(pageWidth * 0.76 * desktopSubtitleWidthScale), 240, subtitleWidthMax)
    : 480;
  const warmBg = DESIGN_TOKENS.colors.background;
  const warmBgSoft = DESIGN_TOKENS.colors.backgroundSecondary;
  const cardSurface = DESIGN_TOKENS.colors.surface;
  const warmBorder = DESIGN_TOKENS.colors.borderAccent;
  const warmShadow = 'rgba(58, 58, 58, 0.12)';
  const warmGold = DESIGN_TOKENS.colors.warningAlpha40;
  const inkStrong = DESIGN_TOKENS.colors.text;
  const inkMuted = DESIGN_TOKENS.colors.textMuted;
  const inkSubtle = DESIGN_TOKENS.colors.textSubtle;
  const brandSoft = DESIGN_TOKENS.colors.brandSoft;
  const serif = 'Georgia, "Times New Roman", serif';
  const sansSerif = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", sans-serif';

  return StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: isMobile ? (isLandscape ? 0 : 8) : (showSideSlider ? 16 : 0),
    paddingBottom: isMobile ? (isLandscape ? 8 : 16) : (showSideSlider ? 16 : 0),
    backgroundColor: warmBg,
    ...Platform.select({ web: {
      backgroundImage: 'none',
      backgroundColor: warmBg,
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
    ...(showSideSlider && bookHeight > 0 ? { height: bookHeight } : {}),
    ...Platform.select({ web: showSideSlider ? {
      backgroundImage: 'url(/assets/images/open-book-bg.png)',
      backgroundSize: '100% 100%',
      backgroundRepeat: 'no-repeat',
      aspectRatio: '1040 / 765',
      maxHeight: 'calc(100vh - 130px)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      visibility: bookHeight > 0 ? 'visible' : 'hidden',
    } as any : {
      backgroundImage: 'none',
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
    ...(showSideSlider && bookHeight > 0 ? { height: bookHeight } : {}),
    ...Platform.select({ web: showSideSlider ? {
      borderRadius: 0,
      overflow: bookHeight > 0 ? 'hidden' : 'visible',
      flex: 1,
    } as any : {} }),
  },
  heroBookSpine: {
    position: 'absolute' as const, left: '50%', top: 0, bottom: 0,
    width: 0, zIndex: 10,
  },

  // -- Left page (text content) --
  heroSection: {
    alignItems: isMobile ? 'stretch' : 'flex-start', gap: showSideSlider ? 0 : (isMobile ? 16 : 18),
    width: leftPageWidth, maxWidth: showSideSlider ? undefined : (isMobile ? '100%' : 720),
    flexShrink: 0,
    paddingLeft: isMobile ? 20 : 48,
    paddingRight: isMobile ? 20 : 48,
    paddingTop: isMobile ? 28 : 32,
    paddingBottom: isMobile ? 28 : 32,
    position: 'relative' as const,
    ...Platform.select({ web: showSideSlider ? {
      backgroundColor: 'transparent',
      borderRadius: 0,
      paddingLeft: leftPagePaddingLeft,
      paddingRight: leftPagePaddingRight,
      paddingTop: leftPagePaddingTop,
      paddingBottom: leftPagePaddingBottom,
      rowGap: isCompactBookLayout ? Math.max(leftPageRowGap, 8) : leftPageRowGap + 4,
      boxSizing: 'border-box',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      alignSelf: 'stretch',
      ...(bookHeight > 0 ? {
        height: bookHeight,
        maxHeight: bookHeight,
      } : {}),
    } as any : {
      backgroundColor: 'rgba(255,255,255,0.85)',
      borderRadius: isMobile ? 8 : 10,
    } as any }),
  },
  heroPageGoldLine: {
    position: 'absolute' as const, top: 0, left: 0, right: 0,
    bottom: 0, zIndex: 5, borderWidth: 0,
    ...Platform.select({ web: {
      display: 'none',
    } as any }),
  },
  heroPageCurlLeft: {
    position: 'absolute' as const, bottom: 0, left: 0,
    width: 0, height: 0, zIndex: 3,
  },

  // -- Right page (slider / photo) --
  sliderSection: {
    flex: 1, minWidth: 0, width: rightPageWidth, maxWidth: showSideSlider ? undefined : 600,
    position: 'relative' as const, alignSelf: 'stretch',
    minHeight: showSideSlider ? 0 : sliderHeight + (isMobile ? 40 : 64),
    ...Platform.select({ web: showSideSlider ? {
      backgroundColor: 'transparent',
      borderRadius: 0,
      paddingTop: isDesktop ? '9%' : '8%',
      paddingBottom: isDesktop ? '20%' : '10%',
      paddingLeft: isDesktop ? '0%' : '1%',
      paddingRight: isDesktop ? '15%' : '11%',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      flex: 1,
      overflow: 'hidden',
    } as any : {} }),
  },
  sliderPageGoldLine: {
    position: 'absolute' as const, top: 0, left: 0, right: 0,
    bottom: 0, zIndex: 5, borderWidth: 0,
    ...Platform.select({ web: {
      display: 'none',
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
  slideEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: 'rgba(20,18,14,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    ...Platform.select({ web: { backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' } }),
  },
  slideEyebrowText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: '#FFFFFF',
    ...Platform.select({ web: { fontFamily: sansSerif } as any }),
  },
  slideCaption: {
    borderRadius: 18, backgroundColor: 'rgba(20,18,14,0.56)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 18, paddingVertical: 16,
    maxWidth: '82%', alignSelf: 'flex-start',
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
    flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10,
    ...Platform.select({ web: { transform: 'translateY(-50%)', pointerEvents: 'none' } }),
  },
  sliderNavBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(32,30,24,0.34)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)',
    ...Platform.select({ web: {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      pointerEvents: 'auto',
    } }),
  },
  sliderNavBtnHover: {
    backgroundColor: 'rgba(32,30,24,0.54)', borderColor: 'rgba(255,255,255,0.28)',
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
    borderRadius: DESIGN_TOKENS.radii.pill, backgroundColor: 'rgba(20,18,14,0.58)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    ...Platform.select({ web: { backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' } }),
  },
  slideCounterText: {
    fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.8)', letterSpacing: 0.4,
    ...Platform.select({ web: { fontFamily: sansSerif } as any }),
  },

  // -- Typography --
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  chapterLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    ...Platform.select({ web: { fontFamily: serif } as any }),
  },
  chapterDivider: {
    height: 1,
    width: 86,
    backgroundColor: warmGold,
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: showSideSlider ? 16 : 8,
    width: '100%',
  },
  heroMetaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: DESIGN_TOKENS.radii.pill,
    backgroundColor: cardSurface,
    borderWidth: 1,
    borderColor: warmBorder,
    ...Platform.select({ web: {
      boxShadow: DESIGN_TOKENS.shadows.light,
    } as any }),
  },
  heroMetaBadgeText: {
    color: inkMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    ...Platform.select({ web: { fontFamily: sansSerif } as any }),
  },
  title: {
    fontSize: isSmallPhone ? 28 : isMobile ? 34 : desktopBookTitleSize,
    fontWeight: '700', color: inkStrong, letterSpacing: -0.6,
    lineHeight: isSmallPhone ? 34 : isMobile ? 42 : desktopBookTitleLineHeight, textAlign: 'left',
    ...Platform.select({ web: showSideSlider ? { fontFamily: serif } as any : { fontFamily: sansSerif } as any }),
  },
  titleAccent: {
    fontSize: isSmallPhone ? 28 : isMobile ? 34 : desktopBookTitleSize,
    fontWeight: '700', color: colors.brand, letterSpacing: -0.5,
    lineHeight: isSmallPhone ? 34 : isMobile ? 42 : desktopBookTitleLineHeight, textAlign: 'left',
    ...Platform.select({ web: showSideSlider ? { fontFamily: serif } as any : { fontFamily: sansSerif } as any }),
  },
  subtitle: {
    fontSize: showSideSlider ? desktopBookSubtitleSize : (isMobile ? 15 : 17), fontWeight: '400', color: inkMuted,
    lineHeight: showSideSlider ? desktopBookSubtitleLineHeight : (isMobile ? 24 : 28), textAlign: 'left', maxWidth: showSideSlider ? desktopBookSubtitleMaxWidth : 480, alignSelf: 'flex-start',
    letterSpacing: 0.2,
    ...Platform.select({ web: showSideSlider ? { fontFamily: serif } as any : { fontFamily: sansSerif } as any }),
  },
  sectionLabelRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: showSideSlider ? 8 : 0,
    marginBottom: 10,
  },
  sectionLabel: {
    color: inkStrong,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0.2,
    ...Platform.select({ web: { fontFamily: sansSerif } as any }),
  },
  sectionLabelHint: {
    color: inkSubtle,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
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
    flexDirection: stackHeroButtons ? 'column' : 'row', justifyContent: 'flex-start', alignItems: stackHeroButtons ? 'stretch' : 'center',
    gap: isMobile ? 10 : (showSideSlider ? (isCompactBookLayout ? 8 : 10) : 10),
    width: '100%',
    flexWrap: 'nowrap',
    marginTop: isMobile ? 8 : (showSideSlider ? (isCompactBookLayout ? 8 : 10) : 12),
  },
  primaryButton: {
    paddingHorizontal: isMobile ? 28 : (showSideSlider ? (isCompactBookLayout ? 24 : 28) : 28), paddingVertical: isMobile ? 14 : (showSideSlider ? (isCompactBookLayout ? 10 : 12) : 13), minHeight: isMobile ? 50 : (showSideSlider ? (isCompactBookLayout ? 40 : 44) : 46),
    borderRadius: DESIGN_TOKENS.radii.pill, width: stackHeroButtons ? '100%' : undefined,
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
    fontSize: isMobile ? 15 : (isCompactBookLayout ? 15 : 15), fontWeight: '600', color: colors.textOnPrimary, letterSpacing: 0.05,
    ...Platform.select({ web: { fontFamily: sansSerif } as any }),
  },
  secondaryButton: {
    paddingHorizontal: isMobile ? 20 : (showSideSlider ? (isCompactBookLayout ? 16 : 20) : 22), paddingVertical: isMobile ? 13 : (showSideSlider ? (isCompactBookLayout ? 9 : 11) : 13), minHeight: isMobile ? 50 : (showSideSlider ? (isCompactBookLayout ? 40 : 44) : 46),
    borderRadius: DESIGN_TOKENS.radii.pill, backgroundColor: cardSurface, borderWidth: 1.5, borderColor: warmBorder,
    width: stackHeroButtons ? '100%' : undefined,
    ...Platform.select({ web: {
      transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: DESIGN_TOKENS.shadows.light,
    } }),
  },
  secondaryButtonHover: {
    backgroundColor: warmBg, borderColor: colors.brandAlpha30,
    ...Platform.select({ web: {
      transform: 'translateY(-2px)',
      boxShadow: DESIGN_TOKENS.shadows.hover,
    } }),
  },
  secondaryButtonText: {
    fontSize: isCompactBookLayout ? 14 : 15, fontWeight: '600', color: inkStrong,
    ...Platform.select({ web: { fontFamily: sansSerif } as any }),
  },
  singleCtaButton: {
    width: stackHeroButtons ? '100%' : undefined,
    alignSelf: stackHeroButtons ? 'stretch' : 'flex-start',
  },

  // -- Bookmark rail (desktop left page inline mood cards) --
  bookmarkRail: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: showSideSlider ? (isCompactBookLayout ? 6 : 8) : 2,
    alignItems: 'stretch',
    ...Platform.select({ web: {
      marginTop: 2,
    } as any }),
  },
  bookmarkChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: isCompactBookLayout ? 10 : 12, paddingVertical: showSideSlider ? (isCompactBookLayout ? 6 : 8) : 6,
    borderRadius: 10,
    borderWidth: 1.5, borderColor: warmBorder,
    backgroundColor: cardSurface,
    flexBasis: isCompactBookLayout ? '45%' : '45%',
    maxWidth: isCompactBookLayout ? '45%' : '45%',
    minWidth: 0,
    ...Platform.select({ web: {
      cursor: 'pointer',
      transition: 'all 0.18s ease',
      boxShadow: DESIGN_TOKENS.shadows.light,
    } }),
  },
  bookmarkChipAccent: {
    width: 3,
    alignSelf: 'stretch',
    marginVertical: -8,
    marginLeft: -12,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    backgroundColor: colors.brand,
    opacity: 0.78,
  },
  bookmarkChipHover: {
    backgroundColor: warmBgSoft, borderColor: colors.brandAlpha30,
    ...Platform.select({ web: {
      transform: 'translateX(4px)',
      boxShadow: DESIGN_TOKENS.shadows.hover,
    } }),
  },
  bookmarkChipIcon: {
    width: isCompactBookLayout ? 24 : 28, height: isCompactBookLayout ? 24 : 28, borderRadius: 9, backgroundColor: brandSoft,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: warmBorder,
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
    fontSize: showSideSlider ? (isCompactBookLayout ? 12 : 13) : 13, fontWeight: '600', color: inkStrong, letterSpacing: showSideSlider ? -0.15 : -0.1,
    ...Platform.select({ web: { fontFamily: sansSerif } as any }),
  },
  moodChipMeta: {
    fontSize: showSideSlider ? 10 : 10, fontWeight: '400', color: inkMuted, letterSpacing: 0.05,
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
