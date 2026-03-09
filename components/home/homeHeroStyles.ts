// components/home/homeHeroStyles.ts
// Premium "My Travel Book" — digital scrapbook aesthetic
// Modern CSS 2026: clamp() fluid typography, CSS grid for page layout, minimal JS math

import { StyleSheet, Platform } from 'react-native'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import type { useThemedColors } from '@/hooks/useTheme'

type Colors = ReturnType<typeof useThemedColors>

interface HeroStyleParams {
  colors: Colors
  isMobile: boolean
  isSmallPhone: boolean
  isNarrowLayout: boolean
  isTablet: boolean
  isDesktop: boolean
  viewportWidth?: number
  showSideSlider: boolean
  sliderHeight: number
  /** RESP-05: landscape orientation on mobile */
  isLandscape?: boolean
  /** Measured height of book wrapper (width * 765/1040), 0 before first layout */
  bookHeight?: number
  stackHeroButtons?: boolean
}

export const createHomeHeroStyles = ({
  colors,
  isMobile,
  isSmallPhone,
  isNarrowLayout,
  isTablet: _isTablet,
  isDesktop: _isDesktop,
  viewportWidth = 0,
  showSideSlider,
  sliderHeight,
  isLandscape = false,
  bookHeight = 0,
  stackHeroButtons = false,
}: HeroStyleParams) => {
  const hasBookLayout = showSideSlider && bookHeight > 0
  const isUltraWideBook = showSideSlider && viewportWidth >= 2560
  const isLargeDesktopBook = showSideSlider && viewportWidth >= 1920
  const isNarrowDesktopBook =
    showSideSlider && viewportWidth >= 1280 && viewportWidth < 1480

  // Modern CSS 2026: fluid values via clamp() — no JS scaling math
  // All vw-based values reference the viewport, matching how the book fills screen
  // Book occupies ~90vw capped at 1400px. Left page ≈ 54% of that ≈ 27vw.
  // Title: fluid 24px → 42px across 1280–2560px viewport range
  const desktopBookTitleSize = hasBookLayout
    ? `clamp(24px, ${isNarrowDesktopBook ? '2.1vw' : isUltraWideBook ? '2.8vw' : isLargeDesktopBook ? '2.5vw' : '2.3vw'}, ${isNarrowDesktopBook ? 36 : isUltraWideBook ? 74 : isLargeDesktopBook ? 62 : 42}px)`
    : '54px'
  const desktopBookTitleLineHeight = hasBookLayout
    ? `clamp(30px, ${isNarrowDesktopBook ? '2.6vw' : isUltraWideBook ? '3.4vw' : isLargeDesktopBook ? '3.1vw' : '2.9vw'}, ${isNarrowDesktopBook ? 40 : isUltraWideBook ? 82 : isLargeDesktopBook ? 68 : 50}px)`
    : '64px'
  const desktopBookSubtitleSize = hasBookLayout
    ? `clamp(12px, ${isNarrowDesktopBook ? '0.85vw' : isUltraWideBook ? '1.1vw' : isLargeDesktopBook ? '0.95vw' : '0.9vw'}, ${isNarrowDesktopBook ? 13 : isUltraWideBook ? 22 : isLargeDesktopBook ? 18 : 14}px)`
    : '17px'
  const desktopBookSubtitleLineHeight = hasBookLayout
    ? `clamp(18px, ${isNarrowDesktopBook ? '1.4vw' : '1.6vw'}, ${isUltraWideBook ? 32 : isLargeDesktopBook ? 27 : 22}px)`
    : '28px'

  // Left page padding: percentage-based relative to heroSection width so it scales naturally.
  // The book image has spine/binding ~14% from left, ~6% from right, ~7% top, ~11% bottom.
  // Percentages here are of the heroSection element (left page column = 54% of book width).
  // 14% of left-page-width ≈ 10% of full book width — so we use ~19% to reach past spine.
  const leftPagePaddingLeft = hasBookLayout
    ? isUltraWideBook
      ? '17%'
      : isLargeDesktopBook
        ? '18%'
        : isNarrowDesktopBook
          ? '16%'
          : '17%'
    : 100
  const leftPagePaddingRight = hasBookLayout
    ? isUltraWideBook
      ? '8%'
      : '9%'
    : 16
  const leftPagePaddingTop = hasBookLayout
    ? isUltraWideBook
      ? '8%'
      : isLargeDesktopBook
        ? '8.5%'
        : '9%'
    : 48
  const leftPageWidth = showSideSlider
    ? isNarrowDesktopBook
      ? '49%'
      : '50%'
    : '100%'
  const rightPageWidth = showSideSlider
    ? isNarrowDesktopBook
      ? '51%'
      : '50%'
    : 320
  const isCompactBookLayout = hasBookLayout && bookHeight <= 760
  const isVeryCompactBookLayout = hasBookLayout && bookHeight <= 640

  const leftPagePaddingBottom = hasBookLayout
    ? isUltraWideBook
      ? '14%'
      : isLargeDesktopBook
        ? '15%'
        : isCompactBookLayout
          ? '17%'
          : '18%'
    : 110

  // Adaptive chip sizing based on available book height
  const _chipPaddingV = isVeryCompactBookLayout
    ? 4
    : isCompactBookLayout
      ? 5
      : 6
  const _chipGap = isVeryCompactBookLayout ? 4 : isCompactBookLayout ? 5 : 6
  const _chipIconSize = isVeryCompactBookLayout
    ? 22
    : isCompactBookLayout
      ? 24
      : 28

  const warmBg = DESIGN_TOKENS.colors.background
  const warmBgSoft = DESIGN_TOKENS.colors.backgroundSecondary
  const cardSurface = DESIGN_TOKENS.colors.surface
  const warmBorder = DESIGN_TOKENS.colors.borderAccent
  const warmShadow = 'rgba(58, 58, 58, 0.12)'
  const warmGold = DESIGN_TOKENS.colors.warningAlpha40
  const inkStrong = DESIGN_TOKENS.colors.text
  const inkMuted = DESIGN_TOKENS.colors.textMuted
  const inkSubtle = DESIGN_TOKENS.colors.textSubtle
  const serif = 'Georgia, "Times New Roman", serif'
  const sansSerif =
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", sans-serif'
  const editorialSerif = 'Baskerville, Georgia, "Times New Roman", serif'
  const editorialCaps =
    '"Cormorant Garamond", Baskerville, Georgia, "Times New Roman", serif'

  return StyleSheet.create({
    container: {
      width: '100%',
      paddingTop: isMobile ? (isLandscape ? 0 : 8) : showSideSlider ? 20 : 8,
      paddingBottom: isMobile
        ? isLandscape
          ? 8
          : 16
        : showSideSlider
          ? 24
          : 8,
      backgroundColor: warmBg,
      ...Platform.select({
        web: {
          backgroundImage: 'none',
          backgroundColor: warmBg,
        },
      }),
    },

    // -- Shell & book wrapper --
    heroShell: {
      width: '100%',
      borderRadius: 0,
      borderWidth: 0,
      backgroundColor: 'transparent',
      paddingHorizontal: 0,
      paddingVertical: 0,
      position: 'relative' as const,
      overflow: 'visible' as const,
    },
    bookWrapper: {
      width: '100%',
      position: 'relative' as const,
      ...(showSideSlider && bookHeight > 0 ? { height: bookHeight } : {}),
      ...Platform.select({
        web: showSideSlider
          ? ({
              backgroundImage: 'url(/assets/images/open-book-bg.png)',
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat',
              aspectRatio: '1040 / 765',
              maxHeight: 'calc(100vh - 130px)',
              maxWidth: isUltraWideBook
                ? 1780
                : isLargeDesktopBook
                  ? 1600
                  : 1400,
              marginLeft: 'auto',
              marginRight: 'auto',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              visibility: bookHeight > 0 ? 'visible' : 'hidden',
            } as any)
          : ({
              backgroundImage: 'none',
            } as any),
      }),
    },
    bookCoverOuter: {
      position: 'absolute' as const,
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      zIndex: -1,
    },
    // -- Two-page layout --
    heroRow: {
      flexDirection: showSideSlider ? 'row' : 'column',
      alignItems: 'stretch',
      justifyContent: 'flex-start',
      gap: 0,
      width: '100%',
      position: 'relative' as const,
      ...(showSideSlider && bookHeight > 0 ? { height: bookHeight } : {}),
      ...Platform.select({
        web: showSideSlider
          ? ({
              borderRadius: 0,
              overflow: 'hidden',
              flex: 1,
              flexWrap: 'nowrap',
              // Строго ограничиваем ширину контейнера
              maxWidth: '100%',
              boxSizing: 'border-box',
            } as any)
          : {},
      }),
    },
    heroBookSpine: {
      position: 'absolute' as const,
      left: '50%',
      top: 0,
      bottom: 0,
      width: 0,
      zIndex: 10,
    },

    // -- Left page (text content) --
    // Modern CSS 2026: percentage padding mirrors right page proportions exactly.
    // No double-padding: heroSection owns all padding, leftPageFrame is zero-overhead.
    heroSection: {
      alignItems: isMobile ? 'stretch' : 'flex-start',
      gap: showSideSlider ? 0 : isMobile ? 16 : 20,
      width: leftPageWidth,
      maxWidth: showSideSlider ? leftPageWidth : isMobile ? '100%' : 720,
      flexShrink: 0,
      flexGrow: 0,
      paddingLeft: isMobile ? 20 : 48,
      paddingRight: isMobile ? 20 : 48,
      paddingTop: isMobile ? 28 : 36,
      paddingBottom: isMobile ? 28 : 36,
      position: 'relative' as const,
      ...Platform.select({
        web: showSideSlider
          ? ({
              backgroundColor: 'transparent',
              borderRadius: 0,
              paddingLeft: leftPagePaddingLeft,
              paddingRight: leftPagePaddingRight,
              paddingTop: leftPagePaddingTop,
              paddingBottom: leftPagePaddingBottom,
              boxSizing: 'border-box',
              overflow: 'hidden',
              // CSS grid: top-group auto, flexible space, cta auto pinned to bottom
              // Works with or without chips row — CTA always lands at bottom via align-self
              display: 'grid',
              gridTemplateRows: 'auto 1fr auto',
              alignSelf: 'stretch',
              height: '100%',
              maxHeight: '100%',
              // Строго ограничиваем ширину левой страницы
              minWidth: 0,
            } as any)
          : ({
              backgroundColor: isMobile
                ? 'rgba(255,255,255,0.85)'
                : 'transparent',
              borderRadius: isMobile ? 8 : 0,
            } as any),
      }),
    },
    leftPageFrame: {
      // Kept for testID and structure — zero extra padding, grid already on heroSection
      width: '100%',
      flex: 1,
      minHeight: 0,
      position: 'relative' as const,
      overflow: 'hidden',
      ...Platform.select({
        web: showSideSlider
          ? ({
              display: 'contents', // grid passthrough — children participate in heroSection's grid
            } as any)
          : {},
      }),
    },
    heroPageGoldLine: {
      position: 'absolute' as const,
      top: 0,
      left: '12%',
      right: '12%',
      height: 1,
      zIndex: 5,
      ...Platform.select({
        web: {
          backgroundImage: `linear-gradient(90deg, 
        transparent 0%, 
        rgba(180,150,80,0.35) 15%, 
        rgba(180,150,80,0.35) 85%, 
        transparent 100%
      )`,
        } as any,
      }),
    },
    heroPageCurlLeft: {
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      width: 0,
      height: 0,
      zIndex: 3,
    },

    // -- Right page (slider / photo) --
    sliderSection: {
      flex: showSideSlider ? 1 : 0,
      flexGrow: showSideSlider ? 1 : 0,
      flexShrink: 1,
      minWidth: 0,
      width: rightPageWidth,
      maxWidth: showSideSlider ? rightPageWidth : 600,
      position: 'relative' as const,
      alignSelf: 'stretch',
      minHeight: showSideSlider ? 0 : sliderHeight + (isMobile ? 40 : 64),
      ...Platform.select({
        web: showSideSlider
          ? ({
              backgroundColor: 'transparent',
              borderRadius: 0,
              paddingTop: isUltraWideBook
                ? '6%'
                : isLargeDesktopBook
                  ? '6.5%'
                  : '6.5%',
              paddingBottom: isUltraWideBook
                ? '14%'
                : isLargeDesktopBook
                  ? '15%'
                  : '16%',
              paddingLeft: isUltraWideBook
                ? '1%'
                : isNarrowDesktopBook
                  ? '1%'
                  : '2%',
              paddingRight: isNarrowDesktopBook ? '13%' : '15%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'stretch',
              boxSizing: 'border-box',
              overflow: 'hidden',
            } as any)
          : {},
      }),
    },
    sliderFrame: {
      width: '100%',
      flex: 1,
      minHeight: 0,
      position: 'relative' as const,
      overflow: 'hidden',
      borderRadius: isNarrowDesktopBook ? 12 : 10,
      ...Platform.select({
        web: {
          alignSelf: 'stretch',
          clipPath: `inset(0 round ${isNarrowDesktopBook ? 12 : 10}px)`,
          boxSizing: 'border-box',
        } as any,
      }),
    },
    sliderPageGoldLine: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 5,
      borderWidth: 0,
      ...Platform.select({
        web: {
          display: 'none',
        } as any,
      }),
    },
    heroPageCurlRight: {
      position: 'absolute' as const,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
      zIndex: 3,
    },
    sliderPageNumber: {
      position: 'absolute' as const,
      bottom: isMobile ? 10 : 14,
      right: isMobile ? 14 : 20,
      fontSize: isMobile ? 10 : 11,
      fontWeight: '400',
      letterSpacing: 0.4,
      color: 'rgba(140,110,60,0.3)',
      zIndex: 5,
      ...Platform.select({
        web: {
          fontFamily: serif,
          fontStyle: 'italic',
        } as any,
      }),
    },

    // -- Slider / immersive photo --
    // Cinematic photo effect: subtle rotation, clean shadow, no busy border
    sliderContainer: {
      width: '100%',
      flex: 1,
      minHeight: hasBookLayout ? 0 : sliderHeight,
      borderRadius: isMobile ? 4 : 8,
      overflow: 'hidden',
      backgroundColor: DESIGN_TOKENS.colors.overlay,
      borderWidth: 0,
      ...Platform.select({
        web: showSideSlider
          ? ({
              boxShadow: `
        0 0 0 1px rgba(246,239,227,0.46),
        0 8px 28px rgba(24,17,11,0.2),
        0 2px 6px rgba(24,17,11,0.12),
        inset 0 0 0 1px rgba(248,242,233,0.2)
      `,
              minHeight: 0,
              flexGrow: 1,
              flexShrink: 1,
              transform: isNarrowDesktopBook
                ? 'rotate(-1.2deg)'
                : 'rotate(-0.8deg)',
              transformOrigin: 'center center',
              borderRadius: 8,
              border: '1px solid rgba(247,241,232,0.56)',
              isolation: 'isolate',
            } as any)
          : ({
              boxShadow:
                '0 4px 24px rgba(10,8,6,0.16), 0 1px 4px rgba(10,8,6,0.08)',
              minHeight: hasBookLayout ? 0 : sliderHeight,
              flexGrow: 1,
              flexShrink: 1,
              transform: 'none',
              transformOrigin: 'center center',
            } as any),
      }),
    },
    slideWrapper: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      ...Platform.select({ web: { transition: 'opacity 0.6s ease' } as any }),
    },
    slideImage: {
      width: '100%',
      height: '100%',
      ...Platform.select({
        web: { filter: 'saturate(1.03) contrast(1.01) brightness(0.98)' },
      }),
    },
    sliderPaperInset: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1,
      pointerEvents: 'none' as const,
      ...Platform.select({
        web: {
          boxShadow: `
            inset 0 1px 0 rgba(255,248,238,0.55),
            inset 0 0 0 1px rgba(255,247,236,0.18),
            inset 14px 0 22px rgba(255,247,235,0.12),
            inset -10px 0 18px rgba(78,60,40,0.08),
            inset 0 10px 16px rgba(255,248,239,0.08),
            inset 0 -10px 18px rgba(24,17,11,0.08)
          `,
        } as any,
      }),
    },
    sliderPaperFrame: {
      position: 'absolute' as const,
      top: 8,
      left: 8,
      right: 8,
      bottom: 8,
      zIndex: 1,
      borderRadius: isMobile ? 2 : 5,
      pointerEvents: 'none' as const,
      ...Platform.select({
        web: {
          border: '1px solid rgba(237,228,214,0.78)',
          boxShadow:
            'inset 0 0 0 1px rgba(110,86,58,0.06), inset 0 0 24px rgba(255,247,234,0.04)',
        } as any,
      }),
    },
    slideOverlay: {
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 3,
      paddingHorizontal: 20,
      paddingTop: 72,
      paddingBottom: 20,
      pointerEvents: 'none' as const,
      ...Platform.select({
        web: showSideSlider
          ? {
              backgroundImage:
                'linear-gradient(to top, rgba(26,19,13,0.8) 0%, rgba(26,19,13,0.44) 30%, rgba(26,19,13,0.14) 56%, rgba(26,19,13,0.02) 70%, transparent 100%)',
            }
          : {
              backgroundImage:
                'linear-gradient(to top, rgba(8,6,4,0.92) 0%, rgba(8,6,4,0.5) 50%, transparent 100%)',
            },
      }),
    },
    sliderEdgeBlur: {
      position: 'absolute' as const,
      top: 0,
      bottom: 0,
      width: 62,
      zIndex: 1,
      pointerEvents: 'none' as const,
      opacity: 0,
      ...Platform.select({
        web: {
          backdropFilter: 'blur(0px)',
          WebkitBackdropFilter: 'blur(0px)',
        } as any,
      }),
    },
    sliderEdgeBlurLeft: {
      left: 0,
      ...Platform.select({
        web: {
          backgroundImage: 'none',
        } as any,
      }),
    },
    sliderEdgeBlurRight: {
      right: 0,
      ...Platform.select({
        web: {
          backgroundImage: 'none',
        } as any,
      }),
    },
    sliderTopBlur: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      height: 62,
      zIndex: 1,
      pointerEvents: 'none' as const,
      opacity: showSideSlider ? 1 : 0,
      ...Platform.select({
        web: {
          backgroundImage: `
            linear-gradient(180deg, rgba(255,249,241,0.44) 0%, rgba(255,247,238,0.14) 26%, rgba(255,247,238,0.02) 52%, transparent 72%),
            linear-gradient(90deg, rgba(112,84,55,0.08) 0%, rgba(255,248,239,0) 14%, rgba(255,248,239,0) 84%, rgba(94,69,45,0.05) 100%)
          `,
        } as any,
      }),
    },
    sliderPageWave: {
      position: 'absolute' as const,
      left: '-1%',
      right: '-1.5%',
      zIndex: 1,
      pointerEvents: 'none' as const,
      opacity: showSideSlider ? 1 : 0,
      ...Platform.select({
        web: {
          mixBlendMode: 'normal',
        } as any,
      }),
    },
    sliderPageWaveTop: {
      top: -2,
      left: '-0.6%',
      right: '-2.2%',
      height: isNarrowDesktopBook ? 48 : 58,
      ...Platform.select({
        web: {
          backgroundImage: `
          radial-gradient(68% 116% at 18% -46%, rgba(255,250,243,0.82) 0%, rgba(255,248,240,0.42) 18%, rgba(255,248,240,0.08) 38%, rgba(255,248,240,0) 56%),
          radial-gradient(86% 120% at 86% -38%, rgba(255,250,243,0.52) 0%, rgba(255,247,238,0.22) 20%, rgba(255,247,238,0.06) 34%, rgba(255,247,238,0) 50%),
          linear-gradient(180deg, rgba(255,250,243,0.18) 0%, rgba(255,250,243,0.06) 34%, rgba(255,250,243,0) 74%)
        `,
          filter: 'blur(0.12px)',
          transform: 'skewX(-1.35deg) scaleX(1.018)',
        } as any,
      }),
    },
    sliderPageWaveBottom: {
      bottom: -2,
      left: '-1.8%',
      right: '-0.8%',
      height: isNarrowDesktopBook ? 64 : 78,
      ...Platform.select({
        web: {
          backgroundImage: `
          radial-gradient(78% 124% at 28% 122%, rgba(255,245,233,0.1) 0%, rgba(255,244,232,0.18) 12%, rgba(255,242,229,0.26) 20%, rgba(41,30,20,0.2) 42%, rgba(24,17,11,0.56) 74%, rgba(24,17,11,0) 100%),
          radial-gradient(90% 130% at 92% 124%, rgba(255,245,231,0.06) 0%, rgba(255,243,229,0.12) 11%, rgba(255,241,226,0.18) 18%, rgba(35,26,18,0.16) 38%, rgba(24,17,11,0.42) 70%, rgba(24,17,11,0) 100%),
          linear-gradient(to top, rgba(24,17,11,0.44) 0%, rgba(24,17,11,0.18) 34%, rgba(24,17,11,0.03) 66%, rgba(24,17,11,0) 100%)
        `,
          filter: 'blur(0.16px)',
          transform: 'skewX(1.9deg) scaleX(1.026)',
        } as any,
      }),
    },
    slideEyebrow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      marginBottom: 12,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: 'rgba(252,248,241,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(244,235,221,0.24)',
      ...Platform.select({
        web: {
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        },
      }),
    },
    slideEyebrowText: {
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '500',
      letterSpacing: 0.45,
      color: 'rgba(247,240,228,0.94)',
      textTransform: 'uppercase' as const,
      ...Platform.select({ web: { fontFamily: editorialCaps } as any }),
    },
    slideCaption: {
      borderRadius: 0,
      backgroundColor: 'transparent',
      borderWidth: 0,
      paddingHorizontal: 0,
      paddingVertical: 0,
      maxWidth: '90%',
      alignSelf: 'flex-start',
    },
    slideTitle: {
      fontSize: isMobile ? 20 : showSideSlider ? 24 : 26,
      fontWeight: '700',
      color: DESIGN_TOKENS.colors.textOnDark,
      marginBottom: 6,
      letterSpacing: -0.35,
      ...Platform.select({
        web: showSideSlider
          ? {
              fontFamily: editorialSerif,
              textShadow: '0 1px 10px rgba(0,0,0,0.34)',
              lineHeight: '1.25',
              letterSpacing: '-0.015em',
            }
          : ({
              fontFamily: sansSerif,
              textShadow: '0 2px 10px rgba(0,0,0,0.55)',
            } as any),
      }),
    },
    slideSubtitle: {
      fontSize: 12,
      fontWeight: '400',
      color: 'rgba(239,229,214,0.82)',
      letterSpacing: 0.12,
      ...Platform.select({ web: { fontFamily: editorialSerif } as any }),
    },

    // -- Slider navigation --
    sliderNav: {
      position: 'absolute' as const,
      top: '50%',
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
      ...Platform.select({
        web: { transform: 'translateY(-50%)', pointerEvents: 'none' },
      }),
    },
    sliderNavBtn: {
      width: showSideSlider ? 32 : 40,
      height: showSideSlider ? 32 : 40,
      borderRadius: showSideSlider ? 16 : 20,
      backgroundColor: 'rgba(248,241,231,0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(248,240,228,0.3)',
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition:
            'background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          pointerEvents: 'auto',
        },
      }),
    },
    sliderNavBtnHover: {
      backgroundColor: 'rgba(248,241,231,0.18)',
      borderColor: 'rgba(248,240,228,0.42)',
      ...Platform.select({ web: { transform: 'scale(1.03)' } as any }),
    },
    sliderDots: {
      position: 'absolute' as const,
      bottom: 14,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      zIndex: 3,
    },
    sliderDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
      ...Platform.select({
        web: { cursor: 'pointer', transition: 'all 0.2s ease' },
      }),
    },
    sliderDotActive: {
      backgroundColor: colors.brand,
      borderColor: colors.brand,
    },
    slideCounter: {
      position: 'absolute' as const,
      bottom: 16,
      right: 16,
      zIndex: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: 'rgba(20,18,14,0.58)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
      ...Platform.select({
        web: {
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        },
      }),
    },
    slideCounterText: {
      fontSize: 11,
      fontWeight: '500',
      color: 'rgba(255,255,255,0.8)',
      letterSpacing: 0.4,
      ...Platform.select({ web: { fontFamily: sansSerif } as any }),
    },

    // -- Slider thumbnails (photo album style) --
    sliderThumbnails: {
      flexDirection: 'row' as const,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 8,
      backgroundColor: 'transparent',
      marginTop: 8,
    },
    sliderThumb: {
      width: 44,
      height: 32,
      borderRadius: 4,
      overflow: 'hidden' as const,
      borderWidth: 2,
      borderColor: 'transparent',
      opacity: 0.55,
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        },
      }),
    },
    sliderThumbActive: {
      borderColor: colors.brand,
      opacity: 1,
      ...Platform.select({
        web: {
          transform: 'scale(1.08)',
          boxShadow: `0 2px 8px ${colors.brand}30`,
        },
      }),
    },
    sliderThumbHover: {
      opacity: 0.85,
      ...Platform.select({
        web: {
          transform: 'scale(1.05)',
        },
      }),
    },

    // -- Bookmark ribbon (decorative) --
    bookmarkRibbon: {
      position: 'absolute' as const,
      top: 0,
      right: '18%',
      width: 22,
      height: 38,
      backgroundColor: colors.brand,
      zIndex: 20,
      alignItems: 'center' as const,
      justifyContent: 'flex-start' as const,
      paddingTop: 8,
      ...Platform.select({
        web: {
          clipPath: 'polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%)',
          boxShadow: '1px 2px 6px rgba(0,0,0,0.15)',
        },
      }),
    },

    // -- Page curl effect --
    pageCurlCorner: {
      position: 'absolute' as const,
      bottom: 0,
      right: 0,
      width: 28,
      height: 28,
      zIndex: 10,
      ...Platform.select({
        web: {
          backgroundImage: `linear-gradient(135deg, 
        transparent 50%, 
        rgba(220,210,190,0.4) 50%, 
        rgba(245,240,232,0.7) 100%
      )`,
          boxShadow: '-1px -1px 3px rgba(0,0,0,0.04)',
        },
      }),
    },

    // -- Typography --
    chapterHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: showSideSlider ? 12 : 16,
    },
    chapterLabel: {
      fontSize: 10,
      fontWeight: '500',
      color: inkSubtle,
      textTransform: 'uppercase',
      letterSpacing: 2.2,
      ...Platform.select({ web: { fontFamily: editorialCaps } as any }),
    },
    chapterDivider: {
      height: 1,
      flex: 1,
      maxWidth: 80,
      backgroundColor: warmGold,
      opacity: 0.6,
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
      ...Platform.select({
        web: {
          boxShadow: DESIGN_TOKENS.shadows.light,
        } as any,
      }),
    },
    heroMetaBadgeText: {
      color: inkMuted,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
      ...Platform.select({ web: { fontFamily: sansSerif } as any }),
    },
    title: {
      fontSize: isSmallPhone ? 28 : isMobile ? 32 : 36,
      fontWeight: '700',
      color: inkStrong,
      letterSpacing: -0.8,
      lineHeight: isSmallPhone ? 34 : isMobile ? 40 : 44,
      textAlign: 'left',
      ...Platform.select({
        web: showSideSlider
          ? ({
              fontFamily: editorialSerif,
              fontSize: desktopBookTitleSize,
              lineHeight: desktopBookTitleLineHeight,
              letterSpacing: '-0.03em',
            } as any)
          : ({ fontFamily: sansSerif } as any),
      }),
    },
    titleAccent: {
      fontSize: isSmallPhone ? 28 : isMobile ? 32 : 36,
      fontWeight: '800',
      color: colors.brand,
      letterSpacing: -0.8,
      lineHeight: isSmallPhone ? 34 : isMobile ? 40 : 44,
      textAlign: 'left',
      ...Platform.select({
        web: showSideSlider
          ? ({
              fontFamily: editorialSerif,
              fontSize: desktopBookTitleSize,
              lineHeight: desktopBookTitleLineHeight,
              letterSpacing: '-0.02em',
            } as any)
          : ({ fontFamily: sansSerif } as any),
      }),
    },
    subtitle: {
      fontSize: isMobile ? 16 : 17,
      fontWeight: '400',
      color: inkMuted,
      lineHeight: isMobile ? 24 : 27,
      textAlign: 'left',
      maxWidth: 520,
      alignSelf: 'flex-start',
      letterSpacing: 0.1,
      marginTop: isMobile ? 12 : 16,
      ...Platform.select({
        web: showSideSlider
          ? ({
              fontFamily: editorialSerif,
              fontSize: desktopBookSubtitleSize,
              lineHeight: desktopBookSubtitleLineHeight,
              maxWidth: '88%',
              letterSpacing: '0.01em',
              marginTop: '3.2%',
            } as any)
          : ({ fontFamily: sansSerif } as any),
      }),
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
      width: '100%',
      marginTop: isMobile ? 8 : 12,
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
        },
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
        },
      }),
    },
    bookHighlightTextWrap: { flex: 1, gap: 2 },
    highlightTitle: {
      color: '#2A1F14',
      fontSize: 13,
      lineHeight: 17,
      fontWeight: '600',
      letterSpacing: -0.1,
    },
    highlightSubtitle: { color: '#8B7D6B', fontSize: 12, lineHeight: 16 },
    bookHighlightTitle: {
      color: '#2A1F14',
      fontSize: isMobile ? 12 : 13,
      lineHeight: isMobile ? 16 : 18,
      fontWeight: '600',
      letterSpacing: -0.1,
      ...Platform.select({ web: { fontFamily: sansSerif } as any }),
    },
    bookHighlightSubtitle: {
      color: '#8B7D6B',
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

    // -- CTA Buttons --
    // In CSS grid: alignSelf:'end' pins it to the bottom of whichever row it occupies.
    // With chips: sits in row 3 (auto). Without chips: sits in row 3 but 1fr gap pushes it down.
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
              alignSelf: 'end',
            } as any)
          : {},
      }),
    },
    primaryButton: {
      paddingHorizontal: isMobile
        ? 28
        : showSideSlider
          ? isCompactBookLayout
            ? 24
            : 28
          : 28,
      paddingVertical: isMobile
        ? 14
        : showSideSlider
          ? isCompactBookLayout
            ? 10
            : 12
          : 13,
      minHeight: isMobile
        ? 50
        : showSideSlider
          ? isCompactBookLayout
            ? 40
            : 44
          : 46,
      borderRadius: DESIGN_TOKENS.radii.pill,
      width: stackHeroButtons ? '100%' : undefined,
      backgroundColor: colors.brand,
      ...Platform.select({
        web: {
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: `0 2px 12px ${colors.brand}30`,
        },
      }),
    },
    primaryButtonHover: {
      backgroundColor: colors.brandDark,
      ...Platform.select({
        web: {
          transform: 'translateY(-1px)',
          boxShadow: `0 6px 20px ${colors.brand}40`,
        },
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
        ? 26
        : showSideSlider
          ? isCompactBookLayout
            ? 24
            : 28
          : 28,
      paddingVertical: isMobile
        ? 13
        : showSideSlider
          ? isCompactBookLayout
            ? 12
            : 14
          : 14,
      minHeight: isMobile
        ? 50
        : showSideSlider
          ? isCompactBookLayout
            ? 44
            : 48
          : 50,
      borderRadius: DESIGN_TOKENS.radii.pill,
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colors.brand,
      width: stackHeroButtons ? '100%' : undefined,
      ...Platform.select({
        web: {
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: 'none',
        },
      }),
    },
    secondaryButtonHover: {
      backgroundColor: colors.brandAlpha30 || 'rgba(230,126,34,0.10)',
      borderColor: colors.brand,
      ...Platform.select({
        web: {
          transform: 'translateY(-1px)',
        },
      }),
    },
    secondaryButtonText: {
      fontSize: isCompactBookLayout ? 14 : 15,
      fontWeight: '600',
      color: colors.brand,
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
      ...Platform.select({
        web: {
          cursor: 'pointer',
          transition: 'background-color 0.15s ease, border-color 0.15s ease',
          boxShadow: '0 1px 0 rgba(120,96,62,0.08)',
        },
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
    },
    moodChip: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
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
        },
      }) as any),
    },
    moodChipHover: {
      backgroundColor: warmBgSoft,
      borderColor: colors.brand,
      ...Platform.select({
        web: {
          transform: 'translateY(-1px)',
          boxShadow: '0 4px 12px rgba(120,96,62,0.12)',
        },
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
    popularTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: '#8B7D6B',
      marginBottom: 18,
      textTransform: 'uppercase',
      letterSpacing: 1.6,
      ...Platform.select({ web: { fontFamily: sansSerif } as any }),
    },
    popularScrollContent: { flexDirection: 'row', gap: 16, paddingRight: 16 },

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
        },
      }),
    },
    featuredCardHover: {
      ...Platform.select({
        web: {
          transform: 'translateY(-4px) scale(1.005)',
          boxShadow: `0 16px 48px rgba(120,90,50,0.18), 0 4px 12px rgba(120,90,50,0.12)`,
          borderColor: 'transparent',
        },
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
        },
      }),
    },
    featuredCardTitle: {
      fontSize: isMobile ? 20 : 24,
      fontWeight: '700',
      color: '#FFFFFF',
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
        },
      }),
    },
    imageCardHover: {
      ...Platform.select({
        web: {
          transform: 'translateY(-4px) scale(1.02)',
          boxShadow: `0 12px 36px rgba(120,90,50,0.14), 0 4px 12px rgba(120,90,50,0.08)`,
          borderColor: 'transparent',
        },
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
      color: '#2A1F14',
      lineHeight: 20,
      letterSpacing: -0.2,
      ...Platform.select({ web: { fontFamily: editorialSerif } as any }),
    },
    imageCardSubtitle: {
      fontSize: 13,
      fontWeight: '400',
      color: '#8B7D6B',
      lineHeight: 18,
      ...Platform.select({ web: { fontFamily: sansSerif } as any }),
    },
  })
}
