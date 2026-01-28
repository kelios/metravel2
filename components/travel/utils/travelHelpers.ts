/**
 * Вспомогательные функции для страницы путешествия
 * Централизация логики для переиспользования и тестирования
 */

import { BREAKPOINTS, MENU_WIDTH, CONTENT_PADDING, MAX_CONTENT_WIDTH } from './travelConstants';

// ✅ ОПТИМИЗАЦИЯ: Определение типа устройства
export function isMobile(width: number): boolean {
  return width < BREAKPOINTS.MOBILE;
}

export function isTablet(width: number): boolean {
  return width >= BREAKPOINTS.MOBILE && width < BREAKPOINTS.DESKTOP;
}

export function isDesktop(width: number): boolean {
  return width >= BREAKPOINTS.DESKTOP;
}

// ✅ ОПТИМИЗАЦИЯ: Расчет ширины меню
export function getMenuWidth(width: number): number | string {
  if (width >= BREAKPOINTS.DESKTOP) return MENU_WIDTH.DESKTOP;
  if (width >= BREAKPOINTS.MOBILE) return MENU_WIDTH.TABLET;
  return MENU_WIDTH.MOBILE;
}

// ✅ ОПТИМИЗАЦИЯ: Расчет горизонтальных отступов контента
export function getContentPadding(width: number): number {
  if (width >= 1600) return CONTENT_PADDING.ULTRA_WIDE;
  if (width >= 1440) return CONTENT_PADDING.WIDE;
  if (width >= 1024) return CONTENT_PADDING.DESKTOP;
  if (width >= 768) return CONTENT_PADDING.TABLET;
  return CONTENT_PADDING.MOBILE;
}

// ✅ ОПТИМИЗАЦИЯ: Расчет максимальной ширины контента
export function getMaxContentWidth(type: 'description' | 'main' | 'wide' = 'main'): number {
  switch (type) {
    case 'description':
      return MAX_CONTENT_WIDTH.DESCRIPTION;
    case 'wide':
      return MAX_CONTENT_WIDTH.WIDE;
    case 'main':
    default:
      return MAX_CONTENT_WIDTH.MAIN;
  }
}

// ✅ ОПТИМИЗАЦИЯ: Извлечение YouTube ID
export function getYoutubeId(url?: string | null): string | null {
  if (!url) return null;
  
  const patterns = [
    /(?:youtu\.be\/|shorts\/|embed\/|watch\?v=|watch\?.*?v%3D)([^?&/#]+)/,
    /youtube\.com\/.*?[?&]v=([^?&#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  
  return null;
}

// ✅ ОПТИМИЗАЦИЯ: Очистка HTML для описания
export function stripToDescription(html?: string, maxLength: number = 160): string {
  if (!html) return 'Найди место для путешествия и поделись своим опытом.';
  
  const plain = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  return plain.slice(0, maxLength) || 'Найди место для путешествия и поделись своим опытом.';
}

// ✅ ОПТИМИЗАЦИЯ: Получение origin из URL
export function getOrigin(url?: string): string | null {
  if (!url) return null;
  
  try {
    return new URL(url.replace(/^http:\/\//i, 'https://')).origin;
  } catch {
    return null;
  }
}

// ✅ ОПТИМИЗАЦИЯ: Построение версионированного URL
export function buildVersionedUrl(
  url?: string,
  updated_at?: string | null,
  id?: any
): string {
  if (!url) return '';
  
  const base = url.replace(/^http:\/\//i, 'https://');
  const ver = updated_at ? Date.parse(updated_at) : id ? Number(id) : 0;
  
  return ver && Number.isFinite(ver) ? `${base}?v=${ver}` : base;
}

// ✅ ОПТИМИЗАЦИЯ: requestIdleCallback с fallback
export function requestIdleCallback(
  callback: () => void,
  timeout: number = 900
): void {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as any).requestIdleCallback(callback, { timeout });
  } else {
    setTimeout(callback, timeout);
  }
}

// ✅ ОПТИМИЗАЦИЯ: Retry функция для загрузки компонентов
export async function retry<T>(
  fn: () => Promise<T>,
  tries: number = 2,
  delay: number = 900
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (tries <= 0) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return retry(fn, tries - 1, delay);
  }
}

// ✅ ОПТИМИЗАЦИЯ: Проверка пустого HTML
export function isEmptyHtml(html?: string): boolean {
  if (!html) return true;
  
  const text = html.trim().replace(/<[^>]+>/g, '');
  return text.length === 0;
}

// ✅ ОПТИМИЗАЦИЯ: Расчет aspect ratio
export function calculateAspectRatio(
  width?: number,
  height?: number,
  defaultRatio: number = 16 / 9
): number {
  if (width && height && width > 0 && height > 0) {
    return width / height;
  }
  return defaultRatio;
}

// ✅ ОПТИМИЗАЦИЯ: Извлечение размеров из имени файла
export function extractDimensionsFromFilename(
  filename: string
): { width?: number; height?: number } {
  const match = filename.match(/[-_](\d{2,5})x(\d{2,5})\.(jpg|jpeg|png|webp|avif)(\?|$)/i);
  
  if (match) {
    return {
      width: parseInt(match[1], 10),
      height: parseInt(match[2], 10),
    };
  }
  
  return {};
}

// ✅ ОПТИМИЗАЦИЯ: Debounce функция
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ✅ ОПТИМИЗАЦИЯ: Throttle функция
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ✅ ОПТИМИЗАЦИЯ: Форматирование числа просмотров
export function formatViewCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

// ✅ ОПТИМИЗАЦИЯ: Форматирование даты
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return '';
  
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  
  return d.toLocaleDateString('ru-RU', options);
}

// ✅ ОПТИМИЗАЦИЯ: Проверка поддержки WebP
export function supportsWebP(): boolean {
  if (typeof window === 'undefined') return false;
  
  const canvas = document.createElement('canvas');
  if (canvas.getContext && canvas.getContext('2d')) {
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }
  
  return false;
}

// ✅ ОПТИМИЗАЦИЯ: Получение оптимального формата изображения
export function getOptimalImageFormat(): 'webp' | 'jpeg' {
  return supportsWebP() ? 'webp' : 'jpeg';
}
