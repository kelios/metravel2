import { Platform } from 'react-native'
import {
  MODERN_MATTE_BOX_SHADOWS,
  MODERN_MATTE_BOX_SHADOWS_DARK,
  MODERN_MATTE_GRADIENTS,
  MODERN_MATTE_GRADIENTS_DARK,
  MODERN_MATTE_PALETTE,
  MODERN_MATTE_PALETTE_DARK,
  MODERN_MATTE_SHADOWS,
  MODERN_MATTE_SHADOWS_DARK,
} from './modernMattePalette'

export const DESIGN_COLORS = {
  // Used for persistence / payloads where CSS vars must not leak.
  travelPoint: '#ff922b',
  mapPin: '#ff8a00',

  // Web shell / critical CSS fallbacks (must be plain values).
  themeColorLight: '#ffffff',
  themeColorDark: MODERN_MATTE_PALETTE_DARK.background,
  criticalTextLight: MODERN_MATTE_PALETTE.text,
  criticalTextDark: MODERN_MATTE_PALETTE_DARK.text,
  criticalBgLight: MODERN_MATTE_PALETTE.background,
  criticalBgDark: MODERN_MATTE_PALETTE_DARK.background,
  criticalBgSecondaryLight: MODERN_MATTE_PALETTE.backgroundSecondary,
  criticalBgSecondaryDark: MODERN_MATTE_PALETTE_DARK.backgroundSecondary,
  criticalBgTertiaryLight: MODERN_MATTE_PALETTE.backgroundTertiary,
  criticalBgTertiaryDark: MODERN_MATTE_PALETTE_DARK.backgroundTertiary,
  criticalSurfaceLight: MODERN_MATTE_PALETTE.surface,
  criticalSurfaceDark: MODERN_MATTE_PALETTE_DARK.surface,
  criticalFocusLight: MODERN_MATTE_PALETTE.focusStrong,
  criticalFocusDark: MODERN_MATTE_PALETTE_DARK.focusStrong,

  // User-defined palette values (stored as strings).
  userPointDefault: 'rgb(33, 150, 243)',
  userPointPalette: [
    'rgb(255, 107, 107)',
    'rgb(240, 101, 149)',
    'rgb(132, 94, 247)',
    'rgb(51, 154, 240)',
    'rgb(34, 184, 207)',
    'rgb(81, 207, 102)',
    'rgb(252, 196, 25)',
  ],
} as const

const colorVar = (name: string, fallback: string) =>
  Platform.OS === 'web' ? `var(--color-${name}, ${fallback})` : fallback

const extractHexColorFallback = (value: string): string | null => {
  // Extract `#RRGGBB` / `#RRGGBBAA` from a plain hex or a `var(--..., <fallback>)`.
  const trimmed = String(value ?? '').trim()

  const direct = trimmed.match(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/)
  if (direct) return direct[0]

  const fromVar = trimmed.match(
    /var\(\s*--[^,]+,\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8})\s*\)/,
  )
  if (fromVar) return fromVar[1]

  return null
}

const applyHexAlpha = (hex: string, alphaHex: string): string => {
  const normalized = hex.trim()
  const alpha = alphaHex.replace(/^#/, '').slice(0, 2)
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return `${normalized}${alpha}`
  if (/^#[0-9a-fA-F]{8}$/.test(normalized))
    return `${normalized.slice(0, 7)}${alpha}`
  return normalized
}

const colorVarAlphaHex = (
  name: string,
  fallbackHex: string,
  alphaHex: string,
) =>
  Platform.OS === 'web'
    ? `var(--color-${name}-${alphaHex}, ${applyHexAlpha(
        extractHexColorFallback(fallbackHex) ?? fallbackHex,
        alphaHex,
      )})`
    : applyHexAlpha(
        extractHexColorFallback(fallbackHex) ?? fallbackHex,
        alphaHex,
      )

const shadowVar = (name: string, fallback: string) =>
  Platform.OS === 'web' ? `var(--shadow-${name}, ${fallback})` : fallback

const themedColor = (
  name: string,
  light: string,
  dark: string,
  isDark: boolean,
) =>
  Platform.OS === 'web'
    ? `var(--color-${name}, ${light})`
    : isDark
      ? dark
      : light

const themedColorAlphaHex = (
  name: string,
  lightHex: string,
  darkHex: string,
  alphaHex: string,
  isDark: boolean,
) =>
  Platform.OS === 'web'
    ? `var(--color-${name}-${alphaHex}, ${applyHexAlpha(
        extractHexColorFallback(isDark ? darkHex : lightHex) ??
          (isDark ? darkHex : lightHex),
        alphaHex,
      )})`
    : applyHexAlpha(
        extractHexColorFallback(isDark ? darkHex : lightHex) ??
          (isDark ? darkHex : lightHex),
        alphaHex,
      )

const themedShadow = (
  name: string,
  light: string,
  dark: string,
  isDark: boolean,
) =>
  Platform.OS === 'web'
    ? `var(--shadow-${name}, ${light})`
    : isDark
      ? dark
      : light

export const DESIGN_TOKENS = {
  colors: {
    transparent: colorVar('transparent', MODERN_MATTE_PALETTE.transparent),
    travelPoint: colorVar('travelPoint', DESIGN_COLORS.travelPoint),
    mapPin: colorVar('mapPin', DESIGN_COLORS.mapPin),
    // Фоны (матовые, теплые)
    background: colorVar('background', MODERN_MATTE_PALETTE.background),
    backgroundSecondary: colorVar(
      'backgroundSecondary',
      MODERN_MATTE_PALETTE.backgroundSecondary,
    ),
    backgroundTertiary: colorVar(
      'backgroundTertiary',
      MODERN_MATTE_PALETTE.backgroundTertiary,
    ),
    surface: colorVar('surface', MODERN_MATTE_PALETTE.surface),
    surfaceAlpha40: colorVarAlphaHex(
      'surface',
      MODERN_MATTE_PALETTE.surface,
      '40',
    ),
    surfaceMuted: colorVar('surfaceMuted', MODERN_MATTE_PALETTE.surfaceMuted),
    surfaceElevated: colorVar(
      'surfaceElevated',
      MODERN_MATTE_PALETTE.surfaceElevated,
    ),
    card: colorVar('card', MODERN_MATTE_PALETTE.surface),
    cardMuted: colorVar('cardMuted', MODERN_MATTE_PALETTE.backgroundSecondary),
    dockBackground: colorVar(
      'dockBackground',
      MODERN_MATTE_PALETTE.surfaceElevated,
    ),
    dockBorder: colorVar('dockBorder', MODERN_MATTE_PALETTE.border),

    // Текст (высококонтрастный, но мягкий)
    text: colorVar('text', MODERN_MATTE_PALETTE.text),
    textMuted: colorVar('textMuted', MODERN_MATTE_PALETTE.textSecondary),
    textSubtle: colorVar('textSubtle', MODERN_MATTE_PALETTE.textTertiary),
    textInverse: colorVar('textInverse', MODERN_MATTE_PALETTE.textInverse),
    textOnPrimary: colorVar(
      'textOnPrimary',
      MODERN_MATTE_PALETTE.textOnPrimary,
    ),
    textOnDark: colorVar('textOnDark', MODERN_MATTE_PALETTE.textOnDark),

    // Акцентные цвета (мягкие, матовые)
    primary: colorVar('primary', MODERN_MATTE_PALETTE.primary),
    primaryDark: colorVar('primaryDark', MODERN_MATTE_PALETTE.primaryDark),
    primaryText: colorVar('primaryText', MODERN_MATTE_PALETTE.primaryText),
    primaryLight: colorVar('primaryLight', MODERN_MATTE_PALETTE.primaryLight),
    primarySoft: colorVar('primarySoft', MODERN_MATTE_PALETTE.primarySoft),
    primaryAlpha30: colorVarAlphaHex(
      'primary',
      MODERN_MATTE_PALETTE.primary,
      '30',
    ),
    primaryAlpha40: colorVarAlphaHex(
      'primary',
      MODERN_MATTE_PALETTE.primary,
      '40',
    ),
    primaryAlpha50: colorVarAlphaHex(
      'primary',
      MODERN_MATTE_PALETTE.primary,
      '50',
    ),

    accent: colorVar('accent', MODERN_MATTE_PALETTE.accent),
    accentDark: colorVar('accentDark', MODERN_MATTE_PALETTE.accentDark),
    accentLight: colorVar('accentLight', MODERN_MATTE_PALETTE.accentLight),
    accentSoft: colorVar('accentSoft', MODERN_MATTE_PALETTE.accentSoft),

    // Брендовые оранжевые цвета (птичка логотипа)
    brand: colorVar('brand', MODERN_MATTE_PALETTE.brand),
    brandDark: colorVar('brandDark', MODERN_MATTE_PALETTE.brandDark),
    brandText: colorVar('brandText', MODERN_MATTE_PALETTE.brandText),
    brandLight: colorVar('brandLight', MODERN_MATTE_PALETTE.brandLight),
    brandSoft: colorVar('brandSoft', MODERN_MATTE_PALETTE.brandSoft),
    brandAlpha30: colorVarAlphaHex('brand', MODERN_MATTE_PALETTE.brand, '30'),
    brandAlpha40: colorVarAlphaHex('brand', MODERN_MATTE_PALETTE.brand, '40'),

    // Функциональные цвета (мягкие, не агрессивные)
    success: colorVar('success', MODERN_MATTE_PALETTE.success),
    successDark: colorVar('successDark', MODERN_MATTE_PALETTE.successDark),
    successLight: colorVar('successLight', MODERN_MATTE_PALETTE.successLight),
    successSoft: colorVar('successSoft', MODERN_MATTE_PALETTE.successSoft),

    warning: colorVar('warning', MODERN_MATTE_PALETTE.warning),
    warningDark: colorVar('warningDark', MODERN_MATTE_PALETTE.warningDark),
    warningLight: colorVar('warningLight', MODERN_MATTE_PALETTE.warningLight),
    warningSoft: colorVar('warningSoft', MODERN_MATTE_PALETTE.warningSoft),
    warningAlpha40: colorVarAlphaHex(
      'warning',
      MODERN_MATTE_PALETTE.warning,
      '40',
    ),

    danger: colorVar('danger', MODERN_MATTE_PALETTE.danger),
    dangerDark: colorVar('dangerDark', MODERN_MATTE_PALETTE.dangerDark),
    dangerLight: colorVar('dangerLight', MODERN_MATTE_PALETTE.dangerLight),
    dangerSoft: colorVar('dangerSoft', MODERN_MATTE_PALETTE.dangerSoft),
    error: colorVar('error', MODERN_MATTE_PALETTE.danger),
    errorDark: colorVar('errorDark', MODERN_MATTE_PALETTE.dangerDark),
    errorLight: colorVar('errorLight', MODERN_MATTE_PALETTE.dangerLight),
    errorSoft: colorVar('errorSoft', MODERN_MATTE_PALETTE.dangerSoft),

    info: colorVar('info', MODERN_MATTE_PALETTE.info),
    infoDark: colorVar('infoDark', MODERN_MATTE_PALETTE.infoDark),
    infoLight: colorVar('infoLight', MODERN_MATTE_PALETTE.infoLight),
    infoSoft: colorVar('infoSoft', MODERN_MATTE_PALETTE.infoSoft),

    // Границы (мягкие, матовые)
    border: colorVar('border', MODERN_MATTE_PALETTE.border),
    borderLight: colorVar('borderLight', MODERN_MATTE_PALETTE.borderLight),
    borderStrong: colorVar('borderStrong', MODERN_MATTE_PALETTE.borderStrong),
    borderAccent: colorVar('borderAccent', MODERN_MATTE_PALETTE.borderAccent),

    // Focus и интерактивность
    focus: colorVar('focus', MODERN_MATTE_PALETTE.focus),
    focusStrong: colorVar('focusStrong', MODERN_MATTE_PALETTE.focusStrong),

    // Состояния
    mutedBackground: colorVar(
      'mutedBackground',
      MODERN_MATTE_PALETTE.mutedBackground,
    ),
    disabled: colorVar('disabled', MODERN_MATTE_PALETTE.disabled),
    disabledText: colorVar('disabledText', MODERN_MATTE_PALETTE.disabledText),

    // Overlay
    overlay: colorVar('overlay', MODERN_MATTE_PALETTE.overlay),
    overlayLight: colorVar('overlayLight', MODERN_MATTE_PALETTE.overlayLight),
  },
  radii: {
    xl: 28,
    lg: 20,
    md: 16,
    sm: 12,
    pill: 999,
    full: 9999,
  },
  shadows: {
    light: shadowVar('light', MODERN_MATTE_BOX_SHADOWS.light),
    medium: shadowVar('medium', MODERN_MATTE_BOX_SHADOWS.medium),
    heavy: shadowVar('heavy', MODERN_MATTE_BOX_SHADOWS.heavy),
    hover: shadowVar('hover', MODERN_MATTE_BOX_SHADOWS.hover),
    card: shadowVar('card', MODERN_MATTE_BOX_SHADOWS.card),
    modal: shadowVar('modal', MODERN_MATTE_BOX_SHADOWS.modal),
    // Для обратной совместимости
    soft: shadowVar('soft', MODERN_MATTE_BOX_SHADOWS.light),
  },
  shadowsNative: MODERN_MATTE_SHADOWS,
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    xxxl: 64,
  },
  typography: {
    fontFamily: "'Inter', 'System'",
    sizes: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 20,
      xl: 24,
    },
    weights: {
      regular: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    // Modern type scale — pair size+lineHeight+letterSpacing+weight.
    // Mobile-first: values already optimised for phone screens. Use `display`/`h1` sparingly.
    scale: {
      display: { fontSize: 32, lineHeight: 38, letterSpacing: -0.6, fontWeight: '800' as const },
      h1: { fontSize: 24, lineHeight: 30, letterSpacing: -0.4, fontWeight: '800' as const },
      h2: { fontSize: 20, lineHeight: 26, letterSpacing: -0.3, fontWeight: '700' as const },
      h3: { fontSize: 17, lineHeight: 22, letterSpacing: -0.2, fontWeight: '700' as const },
      body: { fontSize: 15, lineHeight: 22, letterSpacing: 0, fontWeight: '500' as const },
      bodyStrong: { fontSize: 15, lineHeight: 22, letterSpacing: 0, fontWeight: '700' as const },
      bodySmall: { fontSize: 13, lineHeight: 18, letterSpacing: 0.05, fontWeight: '500' as const },
      caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0.1, fontWeight: '500' as const },
      label: { fontSize: 11, lineHeight: 14, letterSpacing: 0.8, fontWeight: '700' as const },
      micro: { fontSize: 10, lineHeight: 13, letterSpacing: 0.2, fontWeight: '600' as const },
    },
  },
  breakpoints: {
    // Legacy (referenced in tests) — DO NOT rename.
    mobile: 768,
    tablet: 1024,
    desktop: 1280,
    // Modern shorthand — prefer these going forward.
    // Values aligned with METRICS.breakpoints in constants/layout.ts.
    xs: 360,   // small phone
    sm: 480,   // large phone
    md: 768,   // tablet portrait
    lg: 1024,  // tablet landscape / small desktop
    xl: 1280,  // desktop
    xxl: 1536, // large desktop
  },
  zIndex: {
    base: 0,
    dropdown: 100,
    sticky: 200,
    fixed: 300,
    overlay: 400,
    modal: 500,
    popover: 600,
    toast: 700,
  },
  animations: {
    duration: {
      fast: 150,
      normal: 250,
      slow: 350,
    },
    easing: {
      default: 'cubic-bezier(0.4, 0, 0.2, 1)',
      in: 'cubic-bezier(0.4, 0, 1, 1)',
      out: 'cubic-bezier(0, 0, 0.2, 1)',
      inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },
  // Reanimated spring configs — pass directly to withSpring(value, config).
  // `snappy` = default UI response (sheets, chips). `gentle` = subtle state transitions.
  // `bouncy` = playful, use sparingly (pull-to-refresh, success confirmations).
  springs: {
    gentle: { damping: 24, stiffness: 160, mass: 0.9 },
    snappy: { damping: 20, stiffness: 280, mass: 0.8 },
    bouncy: { damping: 12, stiffness: 200, mass: 0.9 },
    stiff: { damping: 26, stiffness: 420, mass: 0.7 },
  },
  // Semantic elevation. Level 0 = flat on background, 5 = modal/sheet on top.
  // Native fields (shadow*) for iOS, elevation for Android, web uses boxShadow via shadows.*.
  elevation: {
    0: { shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
    1: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
    2: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
    3: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
    4: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
    5: { shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 32, shadowOffset: { width: 0, height: 16 }, elevation: 20 },
  },
  touchTarget: {
    minHeight: 44,
    minWidth: 44,
  },
  /**
   * PERF-02: Дефолтный blurhash-placeholder для изображений без собственного blurhash.
   * Нейтральный серо-зелёный тон, подходящий для тревел-фотографий.
   */
  defaultBlurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4',

  /**
   * CARD-01: Единые высоты изображений для карточек маршрутов.
   * Использовать везде вместо hardcoded числовых значений.
   */
  cardImageHeights: {
    /** Маленькая карточка (горизонтальный список, популярные маршруты) */
    small: 130,
    /** Стандартная карточка (основной список маршрутов) */
    medium: 200,
    /** Карточка-фичер (выделенная, первый элемент) */
    large: 260,
    /** Полноразмерная карточка (hero, слайдер) */
    hero: 400,
  },
}

/**
 * Theme-aware color/shadow/gradient helper for components that still rely on
 * `useThemedColors()` shape (colors + shadows + boxShadows + gradients).
 *
 * Rule: modernMattePalette should only be imported by this file.
 */
export function getThemedColors(isDark: boolean) {
  const shadowsNative = isDark
    ? MODERN_MATTE_SHADOWS_DARK
    : MODERN_MATTE_SHADOWS
  const gradients = isDark
    ? MODERN_MATTE_GRADIENTS_DARK
    : MODERN_MATTE_GRADIENTS

  return {
    // Primary
    primary: themedColor(
      'primary',
      MODERN_MATTE_PALETTE.primary,
      MODERN_MATTE_PALETTE_DARK.primary,
      isDark,
    ),
    primaryAlpha30: themedColorAlphaHex(
      'primary',
      MODERN_MATTE_PALETTE.primary,
      MODERN_MATTE_PALETTE_DARK.primary,
      '30',
      isDark,
    ),
    primaryAlpha40: themedColorAlphaHex(
      'primary',
      MODERN_MATTE_PALETTE.primary,
      MODERN_MATTE_PALETTE_DARK.primary,
      '40',
      isDark,
    ),
    primaryAlpha50: themedColorAlphaHex(
      'primary',
      MODERN_MATTE_PALETTE.primary,
      MODERN_MATTE_PALETTE_DARK.primary,
      '50',
      isDark,
    ),
    primaryDark: themedColor(
      'primaryDark',
      MODERN_MATTE_PALETTE.primaryDark,
      MODERN_MATTE_PALETTE_DARK.primaryDark,
      isDark,
    ),
    primaryText: themedColor(
      'primaryText',
      MODERN_MATTE_PALETTE.primaryText,
      MODERN_MATTE_PALETTE_DARK.primaryText,
      isDark,
    ),
    primaryLight: themedColor(
      'primaryLight',
      MODERN_MATTE_PALETTE.primaryLight,
      MODERN_MATTE_PALETTE_DARK.primaryLight,
      isDark,
    ),
    primarySoft: themedColor(
      'primarySoft',
      MODERN_MATTE_PALETTE.primarySoft,
      MODERN_MATTE_PALETTE_DARK.primarySoft,
      isDark,
    ),

    accent: themedColor(
      'accent',
      MODERN_MATTE_PALETTE.accent,
      MODERN_MATTE_PALETTE_DARK.accent,
      isDark,
    ),
    accentDark: themedColor(
      'accentDark',
      MODERN_MATTE_PALETTE.accentDark,
      MODERN_MATTE_PALETTE_DARK.accentDark,
      isDark,
    ),
    accentLight: themedColor(
      'accentLight',
      MODERN_MATTE_PALETTE.accentLight,
      MODERN_MATTE_PALETTE_DARK.accentLight,
      isDark,
    ),
    accentSoft: themedColor(
      'accentSoft',
      MODERN_MATTE_PALETTE.accentSoft,
      MODERN_MATTE_PALETTE_DARK.accentSoft,
      isDark,
    ),

    // Брендовые оранжевые цвета (птичка логотипа)
    brand: themedColor(
      'brand',
      MODERN_MATTE_PALETTE.brand,
      MODERN_MATTE_PALETTE_DARK.brand,
      isDark,
    ),
    brandDark: themedColor(
      'brandDark',
      MODERN_MATTE_PALETTE.brandDark,
      MODERN_MATTE_PALETTE_DARK.brandDark,
      isDark,
    ),
    brandText: themedColor(
      'brandText',
      MODERN_MATTE_PALETTE.brandText,
      MODERN_MATTE_PALETTE_DARK.brandText,
      isDark,
    ),
    brandLight: themedColor(
      'brandLight',
      MODERN_MATTE_PALETTE.brandLight,
      MODERN_MATTE_PALETTE_DARK.brandLight,
      isDark,
    ),
    brandSoft: themedColor(
      'brandSoft',
      MODERN_MATTE_PALETTE.brandSoft,
      MODERN_MATTE_PALETTE_DARK.brandSoft,
      isDark,
    ),
    brandAlpha30: themedColorAlphaHex(
      'brand',
      MODERN_MATTE_PALETTE.brand,
      MODERN_MATTE_PALETTE_DARK.brand,
      '30',
      isDark,
    ),
    brandAlpha40: themedColorAlphaHex(
      'brand',
      MODERN_MATTE_PALETTE.brand,
      MODERN_MATTE_PALETTE_DARK.brand,
      '40',
      isDark,
    ),

    // Text
    text: themedColor(
      'text',
      MODERN_MATTE_PALETTE.text,
      MODERN_MATTE_PALETTE_DARK.text,
      isDark,
    ),
    textSecondary: themedColor(
      'textMuted',
      MODERN_MATTE_PALETTE.textSecondary,
      MODERN_MATTE_PALETTE_DARK.textSecondary,
      isDark,
    ),
    textTertiary: themedColor(
      'textSubtle',
      MODERN_MATTE_PALETTE.textTertiary,
      MODERN_MATTE_PALETTE_DARK.textTertiary,
      isDark,
    ),
    textMuted: themedColor(
      'textMuted',
      MODERN_MATTE_PALETTE.textMuted,
      MODERN_MATTE_PALETTE_DARK.textMuted,
      isDark,
    ),
    textSubtle: themedColor(
      'textSubtle',
      MODERN_MATTE_PALETTE.textTertiary,
      MODERN_MATTE_PALETTE_DARK.textTertiary,
      isDark,
    ),
    textInverse: themedColor(
      'textInverse',
      MODERN_MATTE_PALETTE.textInverse,
      MODERN_MATTE_PALETTE_DARK.textInverse,
      isDark,
    ),
    textOnPrimary: themedColor(
      'textOnPrimary',
      MODERN_MATTE_PALETTE.textOnPrimary,
      MODERN_MATTE_PALETTE_DARK.textOnPrimary,
      isDark,
    ),
    textOnDark: themedColor(
      'textOnDark',
      MODERN_MATTE_PALETTE.textOnDark,
      MODERN_MATTE_PALETTE_DARK.textOnDark,
      isDark,
    ),

    // Background
    background: themedColor(
      'background',
      MODERN_MATTE_PALETTE.background,
      MODERN_MATTE_PALETTE_DARK.background,
      isDark,
    ),
    backgroundSecondary: themedColor(
      'backgroundSecondary',
      MODERN_MATTE_PALETTE.backgroundSecondary,
      MODERN_MATTE_PALETTE_DARK.backgroundSecondary,
      isDark,
    ),
    backgroundTertiary: themedColor(
      'backgroundTertiary',
      MODERN_MATTE_PALETTE.backgroundTertiary,
      MODERN_MATTE_PALETTE_DARK.backgroundTertiary,
      isDark,
    ),
    surface: themedColor(
      'surface',
      MODERN_MATTE_PALETTE.surface,
      MODERN_MATTE_PALETTE_DARK.surface,
      isDark,
    ),
    surfaceAlpha40: themedColorAlphaHex(
      'surface',
      MODERN_MATTE_PALETTE.surface,
      MODERN_MATTE_PALETTE_DARK.surface,
      '40',
      isDark,
    ),
    surfaceElevated: themedColor(
      'surfaceElevated',
      MODERN_MATTE_PALETTE.surfaceElevated,
      MODERN_MATTE_PALETTE_DARK.surfaceElevated,
      isDark,
    ),
    surfaceMuted: themedColor(
      'surfaceMuted',
      MODERN_MATTE_PALETTE.surfaceMuted,
      MODERN_MATTE_PALETTE_DARK.surfaceMuted,
      isDark,
    ),
    surfaceLight: themedColor(
      'backgroundTertiary',
      MODERN_MATTE_PALETTE.backgroundTertiary,
      MODERN_MATTE_PALETTE_DARK.backgroundTertiary,
      isDark,
    ),

    // Borders
    border: themedColor(
      'border',
      MODERN_MATTE_PALETTE.border,
      MODERN_MATTE_PALETTE_DARK.border,
      isDark,
    ),
    borderLight: themedColor(
      'borderLight',
      MODERN_MATTE_PALETTE.borderLight,
      MODERN_MATTE_PALETTE_DARK.borderLight,
      isDark,
    ),
    borderStrong: themedColor(
      'borderStrong',
      MODERN_MATTE_PALETTE.borderStrong,
      MODERN_MATTE_PALETTE_DARK.borderStrong,
      isDark,
    ),
    borderAccent: themedColor(
      'borderAccent',
      MODERN_MATTE_PALETTE.borderAccent,
      MODERN_MATTE_PALETTE_DARK.borderAccent,
      isDark,
    ),
    mutedBackground: themedColor(
      'mutedBackground',
      MODERN_MATTE_PALETTE.mutedBackground ??
        MODERN_MATTE_PALETTE.backgroundSecondary,
      MODERN_MATTE_PALETTE_DARK.mutedBackground ??
        MODERN_MATTE_PALETTE_DARK.backgroundSecondary,
      isDark,
    ),

    // Status
    success: themedColor(
      'success',
      MODERN_MATTE_PALETTE.success,
      MODERN_MATTE_PALETTE_DARK.success,
      isDark,
    ),
    successDark: themedColor(
      'successDark',
      MODERN_MATTE_PALETTE.successDark,
      MODERN_MATTE_PALETTE_DARK.successDark,
      isDark,
    ),
    successLight: themedColor(
      'successLight',
      MODERN_MATTE_PALETTE.successLight,
      MODERN_MATTE_PALETTE_DARK.successLight,
      isDark,
    ),
    successSoft: themedColor(
      'successSoft',
      MODERN_MATTE_PALETTE.successSoft,
      MODERN_MATTE_PALETTE_DARK.successSoft,
      isDark,
    ),

    warning: themedColor(
      'warning',
      MODERN_MATTE_PALETTE.warning,
      MODERN_MATTE_PALETTE_DARK.warning,
      isDark,
    ),
    warningAlpha40: themedColorAlphaHex(
      'warning',
      MODERN_MATTE_PALETTE.warning,
      MODERN_MATTE_PALETTE_DARK.warning,
      '40',
      isDark,
    ),
    warningDark: themedColor(
      'warningDark',
      MODERN_MATTE_PALETTE.warningDark,
      MODERN_MATTE_PALETTE_DARK.warningDark,
      isDark,
    ),
    warningLight: themedColor(
      'warningLight',
      MODERN_MATTE_PALETTE.warningLight,
      MODERN_MATTE_PALETTE_DARK.warningLight,
      isDark,
    ),
    warningSoft: themedColor(
      'warningSoft',
      MODERN_MATTE_PALETTE.warningSoft,
      MODERN_MATTE_PALETTE_DARK.warningSoft,
      isDark,
    ),

    danger: themedColor(
      'danger',
      MODERN_MATTE_PALETTE.danger,
      MODERN_MATTE_PALETTE_DARK.danger,
      isDark,
    ),
    dangerDark: themedColor(
      'dangerDark',
      MODERN_MATTE_PALETTE.dangerDark,
      MODERN_MATTE_PALETTE_DARK.dangerDark,
      isDark,
    ),
    dangerLight: themedColor(
      'dangerLight',
      MODERN_MATTE_PALETTE.dangerLight,
      MODERN_MATTE_PALETTE_DARK.dangerLight,
      isDark,
    ),
    dangerSoft: themedColor(
      'dangerSoft',
      MODERN_MATTE_PALETTE.dangerSoft,
      MODERN_MATTE_PALETTE_DARK.dangerSoft,
      isDark,
    ),

    info: themedColor(
      'info',
      MODERN_MATTE_PALETTE.info,
      MODERN_MATTE_PALETTE_DARK.info,
      isDark,
    ),
    infoDark: themedColor(
      'infoDark',
      MODERN_MATTE_PALETTE.infoDark,
      MODERN_MATTE_PALETTE_DARK.infoDark,
      isDark,
    ),
    infoLight: themedColor(
      'infoLight',
      MODERN_MATTE_PALETTE.infoLight,
      MODERN_MATTE_PALETTE_DARK.infoLight,
      isDark,
    ),
    infoSoft: themedColor(
      'infoSoft',
      MODERN_MATTE_PALETTE.infoSoft,
      MODERN_MATTE_PALETTE_DARK.infoSoft,
      isDark,
    ),

    // Focus/state
    focus: themedColor(
      'focus',
      MODERN_MATTE_PALETTE.focus,
      MODERN_MATTE_PALETTE_DARK.focus,
      isDark,
    ),
    focusStrong: themedColor(
      'focusStrong',
      MODERN_MATTE_PALETTE.focusStrong,
      MODERN_MATTE_PALETTE_DARK.focusStrong,
      isDark,
    ),
    disabled: themedColor(
      'disabled',
      MODERN_MATTE_PALETTE.disabled,
      MODERN_MATTE_PALETTE_DARK.disabled,
      isDark,
    ),
    disabledText: themedColor(
      'disabledText',
      MODERN_MATTE_PALETTE.disabledText,
      MODERN_MATTE_PALETTE_DARK.disabledText,
      isDark,
    ),

    overlay: themedColor(
      'overlay',
      MODERN_MATTE_PALETTE.overlay,
      MODERN_MATTE_PALETTE_DARK.overlay,
      isDark,
    ),
    overlayLight: themedColor(
      'overlayLight',
      MODERN_MATTE_PALETTE.overlayLight,
      MODERN_MATTE_PALETTE_DARK.overlayLight,
      isDark,
    ),

    // Shadows
    shadows: shadowsNative,
    boxShadows: {
      light: themedShadow(
        'light',
        MODERN_MATTE_BOX_SHADOWS.light,
        MODERN_MATTE_BOX_SHADOWS_DARK.light,
        isDark,
      ),
      medium: themedShadow(
        'medium',
        MODERN_MATTE_BOX_SHADOWS.medium,
        MODERN_MATTE_BOX_SHADOWS_DARK.medium,
        isDark,
      ),
      heavy: themedShadow(
        'heavy',
        MODERN_MATTE_BOX_SHADOWS.heavy,
        MODERN_MATTE_BOX_SHADOWS_DARK.heavy,
        isDark,
      ),
      hover: themedShadow(
        'hover',
        MODERN_MATTE_BOX_SHADOWS.hover,
        MODERN_MATTE_BOX_SHADOWS_DARK.hover,
        isDark,
      ),
      card: themedShadow(
        'card',
        MODERN_MATTE_BOX_SHADOWS.card,
        MODERN_MATTE_BOX_SHADOWS_DARK.card,
        isDark,
      ),
      modal: themedShadow(
        'modal',
        MODERN_MATTE_BOX_SHADOWS.modal,
        MODERN_MATTE_BOX_SHADOWS_DARK.modal,
        isDark,
      ),
    },

    gradients,
  }
}
