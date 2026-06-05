// components/home/homeHeroStyles/shellStyles.ts
import { Platform } from 'react-native'

import type { HeroStyleContext } from './context'

export const createHeroShellStyles = (ctx: HeroStyleContext) => {
  const {
    colors,
    isMobile,
    isLandscape,
    showSideSlider,
    bookHeight,
    isTabletLayout,
    desktopBookViewportReserve,
    isUltraWideBook,
    isLargeDesktopBook,
    warmBg,
    leftPageWidth,
    leftPagePaddingLeft,
    leftPagePaddingRight,
    leftPagePaddingTop,
    leftPagePaddingBottom,
  } = ctx

  return {
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
        } as any,
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
              maxHeight: `calc(100vh - ${desktopBookViewportReserve}px)`,
              maxWidth: isUltraWideBook
                ? 1520
                : isLargeDesktopBook
                  ? 1360
                  : 1200,
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
      flexDirection: showSideSlider || isTabletLayout ? 'row' : 'column',
      alignItems: 'stretch',
      justifyContent: 'flex-start',
      gap: isTabletLayout ? 32 : 0,
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
              maxWidth: '100%',
              boxSizing: 'border-box',
            } as any)
          : isTabletLayout
            ? ({
                alignItems: 'stretch',
                minHeight: 340,
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
      gap: showSideSlider ? 0 : isMobile ? 16 : isTabletLayout ? 16 : 20,
      width: isTabletLayout ? undefined : leftPageWidth,
      maxWidth: showSideSlider ? leftPageWidth : isMobile ? '100%' : isTabletLayout ? undefined : 720,
      flexShrink: isTabletLayout ? 1 : 0,
      flexGrow: isTabletLayout ? 1 : 0,
      flex: isTabletLayout ? 1 : undefined,
      paddingLeft: isMobile ? 20 : isTabletLayout ? 0 : 48,
      paddingRight: isMobile ? 20 : isTabletLayout ? 0 : 48,
      paddingTop: isMobile ? 28 : isTabletLayout ? 0 : 36,
      paddingBottom: isMobile ? 28 : isTabletLayout ? 0 : 36,
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
              display: 'grid',
              gridTemplateRows: 'auto 1fr auto',
              alignSelf: 'stretch',
              height: '100%',
              maxHeight: '100%',
              minWidth: 0,
            } as any)
          : isTabletLayout
            ? ({
                backgroundColor: 'transparent',
                justifyContent: 'center',
                minWidth: 0,
              } as any)
            : ({
                backgroundColor: isMobile ? colors.surfaceMuted : 'transparent',
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
  } as const
}
