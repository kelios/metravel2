// components/home/homeHeroStyles.ts
// Premium "My Travel Book" — digital scrapbook aesthetic
// Modern CSS 2026: clamp() fluid typography, CSS grid for page layout, minimal JS math

import { StyleSheet } from 'react-native'
import { DESIGN_TOKENS } from '@/constants/designSystem'
import { getHomeBookPageMetrics, HOME_BOOK_GEOMETRY } from './homeBookGeometry'

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
  const isUltraWideBook = showSideSlider && viewportWidth >= 2560
  const isLargeDesktopBook = showSideSlider && viewportWidth >= 1920
  const isNarrowDesktopBook =
    showSideSlider && viewportWidth >= 1280 && viewportWidth < 1480

  const pageMetrics = getHomeBookPageMetrics(viewportWidth, bookHeight)
  const desktopBookTitleSize = hasBookLayout ? `${pageMetrics.titleSize}px` : '54px'
  const desktopBookTitleLineHeight = hasBookLayout ? `${pageMetrics.titleLineHeight}px` : '64px'
  const desktopBookSubtitleSize = hasBookLayout ? `${pageMetrics.subtitleSize}px` : '17px'
  const desktopBookSubtitleLineHeight = hasBookLayout ? `${pageMetrics.subtitleLineHeight}px` : '28px'

  // CSS percentage padding resolves against the containing book row width.
  // Convert the paper's page-relative horizontal shares to book-relative ones.
  const leftPageShare = isNarrowDesktopBook ? 0.49 : 0.5
  const leftInsetShare = isUltraWideBook ? 0.17 : isLargeDesktopBook ? 0.18 : isNarrowDesktopBook ? 0.16 : 0.17
  const leftPagePaddingLeft = hasBookLayout ? `${leftPageShare * leftInsetShare * 100}%` : 100
  const leftPagePaddingRight = hasBookLayout ? `${leftPageShare * (isUltraWideBook ? 0.08 : 0.09) * 100}%` : 16
  const leftPagePaddingTop = hasBookLayout ? pageMetrics.topInset : 48
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
  const isCompactBookLayout = hasBookLayout && bookHeight <= HOME_BOOK_GEOMETRY.compactHeight
  const isVeryCompactBookLayout = hasBookLayout && bookHeight <= 640
  const useDenseBookNotes = showSideSlider && viewportWidth < 2200

  const leftPagePaddingBottom = hasBookLayout ? pageMetrics.bottomInset : 110

  const warmBg = colors.background
  const warmBgSoft = hasBookLayout
    ? DESIGN_TOKENS.colors.bookPageSurfaceMuted
    : colors.backgroundSecondary
  // Не-книжная ветка — themed-цвета (colors.*), а не статичные DESIGN_TOKENS:
  // на native статичные токены не переключаются в тёмной теме (web делает это
  // через CSS-переменные), из-за чего mobile web и устройство выглядели по-разному.
  const cardSurface = hasBookLayout
    ? DESIGN_TOKENS.colors.bookPageSurface
    : colors.surface
  const warmBorder = hasBookLayout
    ? DESIGN_TOKENS.colors.bookPageBorder
    : colors.borderAccent
  const warmShadow = 'rgba(58, 58, 58, 0.12)'
  const warmGold = hasBookLayout
    ? DESIGN_TOKENS.colors.bookPageGold
    : colors.warningAlpha40
  const inkStrong = hasBookLayout
    ? DESIGN_TOKENS.colors.bookPageText
    : colors.text
  const inkMuted = hasBookLayout
    ? DESIGN_TOKENS.colors.bookPageTextMuted
    : colors.textMuted
  const inkSubtle = hasBookLayout
    ? DESIGN_TOKENS.colors.bookPageTextSubtle
    : colors.textSubtle
  const sansSerif =
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif'
  // Паритет mobile web ↔ устройство: на native serif не применяется (системный sans),
  // поэтому на мобильном web тоже sans; serif — только desktop.
  const serif = isMobile ? sansSerif : 'Georgia, "Times New Roman", serif'
  const editorialSerif = isMobile ? sansSerif : 'Baskerville, Georgia, "Times New Roman", serif'
  const editorialCaps = editorialSerif

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
