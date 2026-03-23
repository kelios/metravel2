/**
 * Theme Management Hook
 * Handles light/dark mode switching with persistence
 */

import { useEffect, useMemo, useState, useCallback, createContext, useContext, createElement, type Context } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';
import { getThemedColors } from '@/constants/designSystem';

// Re-export helper for callers that historically imported it from this module.
export { getThemedColors };

export type Theme = 'light' | 'dark' | 'auto';

type ThemeGlobalBag = typeof globalThis & {
  [THEME_CONTEXT_GLOBAL_KEY]?: Context<ThemeContextType | undefined>;
  [THEME_PROVIDER_WARNED_GLOBAL_KEY]?: boolean;
};

function getThemeGlobalBag(): ThemeGlobalBag | undefined {
  return typeof globalThis !== 'undefined' ? (globalThis as ThemeGlobalBag) : undefined;
}

export interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const THEME_CONTEXT_GLOBAL_KEY = '__metravelThemeContext_v1';
const THEME_PROVIDER_WARNED_GLOBAL_KEY = '__metravelThemeProviderWarned_v1';

function getSingletonThemeContext(): Context<ThemeContextType | undefined> {
  const g = getThemeGlobalBag();
  if (g?.[THEME_CONTEXT_GLOBAL_KEY]) {
    return g[THEME_CONTEXT_GLOBAL_KEY];
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
      const g = getThemeGlobalBag();
      const alreadyWarned = Boolean(g?.[THEME_PROVIDER_WARNED_GLOBAL_KEY]);
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
    } else {
      // AND-24: Native — restore saved theme from AsyncStorage
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        AsyncStorage.getItem('theme').then((stored: string | null) => {
          if (stored && ['light', 'dark', 'auto'].includes(stored)) {
            setSavedTheme(stored as Theme);
          }
        }).catch(() => {});
      } catch {
        // AsyncStorage not available — use default
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
    if (savedTheme !== 'auto') return;

    if (Platform.OS === 'web') {
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        setIsDark(e.matches);
      };
      darkModeQuery.addEventListener('change', handleChange);
      return () => darkModeQuery.removeEventListener('change', handleChange);
    }

    // AND-24: Native — listen to Appearance changes for real-time dark mode sync
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setIsDark(colorScheme === 'dark');
    });
    return () => subscription.remove();
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
    } else {
      // AND-24: Persist theme on native via AsyncStorage
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        AsyncStorage.setItem('theme', theme).catch(() => {});
      } catch {
        // noop
      }
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
