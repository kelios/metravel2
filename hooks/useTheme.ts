/**
 * Theme Management Hook
 * Handles light/dark mode switching with persistence
 */

import { useEffect, useMemo, useState, useCallback, createContext, useContext, createElement, type Context } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { getThemedColors } from '@/constants/designSystem';

// Re-export helper for callers that historically imported it from this module.
export { getThemedColors };

export type Theme = 'light' | 'dark' | 'auto';

export interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const THEME_CONTEXT_GLOBAL_KEY = '__metravelThemeContext_v1';
const THEME_PROVIDER_WARNED_GLOBAL_KEY = '__metravelThemeProviderWarned_v1';

function getSingletonThemeContext(): Context<ThemeContextType | undefined> {
  const g: any = typeof globalThis !== 'undefined' ? globalThis : undefined;
  if (g && g[THEME_CONTEXT_GLOBAL_KEY]) {
    return g[THEME_CONTEXT_GLOBAL_KEY] as Context<ThemeContextType | undefined>;
  }

  const ctx = createContext<ThemeContextType | undefined>(undefined);
  if (g) g[THEME_CONTEXT_GLOBAL_KEY] = ctx;
  return ctx;
}

export const ThemeContext = getSingletonThemeContext();

/**
 * Hook для управления темой (light/dark mode)
 */
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);

  if (!context) {
    if (__DEV__) {
      const g: any = typeof globalThis !== 'undefined' ? globalThis : undefined;
      const alreadyWarned = Boolean(g && g[THEME_PROVIDER_WARNED_GLOBAL_KEY]);
      if (!alreadyWarned) {
        if (g) g[THEME_PROVIDER_WARNED_GLOBAL_KEY] = true;
        console.error(
          'useTheme must be used within ThemeProvider. ' +
            "If you're seeing this during Fast Refresh on web, a full reload usually fixes it."
        );
      }
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
  // SSR-safe defaults: do NOT read localStorage/matchMedia in useState initializers.
  // During static export window is undefined, so the server renders with 'auto'/false.
  // Reading localStorage here on the client would produce a different initial value
  // and cause React hydration error #418. The real values are applied in useEffect below.
  const [savedTheme, setSavedTheme] = useState<Theme>('auto');
  const [isDark, setIsDark] = useState(() => {
    if (Platform.OS !== 'web') return systemColorScheme === 'dark';
    return false;
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

  const value = useMemo<ThemeContextType>(() => ({
    theme: savedTheme,
    isDark,
    setTheme,
    toggleTheme,
  }), [savedTheme, isDark, setTheme, toggleTheme]);

  return createElement(ThemeContext.Provider, { value }, children);
}

/**
 * Хук для получения цветов в зависимости от темы
 * Использует современную матовую палитру (светлая/тёмная).
 */
export function useThemedColors() {
  const { isDark } = useTheme();
  return useMemo(() => getThemedColors(isDark), [isDark]);
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

    if (contrastQuery.media === '(prefers-contrast: more)') {
      contrastQuery.addEventListener('change', handleContrast);
    }

    return () => {
      reducedMotionQuery.removeEventListener('change', handleReducedMotion);
      if (contrastQuery.media === '(prefers-contrast: more)') {
        contrastQuery.removeEventListener('change', handleContrast);
      }
    };
  }, []);

  return useMemo(() => ({
    prefersReducedMotion,
    prefersHighContrast,
  }), [prefersReducedMotion, prefersHighContrast]);
}

/**
 * Хук для анимационного timing в зависимости от предпочтений
 */
export function useAnimationTiming() {
  const { prefersReducedMotion } = useAccessibilityPreferences();

  return useMemo(() => ({
    fast: prefersReducedMotion ? 0 : 150,
    normal: prefersReducedMotion ? 0 : 300,
    slow: prefersReducedMotion ? 0 : 500,
  }), [prefersReducedMotion]);
}
