// components/home/homeHeroStyles/context.ts
// Shared context passed to every style-group factory. Holds the original
// HeroStyleParams plus the derived locals computed once in createHomeHeroStyles.

import type { useThemedColors } from '@/hooks/useTheme'

type Colors = ReturnType<typeof useThemedColors>

export interface HeroStyleParams {
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
  /** Tablet layout mode (770-1279px) with side-by-side hero */
  isTabletLayout?: boolean
}

export interface HeroStyleContext {
  colors: Colors
  isMobile: boolean
  isSmallPhone: boolean
  viewportWidth: number
  showSideSlider: boolean
  sliderHeight: number
  isLandscape: boolean
  bookHeight: number
  stackHeroButtons: boolean
  isTabletLayout: boolean

  // derived booleans
  hasBookLayout: boolean
  isUltraWideBook: boolean
  isLargeDesktopBook: boolean
  isNarrowDesktopBook: boolean
  isCompactBookLayout: boolean
  useDenseBookNotes: boolean

  // derived fluid typography
  desktopBookTitleSize: string
  desktopBookTitleLineHeight: string
  desktopBookSubtitleSize: string
  desktopBookSubtitleLineHeight: string

  // derived paddings / widths
  leftPagePaddingLeft: string | number
  leftPagePaddingRight: string | number
  leftPagePaddingTop: string | number
  leftPagePaddingBottom: string | number
  pageNumberBottom: number
  /** Paper height between the vertical insets; 0 without the book layout. */
  bookUsableHeight: number
  leftPageNumberLeft: `${number}%` | number
  rightPageNumberRight: `${number}%` | number
  leftPageWidth: string
  rightPageWidth: string | number

  // fonts
  serif: string
  sansSerif: string
  editorialSerif: string
  editorialCaps: string

  // token-derived colors
  warmBg: string
  warmBgSoft: string
  cardSurface: string
  warmBorder: string
  warmShadow: string
  warmGold: string
  inkStrong: string
  inkMuted: string
  inkSubtle: string
}
