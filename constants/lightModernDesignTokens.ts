/**
 * 🎨 СОВРЕМЕННЫЕ СВЕТЛЫЕ ДИЗАЙН ТОКЕНЫ ДЛЯ LIST TRAVEL
 *
 * Ультра-минималистичный, светлый дизайн с максимумом белого пространства.
 * Фокус на чистоте, простоте и высокой производительности.
 */

export const LIGHT_MODERN_DESIGN_TOKENS = {
  colors: {
    // Основные поверхности - почти чистый белый
    background: '#ffffff', // Чистый белый фон
    backgroundSecondary: '#fafbfc', // Очень светлый серо-голубой
    backgroundTertiary: '#f8f9fa', // Легкая текстура

    surface: '#ffffff', // Карточки - чистый белый
    surfaceElevated: '#ffffff', // Модалки - чистый белый
    surfaceMuted: 'rgba(255, 255, 255, 0.95)', // Полупрозрачные поверхности

    // Границы - очень тонкие
    border: 'rgba(0, 0, 0, 0.06)', // Почти прозрачные границы
    borderLight: 'rgba(0, 0, 0, 0.04)', // Ещё тоньше
    borderStrong: 'rgba(0, 0, 0, 0.08)', // Для акцентов

    // Текст - чёрный на белом для максимального контраста
    text: '#000000', // Чистый чёрный
    textSecondary: '#5c5c5c', // Средний серый
    textTertiary: '#8a8a8a', // Светлый серый
    textMuted: '#b3b3b3', // Очень светлый серый

    // Акценты - мягкие, ненавязчивые
    primary: '#4a90e2', // Мягкий синий
    primarySoft: 'rgba(74, 144, 226, 0.08)', // Очень мягкий акцент

    accent: '#50c878', // Мягкий зелёный для положительных элементов
    accentSoft: 'rgba(80, 200, 120, 0.08)',

    // Функциональные цвета
    success: '#50c878',
    successSoft: 'rgba(80, 200, 120, 0.08)',

    warning: '#f5a623',
    warningSoft: 'rgba(245, 166, 35, 0.08)',

    danger: '#e74c3c',
    dangerSoft: 'rgba(231, 76, 60, 0.08)',

    // Фокус - тонкий
    focus: 'rgba(74, 144, 226, 0.2)',

    // Скелетоны - очень светлые
    skeleton: '#f0f2f5',
    skeletonHighlight: '#e8ecef',
  },

  spacing: {
    // Минимальные отступы для плотной компоновки
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    xxxl: 40,
  },

  radii: {
    // Скругления - минимальные для современности
    none: 0,
    sm: 4,
    md: 6,
    lg: 8,
    xl: 12,
    full: 999,
  },

  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    sizes: {
      xs: 11,
      sm: 13,
      md: 15,
      lg: 17,
      xl: 20,
      xxl: 24,
    },
    weights: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    lineHeights: {
      tight: 1.2,
      normal: 1.4,
      loose: 1.6,
    },
  },

  shadows: {
    // Минимальные тени для глубины без визуального шума
    none: 'none',
    subtle: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
    soft: '0 2px 6px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
    medium: '0 4px 12px rgba(0, 0, 0, 0.06), 0 2px 4px rgba(0, 0, 0, 0.03)',
  },

  shadowsNative: {
    subtle: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 3,
      elevation: 1,
    },
    soft: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 3,
    },
  },

  animations: {
    duration: {
      instant: 0,
      fast: 100,
      normal: 200,
      slow: 300,
    },
    easing: {
      default: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      in: 'cubic-bezier(0.55, 0, 1, 0.45)',
      out: 'cubic-bezier(0, 0, 0.58, 1)',
      inOut: 'cubic-bezier(0.42, 0, 0.58, 1)',
    },
  },

  // Специфические токены для карточек путешествий
  card: {
    padding: {
      mobile: 12,
      desktop: 16,
    },
    borderRadius: 8,
    gap: 8,
    image: {
      aspectRatio: 16/10, // Более вытянутое соотношение для современности
      borderRadius: 6,
    },
    title: {
      size: 16,
      weight: '600',
      lineHeight: 1.3,
    },
    meta: {
      size: 13,
      weight: '400',
      lineHeight: 1.4,
    },
  },

  // Токены для сетки
  grid: {
    gap: {
      mobile: 12,
      desktop: 16,
    },
    columns: {
      mobile: 1,
      tablet: 2,
      desktop: 3,
      large: 4,
    },
  },
} as const;

// Типы для TypeScript
export type LightModernDesignTokens = typeof LIGHT_MODERN_DESIGN_TOKENS;
export type ColorKeys = keyof typeof LIGHT_MODERN_DESIGN_TOKENS.colors;
export type SpacingKeys = keyof typeof LIGHT_MODERN_DESIGN_TOKENS.spacing;
export type RadiusKeys = keyof typeof LIGHT_MODERN_DESIGN_TOKENS.radii;
