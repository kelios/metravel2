/**
 * Theme Management Hook
 * Handles light/dark mode switching with persistence
 */

import { useEffect, useState, useCallback, createContext, useContext, createElement } from 'react';
import { Platform, useColorScheme } from 'react-native';

export type Theme = 'light' | 'dark' | 'auto';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Hook для управления темой (light/dark mode)
 */
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}

/**
 * Provider компонент для темы
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [savedTheme, setSavedTheme] = useState<Theme>('auto');
  const [isDark, setIsDark] = useState(false);

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
 */
export function useThemedColors() {
  const { isDark } = useTheme();

  return {
    // Primary
    primary: isDark ? '#60A5FA' : '#0066CC',
    primaryDark: isDark ? '#3B82F6' : '#0052A3',
    primaryLight: isDark ? '#93C5FD' : '#E6F2FF',

    // Text
    text: isDark ? '#F5F7FA' : '#1A1A1A',
    textMuted: isDark ? '#9CA3AF' : '#4A4A4A',
    textInverse: isDark ? '#1A1A1A' : '#FFFFFF',

    // Background
    background: isDark ? '#0F172A' : '#FFFFFF',
    surface: isDark ? '#1E293B' : '#FFFFFF',
    surfaceLight: isDark ? '#334155' : '#F5F7FA',
    border: isDark ? '#475569' : '#E5E7EB',

    // Status
    success: isDark ? '#4ADE80' : '#059669',
    error: isDark ? '#F87171' : '#DC2626',
    warning: isDark ? '#FBBF24' : '#D97706',
    info: isDark ? '#38BDF8' : '#0284C7',
  };
}

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

