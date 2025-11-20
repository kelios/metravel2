// src/utils/imageErrorHandler.ts
// ✅ Утилита для обработки ошибок загрузки изображений

import { logError } from './logger';

export interface ImageErrorInfo {
  url: string;
  error: Error;
  retryCount?: number;
  context?: Record<string, any>;
}

/**
 * Обрабатывает ошибку загрузки изображения
 */
export function handleImageError(
  url: string,
  error: Error | unknown,
  options: {
    retryCount?: number;
    maxRetries?: number;
    context?: Record<string, any>;
    onRetry?: () => void;
    onFallback?: () => void;
  } = {}
): void {
  const {
    retryCount = 0,
    maxRetries = 3,
    context = {},
    onRetry,
    onFallback,
  } = options;

  const errorObj = error instanceof Error ? error : new Error(String(error));

  // Логируем ошибку
  logError(errorObj, {
    type: 'image_load_error',
    url,
    retryCount,
    ...context,
  });

  // Если это CORS ошибка, не пытаемся повторить
  if (
    errorObj.message.includes('CORS') ||
    errorObj.message.includes('cross-origin')
  ) {
    if (onFallback) {
      onFallback();
    }
    return;
  }

  // Если это ошибка сети и есть попытки, можно повторить
  if (
    retryCount < maxRetries &&
    (errorObj.message.includes('network') ||
      errorObj.message.includes('timeout') ||
      errorObj.message.includes('Failed to fetch'))
  ) {
    if (onRetry) {
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
      setTimeout(() => {
        onRetry();
      }, delay);
    }
    return;
  }

  // Если все попытки исчерпаны, используем fallback
  if (onFallback) {
    onFallback();
  }
}

/**
 * Проверяет, является ли URL изображения валидным
 */
export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Проверяем базовый формат URL
  try {
    const parsed = new URL(url);
    // Разрешаем только http и https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
  } catch {
    // Если не удалось распарсить, проверяем базовый формат
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return false;
    }
  }

  // Проверяем расширение файла (опционально)
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const hasExtension = imageExtensions.some((ext) =>
    url.toLowerCase().includes(ext)
  );

  // URL валиден если это http/https или имеет расширение изображения
  return url.startsWith('http') || hasExtension;
}

/**
 * Получает placeholder URL для изображения
 */
export function getImagePlaceholder(
  width: number = 400,
  height: number = 300
): string {
  // SVG placeholder
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#f3f4f6"/>
    <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#9ca3af" font-family="system-ui" font-size="14">Изображение</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Оптимизирует URL изображения (добавляет параметры для оптимизации)
 */
export function optimizeImageUrl(
  url: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'jpg' | 'png';
  } = {}
): string {
  if (!url || !isValidImageUrl(url)) {
    return url;
  }

  const { width, height, quality = 80, format } = options;

  try {
    const urlObj = new URL(url);

    // Добавляем параметры оптимизации (зависит от сервера)
    if (width) {
      urlObj.searchParams.set('w', String(width));
    }
    if (height) {
      urlObj.searchParams.set('h', String(height));
    }
    if (quality) {
      urlObj.searchParams.set('q', String(quality));
    }
    if (format) {
      urlObj.searchParams.set('format', format);
    }

    return urlObj.toString();
  } catch {
    // Если не удалось распарсить URL, возвращаем как есть
    return url;
  }
}

