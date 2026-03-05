// components/home/homeHeroStyles.ts
// E3: Styles extracted from HomeHero.tsx (~500 LOC)

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
}: HeroStyleParams) => StyleSheet.create({
  container: {
    width: '100%',
    // RESP-05: Уменьшаем padding в landscape-режиме на мобайле
    paddingTop: isMobile ? (isLandscape ? 8 : 20) : 52,
    paddingBottom: isMobile ? (isLandscape ? 12 : 28) : 80,
    backgroundColor: colors.background,
    ...Platform.select({ web: {
      backgroundImage: [
        `radial-gradient(ellipse 70% 50% at 50% -10%, ${colors.primarySoft} 0%, transparent 65%)`,
        `radial-gradient(ellipse 35% 25% at 92% 15%, ${colors.primaryAlpha30} 0%, transparent 55%)`,
      ].join(', '),
      backgroundRepeat: 'no-repeat',
    } }),
  },
  heroShell: {
    width: '100%', borderRadius: isMobile ? 12 : 20, borderWidth: 0,
    backgroundColor: 'transparent', paddingHorizontal: 0, paddingVertical: 0,
    position: 'relative' as const, overflow: 'visible' as const,
    ...Platform.select({ web: {
      perspective: '2400px',
    } as any }),
  },
  // Book wrapper for 3D effect
  bookWrapper: {
    width: '100%', position: 'relative' as const,
    ...Platform.select({ web: {
      transformStyle: 'preserve-3d',
      transform: showSideSlider ? 'rotateX(2deg) rotateY(-0.3deg)' : 'none',
      filter: showSideSlider
        ? 'drop-shadow(0 32px 56px rgba(0,0,0,0.22)) drop-shadow(0 8px 18px rgba(0,0,0,0.12))'
        : 'none',
    } as any }),
  },
  // Hardcover outer binding
  bookCoverOuter: {
    position: 'absolute' as const, left: -8, right: -8, top: -8, bottom: -8,
    borderRadius: isMobile ? 10 : 16, zIndex: -1,
    ...Platform.select({ web: {
      backgroundImage: `linear-gradient(160deg, #3a2718 0%, #2b1c0d 35%, #362213 65%, #271809 100%)`,
      boxShadow: '0 2px 0 rgba(255,255,255,0.07) inset, 0 -2px 0 rgba(0,0,0,0.45) inset',
    } as any }),
  },
  heroRow: {
    flexDirection: showSideSlider ? 'row' : 'column', alignItems: 'stretch',
    justifyContent: 'flex-start', gap: 0, width: '100%',
    position: 'relative' as const,
    ...Platform.select({ web: showSideSlider ? {
      borderRadius: isMobile ? 4 : 8,
      borderWidth: 1,
      borderColor: 'rgba(139,90,43,0.08)',
    } as any : {} }),
  },
  // Central book spine (between pages) — strong binding crease
  heroBookSpine: {
    position: 'absolute' as const, left: '50%', top: -10, bottom: -10,
    width: isMobile ? 14 : 20, zIndex: 10,
    ...Platform.select({ web: {
      marginLeft: isMobile ? -7 : -10,
      backgroundImage: `linear-gradient(90deg,
        rgba(0,0,0,0.16) 0%,
        rgba(80,45,15,0.22) 14%,
        rgba(139,90,43,0.32) 32%,
        rgba(180,120,55,0.24) 46%,
        rgba(212,175,55,0.12) 50%,
        rgba(180,120,55,0.24) 54%,
        rgba(139,90,43,0.32) 68%,
        rgba(80,45,15,0.22) 86%,
        rgba(0,0,0,0.16) 100%)`,
      boxShadow: 'inset 0 0 18px rgba(0,0,0,0.25), 0 0 3px rgba(0,0,0,0.2)',
      borderRadius: 2,
    } as any }),
  },
  // Decorative bookmark ribbons at top — two bookmarks for realism
  heroBookmarkRibbon: {
    position: 'absolute' as const, top: -12, right: isMobile ? 40 : 80,
    width: isMobile ? 24 : 30, height: isMobile ? 64 : 82, zIndex: 15,
    ...Platform.select({ web: {
      backgroundImage: `linear-gradient(180deg, ${colors.brand} 0%, ${colors.brandDark || colors.brand} 82%, rgba(0,0,0,0.18) 100%)`,
      clipPath: 'polygon(0 0, 100% 0, 100% 88%, 50% 100%, 0 88%)',
      boxShadow: '2px 5px 14px rgba(0,0,0,0.24), inset 1px 0 0 rgba(255,255,255,0.12)',
    } as any }),
  },
  // Second bookmark ribbon — shorter, teal/navy, offset left
  heroBookmarkRibbon2: {
    position: 'absolute' as const, top: -8, right: isMobile ? 70 : 122,
    width: isMobile ? 18 : 22, height: isMobile ? 48 : 60, zIndex: 14,
    ...Platform.select({ web: {
      backgroundImage: `linear-gradient(180deg, #2a5c76 0%, #1c4258 82%, rgba(0,0,0,0.22) 100%)`,
      clipPath: 'polygon(0 0, 100% 0, 100% 88%, 50% 100%, 0 88%)',
      boxShadow: '1px 4px 10px rgba(0,0,0,0.18), inset 1px 0 0 rgba(255,255,255,0.08)',
      opacity: 0.85,
    } as any }),
  },
  // Left page of the book (text content)
  heroSection: {
    alignItems: isMobile ? 'stretch' : 'flex-start', gap: isMobile ? 12 : 16,
    width: showSideSlider ? '50%' : '100%', maxWidth: showSideSlider ? undefined : (isMobile ? '100%' : 720),
    flexShrink: 0,
    paddingHorizontal: isMobile ? 18 : 32,
    paddingVertical: isMobile ? 24 : 40,
    paddingRight: showSideSlider ? (isMobile ? 22 : 40) : undefined,
    position: 'relative' as const,
    ...Platform.select({ web: showSideSlider ? {
      backgroundImage: `
        repeating-linear-gradient(
          to bottom,
          transparent 0px,
          transparent 28px,
          rgba(139,90,43,0.035) 28px,
          rgba(139,90,43,0.035) 29px
        ),
        linear-gradient(158deg,
          #FFFFFE 0%,
          #FEFBF5 22%,
          #FCF7EE 52%,
          #F7F1E4 80%,
          #F3EBD9 100%)`,
      borderTopLeftRadius: isMobile ? 4 : 8,
      borderBottomLeftRadius: isMobile ? 4 : 8,
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
      boxShadow: '5px 0 22px rgba(0,0,0,0.07), inset -2px 0 5px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.95)',
      transform: 'rotateY(-1.2deg)',
      transformOrigin: 'right center',
    } as any : {
      backgroundColor: colors.surface,
      borderRadius: isMobile ? 14 : 20,
      boxShadow: DESIGN_TOKENS.shadows.heavy,
      backgroundImage: `linear-gradient(155deg, ${colors.surface} 0%, ${colors.primarySoft} 60%, ${colors.backgroundSecondary} 100%)`,
    } as any }),
  },
  // Golden header rule — top of left page (double line like classic books)
  heroPageGoldLine: {
    position: 'absolute' as const, top: isMobile ? 16 : 20, left: isMobile ? 22 : 36, right: isMobile ? 30 : 48,
    height: 2, zIndex: 5,
    ...Platform.select({ web: {
      backgroundImage: `linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.5) 12%, rgba(212,175,55,0.78) 32%, rgba(212,175,55,0.78) 68%, rgba(212,175,55,0.5) 88%, transparent 100%)`,
      borderRadius: 1,
      boxShadow: '0 1px 0 rgba(212,175,55,0.2)',
    } as any }),
  },
  // Page curl effect on left page
  heroPageCurlLeft: {
    position: 'absolute' as const, bottom: 0, left: 0,
    width: isMobile ? 36 : 52, height: isMobile ? 36 : 52, zIndex: 3,
    ...Platform.select({ web: {
      backgroundImage: `conic-gradient(from 225deg at 0% 100%,
        rgba(200,165,90,0.15) 0deg,
        rgba(180,140,70,0.09) 45deg,
        transparent 45deg)`,
      borderBottomLeftRadius: isMobile ? 4 : 8,
      boxShadow: 'inset 2px -2px 5px rgba(139,90,43,0.06)',
    } as any }),
  },
  // Right page of the book (slider)
  sliderSection: {
    flex: 1, minWidth: 0, width: showSideSlider ? '50%' : 320, maxWidth: showSideSlider ? undefined : 600,
    position: 'relative' as const, justifyContent: 'stretch', alignSelf: 'stretch',
    ...Platform.select({ web: showSideSlider ? {
      backgroundImage: `
        repeating-linear-gradient(
          to bottom,
          transparent 0px,
          transparent 28px,
          rgba(139,90,43,0.035) 28px,
          rgba(139,90,43,0.035) 29px
        ),
        linear-gradient(202deg,
          #FFFFFE 0%,
          #FEFBF5 22%,
          #FCF7EE 52%,
          #F7F1E4 80%,
          #F3EBD9 100%)`,
      borderTopRightRadius: isMobile ? 4 : 8,
      borderBottomRightRadius: isMobile ? 4 : 8,
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
      boxShadow: '-5px 0 22px rgba(0,0,0,0.07), inset 2px 0 5px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.95)',
      transform: 'rotateY(1.2deg)',
      transformOrigin: 'left center',
      padding: isMobile ? 18 : 32,
      display: 'flex',
      flexDirection: 'column',
    } as any : {} }),
  },
  // Golden header rule — top of right page
  sliderPageGoldLine: {
    position: 'absolute' as const, top: isMobile ? 16 : 20, left: isMobile ? 30 : 48, right: isMobile ? 22 : 36,
    height: 2, zIndex: 5,
    ...Platform.select({ web: {
      backgroundImage: `linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.5) 12%, rgba(212,175,55,0.78) 32%, rgba(212,175,55,0.78) 68%, rgba(212,175,55,0.5) 88%, transparent 100%)`,
      borderRadius: 1,
      boxShadow: '0 1px 0 rgba(212,175,55,0.2)',
    } as any }),
  },
  // Page curl effect on right page
  heroPageCurlRight: {
    position: 'absolute' as const, bottom: 0, right: 0,
    width: isMobile ? 36 : 52, height: isMobile ? 36 : 52, zIndex: 3,
    ...Platform.select({ web: {
      backgroundImage: `conic-gradient(from 315deg at 100% 100%,
        rgba(200,165,90,0.15) 0deg,
        rgba(180,140,70,0.09) 45deg,
        transparent 45deg)`,
      borderBottomRightRadius: isMobile ? 4 : 8,
      boxShadow: 'inset -2px -2px 5px rgba(139,90,43,0.06)',
    } as any }),
  },
  // Page number on right page
  sliderPageNumber: {
    position: 'absolute' as const, bottom: isMobile ? 10 : 14, right: isMobile ? 14 : 20,
    fontSize: isMobile ? 10 : 11, fontWeight: '500', letterSpacing: 0.4,
    color: 'rgba(139,90,43,0.3)', zIndex: 5,
    ...Platform.select({ web: {
      fontFamily: 'Georgia, serif',
      fontStyle: 'italic',
    } as any }),
  },
  sliderContainer: {
    width: '100%', flex: 1, minHeight: sliderHeight, borderRadius: isMobile ? 8 : 10, overflow: 'hidden',
    backgroundColor: colors.surface, borderWidth: 0,
    ...Platform.select({ web: {
      boxShadow: '0 3px 0 rgba(255,255,255,0.92), 0 5px 0 rgba(212,175,55,0.22), 0 7px 28px rgba(0,0,0,0.18), inset 0 0 0 2px rgba(255,255,255,0.85)',
      borderWidth: 1,
      borderColor: 'rgba(139,90,43,0.12)',
    } as any }),
  },
  slideWrapper: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 },
  slideImage: {
    width: '100%', height: '100%',
    ...Platform.select({ web: { filter: 'saturate(1.08) contrast(1.03)' } }),
  },
  slideOverlay: {
    position: 'absolute' as const, bottom: 0, left: 0, right: 0, zIndex: 2,
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 18, pointerEvents: 'none' as const,
    ...Platform.select({ web: { backgroundImage: 'linear-gradient(to top, rgba(5,12,22,0.9) 0%, rgba(5,12,22,0.5) 50%, rgba(5,12,22,0) 100%)' } }),
  },
  slideCaption: {
    borderRadius: DESIGN_TOKENS.radii.sm, backgroundColor: 'rgba(6,14,24,0.38)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 14, paddingVertical: 11,
    maxWidth: '94%', alignSelf: 'flex-start',
    ...Platform.select({ web: { backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' } }),
  },
  slideTitle: {
    fontSize: isMobile ? 18 : 22, fontWeight: '700', color: '#FFFFFF', marginBottom: 3, letterSpacing: -0.3,
    ...(Platform.OS === 'web' ? ({ textShadow: '0px 1px 4px rgba(0,0,0,0.5)' } as any) : { textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }),
  },
  slideSubtitle: { fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.1 },
  sliderNav: {
    position: 'absolute' as const, top: '50%', left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14,
    ...Platform.select({ web: { transform: 'translateY(-50%)' } }),
  },
  sliderNavBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(10, 18, 30, 0.48)', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    ...Platform.select({ web: {
      cursor: 'pointer',
      transition: 'background-color 0.18s ease, transform 0.18s ease, border-color 0.18s ease',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
    } }),
  },
  sliderNavBtnHover: {
    backgroundColor: 'rgba(10, 18, 30, 0.75)', borderColor: 'rgba(255,255,255,0.3)',
    ...Platform.select({ web: { transform: 'scale(1.08)' } }),
  },
  sliderDots: { position: 'absolute' as const, bottom: 14, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8, zIndex: 3 },
  sliderDot: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.2s ease' } }),
  },
  sliderDotActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  slideCounter: {
    position: 'absolute' as const, bottom: 14, right: 14, zIndex: 4, paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: DESIGN_TOKENS.radii.pill, backgroundColor: 'rgba(6,14,24,0.46)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    ...Platform.select({ web: { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } }),
  },
  slideCounterText: { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.85)', letterSpacing: 0.3 },
  badge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6,
    paddingHorizontal: 13, paddingVertical: 7,
    borderRadius: DESIGN_TOKENS.radii.pill, backgroundColor: colors.primarySoft,
    borderWidth: 1, borderColor: colors.primaryAlpha30,
    ...Platform.select({ web: { boxShadow: `0 1px 6px ${colors.primary}15` } }),
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  badgeText: { fontSize: 10, fontWeight: '700', color: colors.primaryText, letterSpacing: 1.0, textTransform: 'uppercase' },
  title: {
    fontSize: isSmallPhone ? 26 : isMobile ? 32 : isTablet ? 42 : (isDesktop ? 54 : 48),
    fontWeight: '800', color: colors.text, letterSpacing: -1.5,
    lineHeight: isSmallPhone ? 32 : isMobile ? 38 : isTablet ? 50 : (isDesktop ? 62 : 56), textAlign: 'left',
  },
  titleAccent: {
    fontSize: isSmallPhone ? 26 : isMobile ? 32 : isTablet ? 42 : (isDesktop ? 54 : 48),
    fontWeight: '800', color: colors.brand, letterSpacing: -1.5,
    lineHeight: isSmallPhone ? 32 : isMobile ? 38 : isTablet ? 50 : (isDesktop ? 62 : 56), textAlign: 'left',
  },
  subtitle: {
    fontSize: isMobile ? 15 : 17, fontWeight: '400', color: colors.textMuted,
    lineHeight: isMobile ? 23 : 26, textAlign: 'left', maxWidth: 500, alignSelf: 'flex-start',
  },
  // Open book container — fairytale modern design
  openBookContainer: {
    width: '100%', marginTop: isMobile ? 8 : 12, position: 'relative' as const,
    ...Platform.select({ web: { perspective: '1800px' } as any }),
  },
  openBook: {
    flexDirection: 'row' as const, width: '100%', position: 'relative' as const,
    borderRadius: isMobile ? 6 : 10, overflow: 'visible' as const,
    backgroundColor: 'transparent',
    ...Platform.select({ web: {
      transform: 'rotateX(3deg)',
      transformStyle: 'preserve-3d',
    } as any }),
  },
  // Book cover/binding effect
  bookCover: {
    position: 'absolute' as const, left: -4, right: -4, top: -4, bottom: -4,
    borderRadius: isMobile ? 10 : 14, zIndex: -1,
    ...Platform.select({ web: {
      backgroundImage: `linear-gradient(135deg, ${colors.primary}12 0%, ${colors.primary}06 50%, ${colors.primary}10 100%)`,
      boxShadow: `0 18px 50px rgba(0,0,0,0.12), 0 6px 20px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.28)`,
    } as any }),
  },
  // Decorative bookmark ribbon
  bookmarkRibbon: {
    position: 'absolute' as const, top: -8, right: isMobile ? 20 : 32,
    width: isMobile ? 20 : 24, height: isMobile ? 50 : 60, zIndex: 10,
    ...Platform.select({ web: {
      backgroundImage: `linear-gradient(180deg, ${colors.brand} 0%, ${colors.brandDark || colors.brand} 100%)`,
      clipPath: 'polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%)',
      boxShadow: '2px 4px 8px rgba(0,0,0,0.15)',
      transform: 'translateZ(5px)',
    } as any }),
  },
  bookSpine: {
    position: 'absolute' as const, left: '50%', top: -2, bottom: -2, width: isMobile ? 6 : 8,
    backgroundColor: colors.borderLight, zIndex: 5,
    ...Platform.select({ web: {
      marginLeft: isMobile ? -3 : -4,
      backgroundImage: `linear-gradient(90deg,
        rgba(0,0,0,0.07) 0%,
        rgba(139,90,43,0.14) 22%,
        rgba(139,90,43,0.22) 50%,
        rgba(139,90,43,0.14) 78%,
        rgba(0,0,0,0.07) 100%)`,
      boxShadow: 'inset 0 0 10px rgba(0,0,0,0.18), 0 0 1px rgba(0,0,0,0.22)',
      borderRadius: 2,
    } as any }),
  },
  bookSpineShadowLeft: {
    position: 'absolute' as const, right: 0, top: 0, bottom: 0, width: isMobile ? 24 : 32,
    zIndex: 2, pointerEvents: 'none' as const,
    ...Platform.select({ web: {
      backgroundImage: 'linear-gradient(to left, rgba(0,0,0,0.07) 0%, rgba(0,0,0,0.02) 50%, transparent 100%)',
    } as any }),
  },
  bookSpineShadowRight: {
    position: 'absolute' as const, left: 0, top: 0, bottom: 0, width: isMobile ? 24 : 32,
    zIndex: 2, pointerEvents: 'none' as const,
    ...Platform.select({ web: {
      backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.07) 0%, rgba(0,0,0,0.02) 50%, transparent 100%)',
    } as any }),
  },
  bookPage: {
    flex: 1, padding: isMobile ? 12 : 16, gap: isMobile ? 8 : 10,
    position: 'relative' as const, minHeight: isMobile ? 100 : 120,
    ...Platform.select({ web: {
      backgroundImage: `linear-gradient(145deg, #FFFFFE 0%, #FEFAF2 32%, #FAF6EB 70%, #F5F0E3 100%)`,
      boxShadow: '0 4px 16px rgba(0,0,0,0.07)',
      transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    } as any }),
  },
  bookPageLeft: {
    borderRightWidth: 0,
    ...Platform.select({ web: {
      borderTopLeftRadius: isMobile ? 4 : 6,
      borderBottomLeftRadius: isMobile ? 4 : 6,
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
      transform: 'rotateY(-1.8deg)',
      transformOrigin: 'right center',
    } as any }),
  },
  bookPageRight: {
    borderLeftWidth: 0,
    ...Platform.select({ web: {
      borderTopRightRadius: isMobile ? 4 : 6,
      borderBottomRightRadius: isMobile ? 4 : 6,
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
      transform: 'rotateY(1.8deg)',
      transformOrigin: 'left center',
    } as any }),
  },
  // Page curl effect — bottom corners
  bookPageCurl: {
    position: 'absolute' as const, bottom: 0, width: isMobile ? 28 : 36, height: isMobile ? 28 : 36, zIndex: 3,
    ...Platform.select({ web: {
      backgroundImage: 'linear-gradient(135deg, transparent 50%, rgba(139,90,43,0.05) 50%, rgba(139,90,43,0.10) 100%)',
      boxShadow: '-2px -2px 4px rgba(0,0,0,0.025)',
    } as any }),
  },
  bookPageCurlLeft: {
    left: 0,
    ...Platform.select({ web: {
      transform: 'scaleX(-1)',
      borderBottomLeftRadius: isMobile ? 4 : 6,
    } as any }),
  },
  bookPageCurlRight: {
    right: 0,
    ...Platform.select({ web: {
      borderBottomRightRadius: isMobile ? 4 : 6,
    } as any }),
  },
  // Golden decorative line at top of pages
  bookPageGoldLine: {
    position: 'absolute' as const, top: 0, left: isMobile ? 12 : 16, right: isMobile ? 12 : 16,
    height: 2, zIndex: 4,
    ...Platform.select({ web: {
      backgroundImage: `linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.35) 20%, rgba(212,175,55,0.55) 50%, rgba(212,175,55,0.35) 80%, transparent 100%)`,
      borderRadius: 1,
    } as any }),
  },
  // Mobile: vertical stack layout
  highlightsGrid: { flexDirection: isNarrowLayout ? 'column' : 'row', gap: 10, width: '100%', marginTop: 8 },
  highlightCard: {
    flex: isMobile ? undefined : 1, minWidth: 0, borderRadius: DESIGN_TOKENS.radii.lg, borderWidth: 1,
    borderColor: colors.borderLight, backgroundColor: colors.surface, paddingVertical: 14, paddingHorizontal: 16, gap: 8,
    ...Platform.select({ web: { transition: 'all 0.22s ease-out', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' } }),
  },
  // Book-style highlight item (for open book layout)
  bookHighlightItem: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: isMobile ? 8 : 10,
    paddingVertical: isMobile ? 8 : 10, paddingHorizontal: isMobile ? 10 : 13,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.12)',
    ...Platform.select({ web: {
      transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      boxShadow: '0 1px 6px rgba(139,90,43,0.05), inset 0 1px 0 rgba(255,255,255,0.75)',
    } as any }),
  },
  bookHighlightItemHover: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderColor: 'rgba(212,175,55,0.25)',
    ...Platform.select({ web: {
      transform: 'translateX(4px)',
      boxShadow: '0 4px 14px rgba(139,90,43,0.10), inset 0 1px 0 rgba(255,255,255,0.88)',
    } as any }),
  },
  highlightIconWrap: {
    width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary,
    ...Platform.select({ web: { boxShadow: `0 3px 10px ${colors.primary}30` } }),
  },
  bookHighlightIconWrap: {
    width: isMobile ? 28 : 32, height: isMobile ? 28 : 32, borderRadius: 8,
    alignItems: 'center' as const, justifyContent: 'center' as const,
    backgroundColor: colors.primary,
    ...Platform.select({ web: {
      boxShadow: `0 3px 10px ${colors.primary}30, inset 0 1px 0 rgba(255,255,255,0.18)`,
      backgroundImage: `linear-gradient(145deg, ${colors.primary} 0%, ${colors.primaryDark || colors.primary} 100%)`,
    } }),
  },
  bookHighlightTextWrap: { flex: 1, gap: 2 },
  highlightTitle: { color: colors.text, fontSize: 13, lineHeight: 17, fontWeight: '700', letterSpacing: -0.1 },
  highlightSubtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
  bookHighlightTitle: { color: colors.text, fontSize: isMobile ? 12 : 13, lineHeight: isMobile ? 16 : 18, fontWeight: '600', letterSpacing: -0.15 },
  bookHighlightSubtitle: { color: colors.textMuted, fontSize: isMobile ? 10 : 11, lineHeight: isMobile ? 14 : 15 },
  // Book decorative elements — elegant page numbers
  bookPageNumber: {
    position: 'absolute' as const, bottom: isMobile ? 8 : 12,
    fontSize: isMobile ? 10 : 11, fontWeight: '500', letterSpacing: 0.4,
    color: 'rgba(139,90,43,0.3)',
    ...Platform.select({ web: {
      fontFamily: 'Georgia, serif',
      fontStyle: 'italic',
    } as any }),
  },
  bookPageNumberLeft: { left: isMobile ? 12 : 16 },
  bookPageNumberRight: { right: isMobile ? 12 : 16 },
  buttonsContainer: {
    flexDirection: isNarrowLayout ? 'column' : 'row', justifyContent: 'flex-start', alignItems: 'center',
    gap: isMobile ? 10 : 12,
    width: '100%',
    flexWrap: isNarrowLayout ? 'nowrap' : 'wrap',
    marginTop: isMobile ? 4 : 6,
  },
  primaryButton: {
    paddingHorizontal: isMobile ? 26 : 42, paddingVertical: isMobile ? 14 : 18, minHeight: isMobile ? 48 : 56,
    borderRadius: DESIGN_TOKENS.radii.pill, width: isMobile ? '100%' : undefined,
    backgroundColor: colors.brand,
    ...Platform.select({ web: {
      transition: 'background-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease',
      boxShadow: `0 4px 16px ${colors.brand}38, 0 1px 4px ${colors.brand}28`,
    } }),
  },
  primaryButtonHover: {
    backgroundColor: colors.brandDark,
    ...Platform.select({ web: { transform: 'translateY(-2px)', boxShadow: `0 8px 24px ${colors.brand}48, 0 2px 6px ${colors.brand}30` } }),
  },
  primaryButtonText: { fontSize: isMobile ? 15 : 16, fontWeight: '700', color: colors.textOnPrimary, letterSpacing: 0.1 },
  secondaryButton: {
    paddingHorizontal: isMobile ? 20 : 26, paddingVertical: isMobile ? 14 : 18, minHeight: isMobile ? 48 : 56,
    borderRadius: DESIGN_TOKENS.radii.pill, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    width: isMobile ? '100%' : undefined,
    ...Platform.select({ web: { transition: 'background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease' } }),
  },
  secondaryButtonHover: {
    backgroundColor: colors.primarySoft, borderColor: colors.primaryAlpha40,
    ...Platform.select({ web: { transform: 'translateY(-2px)' } }),
  },
  secondaryButtonText: { fontSize: 15, fontWeight: '600', color: colors.text },
  bookmarkRail: {
    width: '100%', gap: 7, alignItems: 'stretch',
    ...Platform.select({ web: {
      borderLeftWidth: 2,
      borderLeftColor: 'rgba(200,80,60,0.14)',
      paddingLeft: 14,
      marginLeft: 2,
    } as any }),
  },
  bookmarkChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 13, paddingVertical: 10,
    borderRadius: DESIGN_TOKENS.radii.sm,
    borderWidth: 1, borderColor: 'rgba(139,90,43,0.10)',
    backgroundColor: 'rgba(255,255,255,0.65)',
    ...Platform.select({ web: {
      cursor: 'pointer',
      transition: 'background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease',
      boxShadow: '0 1px 3px rgba(139,90,43,0.06), inset 0 1px 0 rgba(255,255,255,0.75)',
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
    } }),
  },
  bookmarkChipHover: {
    backgroundColor: 'rgba(255,255,255,0.92)', borderColor: 'rgba(139,90,43,0.20)',
    ...Platform.select({ web: {
      transform: 'translateX(4px)',
      boxShadow: `0 3px 12px rgba(139,90,43,0.11), inset 0 1px 0 rgba(255,255,255,0.88)`,
    } }),
  },
  bookmarkChipIcon: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: colors.primarySoft,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.primaryAlpha30,
  },
  moodChipsContainer: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.borderLight, width: '100%' },
  moodChipsScrollContent: {
    flexDirection: showSideSlider ? 'column' : 'row', gap: showSideSlider ? 7 : 10, paddingHorizontal: 0,
    justifyContent: showSideSlider ? 'flex-start' : 'center', flexWrap: showSideSlider ? 'nowrap' : 'nowrap',
  },
  moodChip: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingLeft: 0, paddingRight: 16, paddingVertical: 0,
    borderRadius: DESIGN_TOKENS.radii.lg, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.borderLight,
    overflow: 'hidden',
    minHeight: 54,
    ...Platform.select({ web: {
      cursor: 'pointer',
      transition: 'background-color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      backgroundImage: `linear-gradient(90deg, ${colors.surface} 55%, ${colors.primarySoft}44 100%)`,
    } }),
  },
  moodChipHover: {
    backgroundColor: colors.primarySoft, borderColor: colors.primaryAlpha40,
    ...Platform.select({ web: {
      boxShadow: `0 3px 14px ${colors.primary}14`,
      backgroundImage: `linear-gradient(90deg, ${colors.primarySoft} 0%, ${colors.primarySoft}88 100%)`,
    } }),
  },
  moodChipAccent: {
    width: 4, alignSelf: 'stretch', borderTopLeftRadius: DESIGN_TOKENS.radii.lg, borderBottomLeftRadius: DESIGN_TOKENS.radii.lg,
    backgroundColor: colors.primary, opacity: 0.7,
  },
  moodChipIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primarySoft,
    justifyContent: 'center', alignItems: 'center',
  },
  moodChipText: { gap: 2, flex: 1 },
  moodChipTitle: { fontSize: 14, fontWeight: '700', color: colors.text, letterSpacing: -0.2 },
  moodChipMeta: { fontSize: 11, fontWeight: '400', color: colors.textMuted, letterSpacing: 0.1 },
  popularSection: { marginTop: isMobile ? 28 : 44, width: '100%' },
  popularTitle: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1.1 },
  popularScrollContent: { flexDirection: 'row', gap: 14, paddingRight: 16 },
  // HERO-01: Featured card на мобайле
  featuredCard: {
    width: '100%', borderRadius: DESIGN_TOKENS.radii.xl, overflow: 'hidden',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight,
    marginBottom: 20, position: 'relative' as const,
    ...Platform.select({ web: {
      cursor: 'pointer',
      transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease',
      boxShadow: DESIGN_TOKENS.shadows.medium,
    } }),
  },
  featuredCardHover: {
    ...Platform.select({ web: {
      transform: 'translateY(-3px)',
      boxShadow: DESIGN_TOKENS.shadows.heavy,
      borderColor: colors.primaryAlpha30,
    } }),
  },
  featuredCardImage: { width: '100%', aspectRatio: 16 / 9 },
  featuredCardOverlay: {
    position: 'absolute' as const, bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingVertical: 14, paddingTop: 36,
    ...Platform.select({ web: { backgroundImage: 'linear-gradient(to top, rgba(5,12,22,0.88) 0%, rgba(5,12,22,0.42) 58%, transparent 100%)' } }),
  },
  featuredCardTitle: { fontSize: 17, fontWeight: '700', color: '#fff', marginBottom: 3, letterSpacing: -0.2 },
  featuredCardSubtitle: { fontSize: 12, fontWeight: '400', color: 'rgba(255,255,255,0.82)', letterSpacing: 0.1 },
  imageCard: {
    width: isMobile ? 200 : 220, borderRadius: DESIGN_TOKENS.radii.lg, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden',
    ...Platform.select({ web: {
      transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease',
      cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    } }),
  },
  imageCardHover: {
    ...Platform.select({ web: {
      transform: 'translateY(-4px)',
      boxShadow: '0 12px 28px rgba(0,0,0,0.1)',
      borderColor: colors.primaryAlpha40,
    } }),
  },
  imageCardImage: { width: isMobile ? 200 : 220, height: isMobile ? 135 : 155 },
  imageCardContent: { padding: 14, gap: 4 },
  imageCardTitle: { fontSize: 14, fontWeight: '600', color: colors.text, lineHeight: 19, letterSpacing: -0.2 },
  imageCardSubtitle: { fontSize: 12, fontWeight: '400', color: colors.textMuted, lineHeight: 17 },
});
