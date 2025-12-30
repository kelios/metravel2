import { Platform } from 'react-native';
import { MODERN_MATTE_PALETTE, MODERN_MATTE_SHADOWS, MODERN_MATTE_BOX_SHADOWS } from './modernMattePalette';

const colorVar = (name: string, fallback: string) =>
  Platform.OS === 'web' ? `var(--color-${name}, ${fallback})` : fallback;

const shadowVar = (name: string, fallback: string) =>
  Platform.OS === 'web' ? `var(--shadow-${name}, ${fallback})` : fallback;

export const DESIGN_TOKENS = {
  colors: {
    transparent: colorVar('transparent', MODERN_MATTE_PALETTE.transparent),
    // Фоны (матовые, теплые)
    background: colorVar('background', MODERN_MATTE_PALETTE.background),
    backgroundSecondary: colorVar('backgroundSecondary', MODERN_MATTE_PALETTE.backgroundSecondary),
    backgroundTertiary: colorVar('backgroundTertiary', MODERN_MATTE_PALETTE.backgroundTertiary),
    surface: colorVar('surface', MODERN_MATTE_PALETTE.surface),
    surfaceMuted: colorVar('surfaceMuted', MODERN_MATTE_PALETTE.surfaceMuted),
    surfaceElevated: colorVar('surfaceElevated', MODERN_MATTE_PALETTE.surfaceElevated),
    card: colorVar('card', MODERN_MATTE_PALETTE.surface),
    cardMuted: colorVar('cardMuted', MODERN_MATTE_PALETTE.backgroundSecondary),
    dockBackground: colorVar('dockBackground', MODERN_MATTE_PALETTE.surfaceElevated),
    dockBorder: colorVar('dockBorder', MODERN_MATTE_PALETTE.border),
    
    // Текст (высококонтрастный, но мягкий)
    text: colorVar('text', MODERN_MATTE_PALETTE.text),
    textMuted: colorVar('textMuted', MODERN_MATTE_PALETTE.textSecondary),
    textSubtle: colorVar('textSubtle', MODERN_MATTE_PALETTE.textTertiary),
    textInverse: colorVar('textInverse', MODERN_MATTE_PALETTE.textInverse),
    textOnPrimary: colorVar('textOnPrimary', MODERN_MATTE_PALETTE.textOnPrimary),
    textOnDark: colorVar('textOnDark', MODERN_MATTE_PALETTE.textOnDark),
    
    // Акцентные цвета (мягкие, матовые)
    primary: colorVar('primary', MODERN_MATTE_PALETTE.primary),
    primaryDark: colorVar('primaryDark', MODERN_MATTE_PALETTE.primaryDark),
    primaryLight: colorVar('primaryLight', MODERN_MATTE_PALETTE.primaryLight),
    primarySoft: colorVar('primarySoft', MODERN_MATTE_PALETTE.primarySoft),
    
    accent: colorVar('accent', MODERN_MATTE_PALETTE.accent),
    accentDark: colorVar('accentDark', MODERN_MATTE_PALETTE.accentDark),
    accentLight: colorVar('accentLight', MODERN_MATTE_PALETTE.accentLight),
    accentSoft: colorVar('accentSoft', MODERN_MATTE_PALETTE.accentSoft),
    
    // Функциональные цвета (мягкие, не агрессивные)
    success: colorVar('success', MODERN_MATTE_PALETTE.success),
    successDark: colorVar('successDark', MODERN_MATTE_PALETTE.successDark),
    successLight: colorVar('successLight', MODERN_MATTE_PALETTE.successLight),
    successSoft: colorVar('successSoft', MODERN_MATTE_PALETTE.successSoft),
    
    warning: colorVar('warning', MODERN_MATTE_PALETTE.warning),
    warningDark: colorVar('warningDark', MODERN_MATTE_PALETTE.warningDark),
    warningLight: colorVar('warningLight', MODERN_MATTE_PALETTE.warningLight),
    warningSoft: colorVar('warningSoft', MODERN_MATTE_PALETTE.warningSoft),
    
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
    mutedBackground: colorVar('mutedBackground', MODERN_MATTE_PALETTE.mutedBackground),
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
