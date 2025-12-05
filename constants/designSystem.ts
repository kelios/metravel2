import { MODERN_MATTE_PALETTE, MODERN_MATTE_SHADOWS, MODERN_MATTE_BOX_SHADOWS } from './modernMattePalette';

export const DESIGN_TOKENS = {
  colors: {
    transparent: MODERN_MATTE_PALETTE.transparent,
    // Фоны (матовые, теплые)
    background: MODERN_MATTE_PALETTE.background,
    backgroundSecondary: MODERN_MATTE_PALETTE.backgroundSecondary,
    surface: MODERN_MATTE_PALETTE.surface,
    surfaceMuted: MODERN_MATTE_PALETTE.surfaceMuted,
    surfaceElevated: MODERN_MATTE_PALETTE.surfaceElevated,
    card: MODERN_MATTE_PALETTE.surface,
    cardMuted: MODERN_MATTE_PALETTE.backgroundSecondary,
    dockBackground: MODERN_MATTE_PALETTE.surfaceElevated,
    dockBorder: MODERN_MATTE_PALETTE.border,
    
    // Текст (высококонтрастный, но мягкий)
    text: MODERN_MATTE_PALETTE.text,
    textMuted: MODERN_MATTE_PALETTE.textSecondary,
    textSubtle: MODERN_MATTE_PALETTE.textTertiary,
    textInverse: MODERN_MATTE_PALETTE.textInverse,
    
    // Акцентные цвета (мягкие, матовые)
    primary: MODERN_MATTE_PALETTE.primary,
    primaryDark: MODERN_MATTE_PALETTE.primaryDark,
    primaryLight: MODERN_MATTE_PALETTE.primaryLight,
    primarySoft: MODERN_MATTE_PALETTE.primarySoft,
    
    accent: MODERN_MATTE_PALETTE.accent,
    accentDark: MODERN_MATTE_PALETTE.accentDark,
    accentLight: MODERN_MATTE_PALETTE.accentLight,
    accentSoft: MODERN_MATTE_PALETTE.accentSoft,
    
    // Функциональные цвета (мягкие, не агрессивные)
    success: MODERN_MATTE_PALETTE.success,
    successDark: MODERN_MATTE_PALETTE.successDark,
    successLight: MODERN_MATTE_PALETTE.successLight,
    successSoft: MODERN_MATTE_PALETTE.successSoft,
    
    warning: MODERN_MATTE_PALETTE.warning,
    warningDark: MODERN_MATTE_PALETTE.warningDark,
    warningLight: MODERN_MATTE_PALETTE.warningLight,
    warningSoft: MODERN_MATTE_PALETTE.warningSoft,
    
    danger: MODERN_MATTE_PALETTE.danger,
    dangerDark: MODERN_MATTE_PALETTE.dangerDark,
    dangerLight: MODERN_MATTE_PALETTE.dangerLight,
    dangerSoft: MODERN_MATTE_PALETTE.dangerSoft,
    
    info: MODERN_MATTE_PALETTE.info,
    infoDark: MODERN_MATTE_PALETTE.infoDark,
    infoLight: MODERN_MATTE_PALETTE.infoLight,
    infoSoft: MODERN_MATTE_PALETTE.infoSoft,
    
    // Границы (мягкие, матовые)
    border: MODERN_MATTE_PALETTE.border,
    borderLight: MODERN_MATTE_PALETTE.borderLight,
    borderStrong: MODERN_MATTE_PALETTE.borderStrong,
    borderAccent: MODERN_MATTE_PALETTE.borderAccent,
    
    // Focus и интерактивность
    focus: MODERN_MATTE_PALETTE.focus,
    focusStrong: MODERN_MATTE_PALETTE.focusStrong,
    
    // Состояния
    mutedBackground: MODERN_MATTE_PALETTE.mutedBackground,
    disabled: MODERN_MATTE_PALETTE.disabled,
    disabledText: MODERN_MATTE_PALETTE.disabledText,
    
    // Overlay
    overlay: MODERN_MATTE_PALETTE.overlay,
    overlayLight: MODERN_MATTE_PALETTE.overlayLight,
  },
  radii: {
    xl: 28,
    lg: 20,
    md: 16,
    sm: 12,
    pill: 999,
  },
  shadows: {
    light: MODERN_MATTE_BOX_SHADOWS.light,
    medium: MODERN_MATTE_BOX_SHADOWS.medium,
    heavy: MODERN_MATTE_BOX_SHADOWS.heavy,
    hover: MODERN_MATTE_BOX_SHADOWS.hover,
    card: MODERN_MATTE_BOX_SHADOWS.card,
    modal: MODERN_MATTE_BOX_SHADOWS.modal,
    // Для обратной совместимости
    soft: MODERN_MATTE_BOX_SHADOWS.light,
  },
  shadowsNative: MODERN_MATTE_SHADOWS,
  spacing: {
    xxs: 2,
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    xxl: 32,
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
      regular: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
  },
  breakpoints: {
    mobile: 768,
    tablet: 1024,
    desktop: 1280,
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
  touchTarget: {
    minHeight: 44,
    minWidth: 44,
  },
};


