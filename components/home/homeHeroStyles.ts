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
    paddingTop: isMobile ? (isLandscape ? 8 : 16) : 48,
    paddingBottom: isMobile ? (isLandscape ? 12 : 24) : 72,
    backgroundColor: colors.background,
    ...Platform.select({ web: { backgroundImage: [`radial-gradient(ellipse 80% 60% at 50% -5%, ${colors.primarySoft} 0%, transparent 70%)`, `radial-gradient(ellipse 40% 30% at 90% 20%, ${colors.primaryAlpha30} 0%, transparent 60%)`].join(', '), backgroundRepeat: 'no-repeat' } }),
  },
  heroShell: {
    width: '100%', borderRadius: isMobile ? 12 : 16, borderWidth: 0,
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
      transform: showSideSlider ? 'rotateX(3deg) rotateY(-0.5deg)' : 'none',
      // Outer hardcover drop shadow — book lying on desk
      filter: showSideSlider ? 'drop-shadow(0 28px 48px rgba(0,0,0,0.28)) drop-shadow(0 8px 16px rgba(0,0,0,0.16))' : 'none',
    } as any }),
  },
  // Hardcover outer binding
  bookCoverOuter: {
    position: 'absolute' as const, left: -10, right: -10, top: -10, bottom: -10,
    borderRadius: isMobile ? 10 : 14, zIndex: -1,
    ...Platform.select({ web: {
      // Dark leather/hardcover binding
      background: `linear-gradient(160deg, 
        #3d2a1a 0%, 
        #2e1f10 30%, 
        #3a2718 60%, 
        #2a1c0e 100%)`,
      boxShadow: '0 2px 0 rgba(255,255,255,0.08) inset, 0 -2px 0 rgba(0,0,0,0.4) inset',
      // Embossed cover pattern
      backgroundImage: `
        linear-gradient(160deg, #3d2a1a 0%, #2e1f10 30%, #3a2718 60%, #2a1c0e 100%)`,
    } as any }),
  },
  heroRow: {
    flexDirection: showSideSlider ? 'row' : 'column', alignItems: 'stretch',
    justifyContent: 'flex-start', gap: 0, width: '100%',
    position: 'relative' as const,
    ...Platform.select({ web: showSideSlider ? {
      // Book pages side by side — inside hardcover
      borderRadius: isMobile ? 4 : 6,
      // Inner page border to simulate pages inside cover
      outline: '1px solid rgba(139,90,43,0.1)',
      outlineOffset: '-1px',
    } as any : {} }),
  },
  // Central book spine (between pages) — strong binding crease
  heroBookSpine: {
    position: 'absolute' as const, left: '50%', top: -10, bottom: -10, 
    width: isMobile ? 16 : 22, zIndex: 10,
    ...Platform.select({ web: {
      marginLeft: isMobile ? -8 : -11,
      background: `linear-gradient(90deg, 
        rgba(0,0,0,0.18) 0%, 
        rgba(80,45,15,0.25) 12%, 
        rgba(139,90,43,0.35) 30%,
        rgba(180,120,55,0.28) 45%,
        rgba(212,175,55,0.15) 50%,
        rgba(180,120,55,0.28) 55%,
        rgba(139,90,43,0.35) 70%,
        rgba(80,45,15,0.25) 88%,
        rgba(0,0,0,0.18) 100%)`,
      boxShadow: 'inset 0 0 20px rgba(0,0,0,0.3), 0 0 4px rgba(0,0,0,0.25)',
      borderRadius: 2,
    } as any }),
  },
  // Decorative bookmark ribbons at top — two bookmarks for realism
  heroBookmarkRibbon: {
    position: 'absolute' as const, top: -14, right: isMobile ? 40 : 80,
    width: isMobile ? 26 : 32, height: isMobile ? 70 : 88, zIndex: 15,
    ...Platform.select({ web: {
      background: `linear-gradient(180deg, ${colors.brand} 0%, ${colors.brandDark || colors.brand} 85%, rgba(0,0,0,0.2) 100%)`,
      clipPath: 'polygon(0 0, 100% 0, 100% 88%, 50% 100%, 0 88%)',
      boxShadow: '3px 6px 16px rgba(0,0,0,0.28), inset 1px 0 0 rgba(255,255,255,0.15)',
    } as any }),
  },
  // Second bookmark ribbon — shorter, teal/navy, offset left
  heroBookmarkRibbon2: {
    position: 'absolute' as const, top: -10, right: isMobile ? 72 : 126,
    width: isMobile ? 20 : 24, height: isMobile ? 52 : 64, zIndex: 14,
    ...Platform.select({ web: {
      background: `linear-gradient(180deg, #2c5f7a 0%, #1e4560 85%, rgba(0,0,0,0.25) 100%)`,
      clipPath: 'polygon(0 0, 100% 0, 100% 88%, 50% 100%, 0 88%)',
      boxShadow: '2px 5px 12px rgba(0,0,0,0.22), inset 1px 0 0 rgba(255,255,255,0.1)',
      opacity: 0.9,
    } as any }),
  },
  // Left page of the book (text content)
  heroSection: {
    alignItems: isMobile ? 'stretch' : 'flex-start', gap: isMobile ? 10 : 14,
    width: showSideSlider ? '50%' : '100%', maxWidth: showSideSlider ? undefined : (isMobile ? '100%' : 720),
    flexShrink: 0, 
    paddingHorizontal: isMobile ? 16 : 28, 
    paddingVertical: isMobile ? 20 : 32,
    paddingRight: showSideSlider ? (isMobile ? 20 : 36) : undefined,
    position: 'relative' as const,
    ...Platform.select({ web: showSideSlider ? {
      // Left page — aged paper with subtle horizontal ruling lines
      background: `
        repeating-linear-gradient(
          to bottom,
          transparent 0px,
          transparent 27px,
          rgba(139,90,43,0.04) 27px,
          rgba(139,90,43,0.04) 28px
        ),
        linear-gradient(158deg, 
          #FFFEFC 0%, 
          #FEFAF3 20%, 
          #FBF6ED 50%, 
          #F6F0E2 80%,
          #F2EAD8 100%)`,
      borderTopLeftRadius: isMobile ? 4 : 6,
      borderBottomLeftRadius: isMobile ? 4 : 6,
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
      // Gutter shadow (spine side)
      boxShadow: '6px 0 24px rgba(0,0,0,0.08), inset -2px 0 6px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
      transform: 'rotateY(-1.5deg)',
      transformOrigin: 'right center',
    } as any : {
      background: colors.surface,
      borderRadius: isMobile ? 12 : 16,
      boxShadow: DESIGN_TOKENS.shadows.heavy,
      backgroundImage: `linear-gradient(155deg, ${colors.surface} 0%, ${colors.primarySoft} 60%, ${colors.backgroundSecondary} 100%)`,
    } as any }),
  },
  // Golden header rule — top of left page (double line like classic books)
  heroPageGoldLine: {
    position: 'absolute' as const, top: isMobile ? 14 : 18, left: isMobile ? 20 : 32, right: isMobile ? 28 : 44,
    height: 3, zIndex: 5,
    ...Platform.select({ web: {
      background: `linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.6) 10%, rgba(212,175,55,0.85) 30%, rgba(212,175,55,0.85) 70%, rgba(212,175,55,0.6) 90%, transparent 100%)`,
      borderRadius: 1,
      boxShadow: '0 2px 0 rgba(212,175,55,0.25)',
    } as any }),
  },
  // Page curl effect on left page — more pronounced
  heroPageCurlLeft: {
    position: 'absolute' as const, bottom: 0, left: 0, 
    width: isMobile ? 40 : 56, height: isMobile ? 40 : 56, zIndex: 3,
    ...Platform.select({ web: {
      background: `conic-gradient(from 225deg at 0% 100%, 
        rgba(200,165,90,0.18) 0deg, 
        rgba(180,140,70,0.12) 45deg, 
        transparent 45deg)`,
      borderBottomLeftRadius: isMobile ? 4 : 6,
      boxShadow: 'inset 2px -2px 6px rgba(139,90,43,0.08)',
    } as any }),
  },
  // Right page of the book (slider)
  sliderSection: { 
    flex: 1, minWidth: 0, width: showSideSlider ? '50%' : 320, maxWidth: showSideSlider ? undefined : 600, 
    position: 'relative' as const, justifyContent: 'center',
    ...Platform.select({ web: showSideSlider ? {
      // Right page — aged paper with subtle horizontal ruling lines
      background: `
        repeating-linear-gradient(
          to bottom,
          transparent 0px,
          transparent 27px,
          rgba(139,90,43,0.04) 27px,
          rgba(139,90,43,0.04) 28px
        ),
        linear-gradient(202deg, 
          #FFFEFC 0%, 
          #FEFAF3 20%, 
          #FBF6ED 50%, 
          #F6F0E2 80%,
          #F2EAD8 100%)`,
      borderTopRightRadius: isMobile ? 4 : 6,
      borderBottomRightRadius: isMobile ? 4 : 6,
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
      // Gutter shadow (spine side)
      boxShadow: '-6px 0 24px rgba(0,0,0,0.08), inset 2px 0 6px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
      transform: 'rotateY(1.5deg)',
      transformOrigin: 'left center',
      padding: isMobile ? 16 : 28,
    } as any : {} }),
  },
  // Golden header rule — top of right page (double line)
  sliderPageGoldLine: {
    position: 'absolute' as const, top: isMobile ? 14 : 18, left: isMobile ? 28 : 44, right: isMobile ? 20 : 32,
    height: 3, zIndex: 5,
    ...Platform.select({ web: {
      background: `linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.6) 10%, rgba(212,175,55,0.85) 30%, rgba(212,175,55,0.85) 70%, rgba(212,175,55,0.6) 90%, transparent 100%)`,
      borderRadius: 1,
      boxShadow: '0 2px 0 rgba(212,175,55,0.25)',
    } as any }),
  },
  // Page curl effect on right page — more pronounced
  heroPageCurlRight: {
    position: 'absolute' as const, bottom: 0, right: 0, 
    width: isMobile ? 40 : 56, height: isMobile ? 40 : 56, zIndex: 3,
    ...Platform.select({ web: {
      background: `conic-gradient(from 315deg at 100% 100%, 
        rgba(200,165,90,0.18) 0deg, 
        rgba(180,140,70,0.12) 45deg, 
        transparent 45deg)`,
      borderBottomRightRadius: isMobile ? 4 : 6,
      boxShadow: 'inset -2px -2px 6px rgba(139,90,43,0.08)',
    } as any }),
  },
  // Page number on right page
  sliderPageNumber: {
    position: 'absolute' as const, bottom: isMobile ? 10 : 14, right: isMobile ? 14 : 20,
    fontSize: isMobile ? 10 : 11, fontWeight: '600', letterSpacing: 0.5,
    color: 'rgba(139,90,43,0.35)', zIndex: 5,
    ...Platform.select({ web: {
      fontFamily: 'Georgia, serif',
      fontStyle: 'italic',
    } as any }),
  },
  sliderContainer: {
    width: '100%', height: sliderHeight, borderRadius: isMobile ? 6 : 8, overflow: 'hidden',
    backgroundColor: colors.surface, borderWidth: 0,
    ...Platform.select({ web: { 
      // Photo pasted into album — white mat border + inner shadow
      boxShadow: '0 4px 0 rgba(255,255,255,0.95), 0 6px 0 rgba(212,175,55,0.3), 0 8px 24px rgba(0,0,0,0.2), inset 0 0 0 3px rgba(255,255,255,0.9)',
      outline: '1px solid rgba(139,90,43,0.15)',
      outlineOffset: '2px',
    } as any }),
  },
  slideWrapper: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 },
  slideImage: { width: '100%', height: '100%', ...Platform.select({ web: { filter: 'saturate(1.1) contrast(1.04) sepia(0.04)' } }) },
  slideOverlay: {
    position: 'absolute' as const, bottom: 0, left: 0, right: 0, zIndex: 2,
    paddingHorizontal: 18, paddingTop: 40, paddingBottom: 16, pointerEvents: 'none' as const,
    ...Platform.select({ web: { backgroundImage: 'linear-gradient(to top, rgba(7, 17, 29, 0.88) 0%, rgba(7, 17, 29, 0.52) 52%, rgba(7, 17, 29, 0) 100%)' } }),
  },
  slideCaption: {
    borderRadius: DESIGN_TOKENS.radii.md, backgroundColor: 'rgba(9, 20, 33, 0.42)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)', paddingHorizontal: 12, paddingVertical: 10, maxWidth: '92%', alignSelf: 'flex-start',
    ...Platform.select({ web: { backdropFilter: 'blur(6px)' } }),
  },
  slideTitle: {
    fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginBottom: 4,
    ...(Platform.OS === 'web' ? ({ textShadow: '0px 1px 3px rgba(0,0,0,0.45)' } as any) : { textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }),
  },
  slideSubtitle: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.92)' },
  sliderNav: {
    position: 'absolute' as const, top: '50%', left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12,
    ...Platform.select({ web: { transform: 'translateY(-50%)' } }),
  },
  sliderNavBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(17, 24, 39, 0.55)', justifyContent: 'center', alignItems: 'center',
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.2s ease', backdropFilter: 'blur(8px)' } }),
  },
  sliderNavBtnHover: { backgroundColor: 'rgba(17, 24, 39, 0.8)', ...Platform.select({ web: { transform: 'scale(1.05)' } }) },
  sliderDots: { position: 'absolute' as const, bottom: 14, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8, zIndex: 3 },
  sliderDot: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.2s ease' } }),
  },
  sliderDotActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  slideCounter: {
    position: 'absolute' as const, bottom: 14, right: 14, zIndex: 4, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: DESIGN_TOKENS.radii.pill, backgroundColor: 'rgba(9, 20, 33, 0.52)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    ...Platform.select({ web: { backdropFilter: 'blur(6px)' } }),
  },
  slideCounterText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  badge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 7, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: DESIGN_TOKENS.radii.pill, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primaryAlpha30,
  },
  badgeDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.success },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.primaryText, letterSpacing: 0.8, textTransform: 'uppercase' },
  title: {
    fontSize: isSmallPhone ? 26 : isMobile ? 30 : isTablet ? 40 : (isDesktop ? 52 : 46),
    fontWeight: '900', color: colors.text, letterSpacing: -1.5,
    lineHeight: isSmallPhone ? 32 : isMobile ? 36 : isTablet ? 48 : (isDesktop ? 60 : 54), textAlign: 'left',
  },
  titleAccent: {
    fontSize: isSmallPhone ? 26 : isMobile ? 30 : isTablet ? 40 : (isDesktop ? 52 : 46),
    fontWeight: '900', color: colors.brand, letterSpacing: -1.5,
    lineHeight: isSmallPhone ? 32 : isMobile ? 36 : isTablet ? 48 : (isDesktop ? 60 : 54), textAlign: 'left',
  },
  subtitle: { fontSize: isMobile ? 15 : 18, fontWeight: '400', color: colors.textMuted, lineHeight: isMobile ? 22 : 28, textAlign: 'left', maxWidth: 520, alignSelf: 'flex-start' },
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
      transform: 'rotateX(4deg)',
      transformStyle: 'preserve-3d',
    } as any }),
  },
  // Book cover/binding effect
  bookCover: {
    position: 'absolute' as const, left: -4, right: -4, top: -4, bottom: -4,
    borderRadius: isMobile ? 10 : 14, zIndex: -1,
    ...Platform.select({ web: {
      background: `linear-gradient(135deg, ${colors.primary}15 0%, ${colors.primary}08 50%, ${colors.primary}12 100%)`,
      boxShadow: `0 20px 60px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.3)`,
    } as any }),
  },
  // Decorative bookmark ribbon
  bookmarkRibbon: {
    position: 'absolute' as const, top: -8, right: isMobile ? 20 : 32,
    width: isMobile ? 20 : 24, height: isMobile ? 50 : 60, zIndex: 10,
    ...Platform.select({ web: {
      background: `linear-gradient(180deg, ${colors.brand} 0%, ${colors.brandDark || colors.brand} 100%)`,
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
      background: `linear-gradient(90deg, 
        rgba(0,0,0,0.08) 0%, 
        rgba(139,90,43,0.15) 20%, 
        rgba(139,90,43,0.25) 50%, 
        rgba(139,90,43,0.15) 80%, 
        rgba(0,0,0,0.08) 100%)`,
      boxShadow: 'inset 0 0 12px rgba(0,0,0,0.2), 0 0 1px rgba(0,0,0,0.3)',
      borderRadius: 2,
    } as any }),
  },
  bookSpineShadowLeft: {
    position: 'absolute' as const, right: 0, top: 0, bottom: 0, width: isMobile ? 24 : 32,
    zIndex: 2, pointerEvents: 'none' as const,
    ...Platform.select({ web: {
      backgroundImage: 'linear-gradient(to left, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.02) 50%, transparent 100%)',
    } as any }),
  },
  bookSpineShadowRight: {
    position: 'absolute' as const, left: 0, top: 0, bottom: 0, width: isMobile ? 24 : 32,
    zIndex: 2, pointerEvents: 'none' as const,
    ...Platform.select({ web: {
      backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.02) 50%, transparent 100%)',
    } as any }),
  },
  bookPage: {
    flex: 1, padding: isMobile ? 10 : 14, gap: isMobile ? 8 : 10,
    position: 'relative' as const, minHeight: isMobile ? 100 : 120,
    ...Platform.select({ web: {
      background: `linear-gradient(145deg, 
        #FFFEF8 0%, 
        #FDF9F0 30%, 
        #FAF6EC 70%, 
        #F5F0E4 100%)`,
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      // Paper texture effect
      backgroundImage: `
        linear-gradient(145deg, #FFFEF8 0%, #FDF9F0 30%, #FAF6EC 70%, #F5F0E4 100%),
        url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E")`,
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
      transform: 'rotateY(-2deg)',
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
      transform: 'rotateY(2deg)',
      transformOrigin: 'left center',
    } as any }),
  },
  // Page curl effect — bottom corners
  bookPageCurl: {
    position: 'absolute' as const, bottom: 0, width: isMobile ? 28 : 36, height: isMobile ? 28 : 36, zIndex: 3,
    ...Platform.select({ web: {
      background: 'linear-gradient(135deg, transparent 50%, rgba(139,90,43,0.06) 50%, rgba(139,90,43,0.12) 100%)',
      boxShadow: '-2px -2px 4px rgba(0,0,0,0.03)',
    } as any }),
  },
  bookPageCurlLeft: { 
    left: 0, 
    ...Platform.select({ web: { 
      transform: 'scaleX(-1)',
      borderBottomLeftRadius: isMobile ? 4 : 6,
    } as any }) 
  },
  bookPageCurlRight: { 
    right: 0,
    ...Platform.select({ web: { 
      borderBottomRightRadius: isMobile ? 4 : 6,
    } as any }) 
  },
  // Golden decorative line at top of pages
  bookPageGoldLine: {
    position: 'absolute' as const, top: 0, left: isMobile ? 12 : 16, right: isMobile ? 12 : 16,
    height: 2, zIndex: 4,
    ...Platform.select({ web: {
      background: `linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.4) 20%, rgba(212,175,55,0.6) 50%, rgba(212,175,55,0.4) 80%, transparent 100%)`,
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
  // Book-style highlight item (for open book layout) — fairytale style
  bookHighlightItem: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: isMobile ? 8 : 10,
    paddingVertical: isMobile ? 7 : 9, paddingHorizontal: isMobile ? 8 : 12,
    borderRadius: 8, 
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)',
    ...Platform.select({ web: {
      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      backdropFilter: 'blur(8px)',
      boxShadow: '0 2px 8px rgba(139,90,43,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
    } as any }),
  },
  bookHighlightItemHover: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderColor: 'rgba(212,175,55,0.3)',
    ...Platform.select({ web: { 
      transform: 'translateX(4px) scale(1.02)',
      boxShadow: '0 4px 16px rgba(139,90,43,0.12), inset 0 1px 0 rgba(255,255,255,0.9)',
    } as any }),
  },
  highlightIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, ...Platform.select({ web: { boxShadow: `0 3px 10px ${colors.primary}35` } }) },
  bookHighlightIconWrap: {
    width: isMobile ? 28 : 32, height: isMobile ? 28 : 32, borderRadius: 8,
    alignItems: 'center' as const, justifyContent: 'center' as const,
    backgroundColor: colors.primary,
    ...Platform.select({ web: { 
      boxShadow: `0 4px 12px ${colors.primary}35, inset 0 1px 0 rgba(255,255,255,0.2)`,
      background: `linear-gradient(145deg, ${colors.primary} 0%, ${colors.primaryText || colors.primary} 100%)`,
    } }),
  },
  bookHighlightTextWrap: { flex: 1, gap: 2 },
  highlightTitle: { color: colors.text, fontSize: 13, lineHeight: 17, fontWeight: '700', letterSpacing: -0.1 },
  highlightSubtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
  bookHighlightTitle: { color: colors.text, fontSize: isMobile ? 12 : 13, lineHeight: isMobile ? 15 : 17, fontWeight: '700', letterSpacing: -0.2 },
  bookHighlightSubtitle: { color: colors.textMuted, fontSize: isMobile ? 10 : 11, lineHeight: isMobile ? 13 : 15 },
  // Book decorative elements — elegant page numbers
  bookPageNumber: {
    position: 'absolute' as const, bottom: isMobile ? 8 : 12,
    fontSize: isMobile ? 10 : 11, fontWeight: '600', letterSpacing: 0.5,
    color: 'rgba(139,90,43,0.35)',
    ...Platform.select({ web: {
      fontFamily: 'Georgia, serif',
      fontStyle: 'italic',
    } as any }),
  },
  bookPageNumberLeft: { left: isMobile ? 12 : 16 },
  bookPageNumberRight: { right: isMobile ? 12 : 16 },
  buttonsContainer: {
    flexDirection: isNarrowLayout ? 'column' : 'row', justifyContent: 'flex-start', alignItems: 'center',
    gap: isMobile ? 8 : 10,
    width: '100%',
    flexWrap: isNarrowLayout ? 'nowrap' : 'wrap',
    marginTop: 2,
  },
  primaryButton: {
    paddingHorizontal: isMobile ? 24 : 40, paddingVertical: isMobile ? 13 : 17, minHeight: isMobile ? 46 : 54,
    borderRadius: DESIGN_TOKENS.radii.pill, width: isMobile ? '100%' : undefined,
    backgroundColor: colors.brand,
    ...Platform.select({ web: { transition: 'all 0.2s ease', boxShadow: `0 4px 14px ${colors.brand}40` } }),
  },
  primaryButtonHover: { backgroundColor: colors.brandDark, ...Platform.select({ web: { transform: 'translateY(-2px)', boxShadow: `0 6px 20px ${colors.brand}50` } }) },
  primaryButtonText: { fontSize: isMobile ? 15 : 16, fontWeight: '700', color: colors.textOnPrimary },
  secondaryButton: {
    paddingHorizontal: isMobile ? 18 : 24, paddingVertical: isMobile ? 13 : 17, minHeight: isMobile ? 46 : 54,
    borderRadius: DESIGN_TOKENS.radii.pill, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.borderLight,
    width: isMobile ? '100%' : undefined,
    ...Platform.select({ web: { transition: 'all 0.2s ease' } }),
  },
  secondaryButtonHover: { backgroundColor: colors.primarySoft, borderColor: colors.primaryAlpha30, ...Platform.select({ web: { transform: 'translateY(-2px)' } }) },
  secondaryButtonText: { fontSize: 15, fontWeight: '600', color: colors.text },
  bookmarkRail: {
    width: '100%', gap: 6, alignItems: 'stretch',
    ...Platform.select({ web: {
      // Left margin rule — red vertical line like a classic ruled notebook
      borderLeftWidth: 2,
      borderLeftColor: 'rgba(200,80,60,0.18)',
      paddingLeft: 12,
      marginLeft: 4,
    } as any }),
  },
  bookmarkChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: DESIGN_TOKENS.radii.md,
    borderWidth: 1, borderColor: 'rgba(139,90,43,0.12)',
    backgroundColor: 'rgba(255,255,255,0.7)',
    ...Platform.select({ web: { 
      cursor: 'pointer', transition: 'all 0.2s ease-out',
      boxShadow: '0 1px 3px rgba(139,90,43,0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
      backdropFilter: 'blur(4px)',
    } }),
  },
  bookmarkChipHover: {
    backgroundColor: 'rgba(255,255,255,0.95)', borderColor: 'rgba(139,90,43,0.22)',
    ...Platform.select({ web: { transform: 'translateX(5px)', boxShadow: `0 4px 14px rgba(139,90,43,0.14), inset 0 1px 0 rgba(255,255,255,0.9)` } }),
  },
  bookmarkChipIcon: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: colors.primarySoft,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.primaryAlpha30,
  },
  moodChipsContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderLight, width: '100%' },
  moodChipsScrollContent: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 0,
    justifyContent: showSideSlider ? 'flex-start' : 'center', flexWrap: showSideSlider ? 'wrap' : 'nowrap',
  },
  moodChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: DESIGN_TOKENS.radii.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight,
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.2s ease-out', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' } }),
  },
  moodChipHover: { backgroundColor: colors.primarySoft, borderColor: colors.primary, ...Platform.select({ web: { transform: 'translateY(-2px)', boxShadow: `0 6px 16px ${colors.primary}15` } }) },
  moodChipIcon: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primarySoft,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.primaryAlpha30,
  },
  moodChipText: { gap: 2 },
  moodChipTitle: { fontSize: 14, fontWeight: '600', color: colors.text, letterSpacing: -0.1 },
  moodChipMeta: { fontSize: 12, fontWeight: '400', color: colors.textMuted },
  popularSection: { marginTop: isMobile ? 28 : 44, width: '100%' },
  popularTitle: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.8 },
  popularScrollContent: { flexDirection: 'row', gap: 16, paddingRight: 16 },
  // HERO-01: Featured card на мобайле
  featuredCard: {
    width: '100%', borderRadius: DESIGN_TOKENS.radii.xl, overflow: 'hidden',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight,
    marginBottom: 20, position: 'relative' as const,
    ...Platform.select({ web: { cursor: 'pointer', transition: 'all 0.22s ease', boxShadow: DESIGN_TOKENS.shadows.medium } }),
  },
  featuredCardHover: { ...Platform.select({ web: { transform: 'translateY(-3px)', boxShadow: DESIGN_TOKENS.shadows.heavy, borderColor: colors.primaryAlpha30 } }) },
  featuredCardImage: { width: '100%', aspectRatio: 16 / 9 },
  featuredCardOverlay: {
    position: 'absolute' as const, bottom: 0, left: 0, right: 0,
    paddingHorizontal: 14, paddingVertical: 12, paddingTop: 32,
    ...Platform.select({ web: { backgroundImage: 'linear-gradient(to top, rgba(7,17,29,0.85) 0%, rgba(7,17,29,0.4) 60%, transparent 100%)' } }),
  },
  featuredCardTitle: { fontSize: 17, fontWeight: '800', color: '#fff', marginBottom: 2 },
  featuredCardSubtitle: { fontSize: 12, fontWeight: '400', color: 'rgba(255,255,255,0.85)' },
  imageCard: {
    width: isMobile ? 200 : 220, borderRadius: DESIGN_TOKENS.radii.lg, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden',
    ...Platform.select({ web: { transition: 'all 0.22s ease-out', cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' } }),
  },
  imageCardHover: { ...Platform.select({ web: { transform: 'translateY(-4px)', boxShadow: '0 12px 28px rgba(0,0,0,0.1)', borderColor: colors.primary } }) },
  imageCardImage: { width: isMobile ? 200 : 220, height: isMobile ? 135 : 155 },
  imageCardContent: { padding: 14, gap: 4 },
  imageCardTitle: { fontSize: 15, fontWeight: '600', color: colors.text, lineHeight: 20, letterSpacing: -0.2 },
  imageCardSubtitle: { fontSize: 12, fontWeight: '400', color: colors.textMuted, lineHeight: 17 },
});
