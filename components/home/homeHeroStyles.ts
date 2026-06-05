// components/home/homeHeroStyles.ts
// Premium "My Travel Book" — digital scrapbook aesthetic
// Modern CSS 2026: clamp() fluid typography, CSS grid for page layout, minimal JS math

import { StyleSheet } from 'react-native'
import { DESIGN_TOKENS } from '@/constants/designSystem'

import type { HeroStyleContext, HeroStyleParams } from './homeHeroStyles/context'
import { createHeroShellStyles } from './homeHeroStyles/shellStyles'
import { createSliderSectionStyles } from './homeHeroStyles/sliderSectionStyles'
import { createSliderMediaStyles } from './homeHeroStyles/sliderMediaStyles'
import { createSliderNavStyles } from './homeHeroStyles/sliderNavStyles'
import { createTypographyStyles } from './homeHeroStyles/typographyStyles'
import { createBookWidgetStyles } from './homeHeroStyles/bookWidgetStyles'
import { createCtaStyles } from './homeHeroStyles/ctaStyles'

export type { HeroStyleParams } from './homeHeroStyles/context'

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
  isTabletLayout = false,
}: HeroStyleParams) => {
  const hasBookLayout = showSideSlider && bookHeight > 0
  const desktopBookViewportReserve = 180
  const isUltraWideBook = showSideSlider && viewportWidth >= 2560
  const isLargeDesktopBook = showSideSlider && viewportWidth >= 1920
  const isNarrowDesktopBook =
    showSideSlider && viewportWidth >= 1280 && viewportWidth < 1480

  // Modern CSS 2026: fluid values via clamp() — no JS scaling math
  // All vw-based values reference the viewport, matching how the book fills screen
  // Book occupies ~90vw capped at 1400px. Left page ≈ 54% of that ≈ 27vw.
  // Title: fluid 24px → 42px across 1280–2560px viewport range
  const desktopBookTitleSize = hasBookLayout
    ? `clamp(24px, ${isNarrowDesktopBook ? '1.9vw' : isUltraWideBook ? '2.8vw' : isLargeDesktopBook ? '2.4vw' : '2.1vw'}, ${isNarrowDesktopBook ? 32 : isUltraWideBook ? 74 : isLargeDesktopBook ? 58 : 38}px)`
    : '54px'
  const desktopBookTitleLineHeight = hasBookLayout
    ? `clamp(29px, ${isNarrowDesktopBook ? '2.35vw' : isUltraWideBook ? '3.4vw' : isLargeDesktopBook ? '3vw' : '2.65vw'}, ${isNarrowDesktopBook ? 36 : isUltraWideBook ? 82 : isLargeDesktopBook ? 64 : 44}px)`
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
        : isNarrowDesktopBook
          ? '7.5%'
          : '8%'
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
  const useDenseBookNotes = showSideSlider && viewportWidth < 2200

  const leftPagePaddingBottom = hasBookLayout
    ? isUltraWideBook
      ? '14%'
      : isLargeDesktopBook
        ? '15%'
        : isCompactBookLayout
          ? '17%'
          : '18%'
    : 110

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
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif'
  const editorialSerif = 'Baskerville, Georgia, "Times New Roman", serif'
  const editorialCaps = 'Baskerville, Georgia, "Times New Roman", serif'

  const ctx: HeroStyleContext = {
    colors,
    isMobile,
    isSmallPhone,
    isNarrowLayout,
    viewportWidth,
    showSideSlider,
    sliderHeight,
    isLandscape,
    bookHeight,
    stackHeroButtons,
    isTabletLayout,
    hasBookLayout,
    isUltraWideBook,
    isLargeDesktopBook,
    isNarrowDesktopBook,
    isCompactBookLayout,
    isVeryCompactBookLayout,
    useDenseBookNotes,
    desktopBookViewportReserve,
    desktopBookTitleSize,
    desktopBookTitleLineHeight,
    desktopBookSubtitleSize,
    desktopBookSubtitleLineHeight,
    leftPagePaddingLeft,
    leftPagePaddingRight,
    leftPagePaddingTop,
    leftPagePaddingBottom,
    leftPageWidth,
    rightPageWidth,
    serif,
    sansSerif,
    editorialSerif,
    editorialCaps,
    warmBg,
    warmBgSoft,
    cardSurface,
    warmBorder,
    warmShadow,
    warmGold,
    inkStrong,
    inkMuted,
    inkSubtle,
  }

  return StyleSheet.create({
    ...createHeroShellStyles(ctx),
    ...createSliderSectionStyles(ctx),
    ...createSliderMediaStyles(ctx),
    ...createSliderNavStyles(ctx),
    ...createTypographyStyles(ctx),
    ...createBookWidgetStyles(ctx),
    ...createCtaStyles(ctx),
  })
}
