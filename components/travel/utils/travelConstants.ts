/**
 * Константы для страницы путешествия
 * Централизация всех констант для улучшения поддерживаемости и производительности
 */

// ✅ ОПТИМИЗАЦИЯ: Адаптивные breakpoints
export const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
  DESKTOP: 1200,
  WIDE: 1600,
} as const;

// ✅ ОПТИМИЗАЦИЯ: Адаптивная ширина меню (обновлено для устранения скролла)
export const MENU_WIDTH = {
  MOBILE: '100%',
  TABLET: 320,    // было 300, увеличено для полного устранения скролла
  DESKTOP: 380,   // было 360, увеличено для длинных названий погоды
} as const;

// ✅ ОПТИМИЗАЦИЯ: Отступы header
export const HEADER_OFFSET = {
  MOBILE: 56,
  DESKTOP: 72,
} as const;

// ✅ ОПТИМИЗАЦИЯ: Максимальная ширина контента
export const MAX_CONTENT_WIDTH = {
  DESCRIPTION: 760,
  MAIN: 1200,
  WIDE: 1440,
} as const;

// ✅ ОПТИМИЗАЦИЯ: Адаптивные горизонтальные отступы
export const CONTENT_PADDING = {
  MOBILE: 16,
  TABLET: 32,
  DESKTOP: 48,
  WIDE: 64,
  ULTRA_WIDE: 80,
} as const;

// ✅ ОПТИМИЗАЦИЯ: Настройки lazy loading
export const LAZY_LOAD_CONFIG = {
  INTERSECTION_MARGIN: '200px 0px 0px 0px',
  INTERSECTION_THRESHOLD: 0.1,
  IDLE_TIMEOUT: 900,
  DEFER_TIMEOUT: 2600,
  FORCE_TIMEOUT: 2000,
} as const;

// ✅ ОПТИМИЗАЦИЯ: Настройки изображений
export const IMAGE_CONFIG = {
  LCP_QUALITY: 85,
  STANDARD_QUALITY: 75,
  THUMBNAIL_QUALITY: 60,
  LCP_FORMAT: 'webp' as const,
  STANDARD_FORMAT: 'webp' as const,
  CACHE_POLICY: 'memory-disk' as const,
} as const;

// ✅ ОПТИМИЗАЦИЯ: Приоритеты загрузки
export const LOAD_PRIORITY = {
  HIGH: 'high' as const,
  LOW: 'low' as const,
  AUTO: 'auto' as const,
} as const;

// ✅ ОПТИМИЗАЦИЯ: Ключи для хранения состояния
export const STORAGE_KEYS = {
  FAB_HINT: 'travel:floatingMenu:hintShown',
  MENU_STATE: 'travel:menu:state',
} as const;

// ✅ ОПТИМИЗАЦИЯ: Таймауты для анимаций
export const ANIMATION_DURATION = {
  FAST: 200,
  NORMAL: 300,
  SLOW: 500,
} as const;

// ✅ ОПТИМИЗАЦИЯ: Настройки retry для загрузки компонентов
export const RETRY_CONFIG = {
  MAX_TRIES: 2,
  DELAY: 900,
} as const;

// ✅ ОПТИМИЗАЦИЯ: Индекс LCP изображения в контенте
export const LCP_IMAGE_INDEX = 0;

// ✅ ОПТИМИЗАЦИЯ: Настройки YouTube
export const YOUTUBE_CONFIG = {
  THUMBNAIL_QUALITY: 'hqdefault',
  EMBED_PARAMS: 'autoplay=1&rel=0&modestbranding=1&playsinline=1',
} as const;
