/**
 * Theme Management Hook
 * Handles light/dark mode switching with persistence
 */

import { useEffect, useState, useCallback, createContext, useContext, createElement } from 'react';
import { Platform, useColorScheme } from 'react-native';
import {
  MODERN_MATTE_PALETTE,
  MODERN_MATTE_PALETTE_DARK,
  MODERN_MATTE_SHADOWS,
  MODERN_MATTE_SHADOWS_DARK,
  MODERN_MATTE_BOX_SHADOWS,
  MODERN_MATTE_BOX_SHADOWS_DARK,
  MODERN_MATTE_GRADIENTS,
  MODERN_MATTE_GRADIENTS_DARK,
} from '@/constants/modernMattePalette';

export type Theme = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Hook для управления темой (light/dark mode)
 */
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);

  if (!context) {
    if (__DEV__) {
      console.error('useTheme must be used within ThemeProvider');
    }
    return {
      theme: 'auto',
      isDark: false,
      setTheme: () => undefined,
      toggleTheme: () => undefined,
    };
  }

  return context;
}

/**
 * Provider компонент для темы
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [savedTheme, setSavedTheme] = useState<Theme>(() => {
    if (Platform.OS !== 'web') return 'auto';
    if (typeof window === 'undefined') return 'auto';
    try {
      const stored = localStorage.getItem('theme') as Theme | null;
      if (stored && ['light', 'dark', 'auto'].includes(stored)) {
        return stored;
      }
    } catch {
      // noop
    }
    return 'auto';
  });
  const [isDark, setIsDark] = useState(() => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return false;
      try {
        const stored = localStorage.getItem('theme') as Theme | null;
        const theme = stored && ['light', 'dark', 'auto'].includes(stored) ? stored : 'auto';
        if (theme === 'dark') return true;
        if (theme === 'light') return false;
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      } catch {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
    }

    return systemColorScheme === 'dark';
  });

  // Инициализация темы при монтировании
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Получить сохраненную тему из localStorage
      const stored = localStorage.getItem('theme') as Theme | null;
      if (stored && ['light', 'dark', 'auto'].includes(stored)) {
        setSavedTheme(stored);
      }
    }
  }, []);

  // Определить текущую тему
  useEffect(() => {
    let currentDark = false;

    if (savedTheme === 'auto') {
      // Используем системную тему
      if (Platform.OS === 'web') {
        currentDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      } else {
        currentDark = systemColorScheme === 'dark';
      }
    } else {
      currentDark = savedTheme === 'dark';
    }

    setIsDark(currentDark);
  }, [savedTheme, systemColorScheme]);

  // Слушать изменения системной темы
  useEffect(() => {
    if (Platform.OS !== 'web' || savedTheme !== 'auto') return;

    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      setIsDark(e.matches);
    };

    darkModeQuery.addEventListener('change', handleChange);
    return () => darkModeQuery.removeEventListener('change', handleChange);
  }, [savedTheme]);

  // Синхронизация темы для web (data-theme + color-scheme)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    root.style.colorScheme = isDark ? 'dark' : 'light';
  }, [isDark]);

  const setTheme = useCallback((theme: Theme) => {
    setSavedTheme(theme);

    if (Platform.OS === 'web') {
      localStorage.setItem('theme', theme);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(isDark ? 'light' : 'dark');
  }, [isDark, setTheme]);

  const value: ThemeContextType = {
    theme: savedTheme,
    isDark,
    setTheme,
    toggleTheme,
  };

  return createElement(ThemeContext.Provider, { value }, children);
}

/**
 * Хук для получения цветов в зависимости от темы
 * Использует современную матовую палитру (светлая/тёмная).
 */
type MattePalette = Record<keyof typeof MODERN_MATTE_PALETTE, string>;

export function getThemedColors(isDark: boolean) {
  const raw = isDark ? MODERN_MATTE_PALETTE_DARK : MODERN_MATTE_PALETTE;
  // Normalize to a simple string map to avoid literal-type conflicts.
  const basePalette: Record<string, string> = { ...MODERN_MATTE_PALETTE };
  const themePalette: Record<string, string> = { ...raw };
  const palette: MattePalette = { ...basePalette, ...themePalette } as MattePalette;
  const shadows = isDark ? MODERN_MATTE_SHADOWS_DARK : MODERN_MATTE_SHADOWS;
  const boxShadows = isDark ? MODERN_MATTE_BOX_SHADOWS_DARK : MODERN_MATTE_BOX_SHADOWS;
  const gradients = isDark ? MODERN_MATTE_GRADIENTS_DARK : MODERN_MATTE_GRADIENTS;

  return {
    // Primary
    primary: palette.primary,
    primaryDark: palette.primaryDark,
    primaryLight: palette.primaryLight,
    primarySoft: palette.primarySoft,
    accent: palette.accent,
    accentDark: palette.accentDark,
    accentLight: palette.accentLight,
    accentSoft: palette.accentSoft,

    // Text
    text: palette.text,
    textSecondary: palette.textSecondary,
    textTertiary: palette.textTertiary,
    textMuted: palette.textMuted,
    textInverse: palette.textInverse,
    textOnPrimary: palette.textOnPrimary,
    textOnDark: palette.textOnDark,

    // Background
    background: palette.background,
    backgroundSecondary: palette.backgroundSecondary,
    backgroundTertiary: palette.backgroundTertiary,
    surface: palette.surface,
    surfaceElevated: palette.surfaceElevated,
    surfaceMuted: palette.surfaceMuted,
    surfaceLight: palette.backgroundTertiary,
    border: palette.border,
    borderLight: palette.borderLight,
    borderStrong: palette.borderStrong,
    borderAccent: palette.borderAccent,
    mutedBackground: palette.mutedBackground ?? palette.backgroundSecondary,

    // Status
    success: palette.success,
    successDark: palette.successDark,
    successLight: palette.successLight,
    successSoft: palette.successSoft,

    warning: palette.warning,
    warningDark: palette.warningDark,
    warningLight: palette.warningLight,
    warningSoft: palette.warningSoft,

    danger: palette.danger,
    dangerDark: palette.dangerDark,
    dangerLight: palette.dangerLight,
    dangerSoft: palette.dangerSoft,

    info: palette.info,
    infoDark: palette.infoDark,
    infoLight: palette.infoLight,
    infoSoft: palette.infoSoft,

    // Focus и состояния
    focus: palette.focus,
    focusStrong: palette.focusStrong,
    disabled: palette.disabled,
    disabledText: palette.disabledText,

    // Overlay
    overlay: palette.overlay,
    overlayLight: palette.overlayLight,

    // Тени
    shadows,
    boxShadows,

    // Градиенты
    gradients,
  };
}

export function useThemedColors() {
  const { isDark } = useTheme();
  return getThemedColors(isDark);
}

// Экспорт типа возвращаемого значения useThemedColors для использования в компонентах
export type ThemedColors = ReturnType<typeof useThemedColors>;

/**
 * Хук для проверки предпочтений пользователя (reducedMotion)
 */
export function useAccessibilityPreferences() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [prefersHighContrast, setPrefersHighContrast] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Проверить prefers-reduced-motion
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(reducedMotionQuery.matches);

    const handleReducedMotion = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    reducedMotionQuery.addEventListener('change', handleReducedMotion);

    // Проверить prefers-contrast (если поддерживается)
    const contrastQuery = window.matchMedia('(prefers-contrast: more)');
    setPrefersHighContrast(contrastQuery.matches);

    const handleContrast = (e: MediaQueryListEvent) => {
      setPrefersHighContrast(e.matches);
    };

    if (contrastQuery.media !== '(prefers-contrast: more)') {
      // Браузер не поддерживает prefers-contrast
      contrastQuery.addEventListener('change', handleContrast);
    }

    return () => {
      reducedMotionQuery.removeEventListener('change', handleReducedMotion);
      if (contrastQuery.media !== '(prefers-contrast: more)') {
        contrastQuery.removeEventListener('change', handleContrast);
      }
    };
  }, []);

  return {
    prefersReducedMotion,
    prefersHighContrast,
  };
}

/**
 * Хук для анимационного timing в зависимости от предпочтений
 */
export function useAnimationTiming() {
  const { prefersReducedMotion } = useAccessibilityPreferences();

  return {
    fast: prefersReducedMotion ? 0 : 150,
    normal: prefersReducedMotion ? 0 : 300,
    slow: prefersReducedMotion ? 0 : 500,
  };
}
