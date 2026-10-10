/**
 * Theme Management Hook
 * Handles light/dark mode switching with persistence
 */

import { useEffect, useMemo, useRef, useState, useCallback, createContext, useContext, createElement, type Context } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';
import { DESIGN_COLORS, getThemedColors } from '@/constants/designSystem';
import {
  SEASONAL_THEME_DOM_ATTRIBUTE,
  SEASONAL_THEME_STORAGE_KEY,
  isSeasonalThemePreference,
  resolveSeasonalTheme,
  type SeasonalThemeId,
  type SeasonalThemePreference,
} from '@/constants/seasonalThemes';

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
  /** Настройка праздничного оформления (#2376): по календарю, выключено или конкретная тема. */
  seasonalTheme: SeasonalThemePreference;
  /** Фактически применённая праздничная тема (`null` — обычный вид). */
  activeSeasonalTheme: SeasonalThemeId | null;
  setSeasonalTheme: (preference: SeasonalThemePreference) => void;
}

const THEME_STORAGE_KEY = 'theme';

type PersistedThemePrefs = { theme: Theme | null; seasonalTheme: SeasonalThemePreference | null };

const isTheme = (value: unknown): value is Theme =>
  value === 'light' || value === 'dark' || value === 'auto';

/** Итоговая схема по настройке и системной схеме (web читает matchMedia сам). */
const resolveIsDark = (theme: Theme, systemColorScheme: string | null | undefined): boolean => {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false;
  }
  return systemColorScheme === 'dark';
};

/** Читает обе настройки из хранилища платформы; на native — асинхронно через AsyncStorage. */
function readPersistedThemePrefs(onRead: (prefs: PersistedThemePrefs) => void): void {
  if (Platform.OS === 'web') {
    let theme: string | null = null;
    let seasonal: string | null = null;
    try {
      theme = localStorage.getItem(THEME_STORAGE_KEY);
      seasonal = localStorage.getItem(SEASONAL_THEME_STORAGE_KEY);
    } catch {
      // localStorage недоступен (приватный режим / запрет cookies) — остаёмся на дефолтах
    }
    onRead({
      theme: isTheme(theme) ? theme : null,
      seasonalTheme: isSeasonalThemePreference(seasonal) ? seasonal : null,
    });
    return;
  }
  // AND-24: Native — restore saved prefs from AsyncStorage
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    AsyncStorage.multiGet([THEME_STORAGE_KEY, SEASONAL_THEME_STORAGE_KEY])
      .then((pairs: Array<[string, string | null]>) => {
        const map = new Map(pairs);
        const theme = map.get(THEME_STORAGE_KEY);
        const seasonal = map.get(SEASONAL_THEME_STORAGE_KEY);
        onRead({
          theme: isTheme(theme) ? theme : null,
          seasonalTheme: isSeasonalThemePreference(seasonal) ? seasonal : null,
        });
      })
      .catch(() => onRead({ theme: null, seasonalTheme: null }));
  } catch {
    // AsyncStorage not available — дефолты, но флаг чтения всё равно должен подняться
    onRead({ theme: null, seasonalTheme: null });
  }
}

function persistThemePref(key: string, value: string): void {
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(key, value);
    } catch {
      // хранилище недоступно — настройка живёт до перезагрузки
    }
    return;
  }
  // AND-24: Persist on native via AsyncStorage
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    AsyncStorage.setItem(key, value).catch(() => {});
  } catch {
    // noop
  }
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
      seasonalTheme: 'auto',
      activeSeasonalTheme: null,
      setSeasonalTheme: () => undefined,
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

  // Праздничное оформление (#2376). SSR-дефолт `auto`; стартовый скрипт
  // `app/+html.tsx` уже поставил `data-season` по тем же окнам, здесь атрибут
  // лишь синхронизируется с настройкой после чтения хранилища.
  const [seasonalTheme, setSeasonalThemeState] = useState<SeasonalThemePreference>('auto');
  // Вкладка, открытая через границу окна (14.10 → 15.10), пересчитывает сезон при
  // возврате к ней: дата обновляется на visibilitychange и пересобирает memo.
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const activeSeasonalTheme = useMemo(
    () => resolveSeasonalTheme(seasonalTheme, calendarDate),
    [seasonalTheme, calendarDate],
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') setCalendarDate(new Date());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // До чтения хранилища атрибуты `<html>` не трогаем (#2376, #2381): SSR-дефолты
  // (`auto`/светлая) расходятся с сохранёнными, и первый эффект на них затирал
  // `data-theme`/`data-season`, выставленные стартовым скриптом, — вспышка
  // противоположной темы на каждой загрузке. На web чтение синхронное, поэтому
  // сохранённые значения, итоговая схема и флаг попадают в один рендер.
  const [prefsRead, setPrefsRead] = useState(false);
  // Системная схема на момент чтения; дальше её ведёт свой эффект, а чтение — одноразовое.
  const systemColorSchemeRef = useRef(systemColorScheme);
  systemColorSchemeRef.current = systemColorScheme;

  // Инициализация темы при монтировании
  useEffect(() => {
    readPersistedThemePrefs((prefs) => {
      const theme = prefs.theme ?? 'auto';
      setSavedTheme(theme);
      setIsDark(resolveIsDark(theme, systemColorSchemeRef.current));
      if (prefs.seasonalTheme) setSeasonalThemeState(prefs.seasonalTheme);
      setPrefsRead(true);
    });
  }, []);

  // Определить текущую тему. До чтения хранилища не пересчитываем: в одном
  // проходе эффектов этот пересчёт по SSR-дефолту `auto` затирал бы значение,
  // только что выставленное по сохранённой настройке (#2381).
  useEffect(() => {
    if (!prefsRead) return;
    setIsDark(resolveIsDark(savedTheme, systemColorScheme));
  }, [savedTheme, systemColorScheme, prefsRead]);

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
    if (!prefsRead) return;

    const root = document.documentElement;
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    root.style.colorScheme = isDark ? 'dark' : 'light';
    document
      .getElementById('app-theme-color')
      ?.setAttribute('content', isDark ? DESIGN_COLORS.themeColorDark : DESIGN_COLORS.themeColorLight);
  }, [isDark, prefsRead]);

  // Синхронизация праздничного оформления для web: `data-season` читает app/global.css.
  // На Android/iOS токены — литералы StyleSheet, сезонной палитры там нет (осознанно, #2376).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof document === 'undefined') return;
    if (!prefsRead) return;

    const root = document.documentElement;
    if (activeSeasonalTheme) {
      root.setAttribute(SEASONAL_THEME_DOM_ATTRIBUTE, activeSeasonalTheme);
    } else {
      root.removeAttribute(SEASONAL_THEME_DOM_ATTRIBUTE);
    }
  }, [activeSeasonalTheme, prefsRead]);

  const setTheme = useCallback((theme: Theme) => {
    setSavedTheme(theme);
    persistThemePref(THEME_STORAGE_KEY, theme);
  }, []);

  const setSeasonalTheme = useCallback((preference: SeasonalThemePreference) => {
    setSeasonalThemeState(preference);
    persistThemePref(SEASONAL_THEME_STORAGE_KEY, preference);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(isDark ? 'light' : 'dark');
  }, [isDark, setTheme]);

  const value = useMemo<ThemeContextType>(() => ({
    theme: savedTheme,
    isDark,
    setTheme,
    toggleTheme,
    seasonalTheme,
    activeSeasonalTheme,
    setSeasonalTheme,
  }), [savedTheme, isDark, setTheme, toggleTheme, seasonalTheme, activeSeasonalTheme, setSeasonalTheme]);

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
