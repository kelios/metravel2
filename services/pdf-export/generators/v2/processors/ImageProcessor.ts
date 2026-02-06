// src/services/pdf-export/generators/v2/processors/ImageProcessor.ts
// ✅ ПРОЦЕССОР: Обработка изображений с кэшированием

import type { ImageProcessorConfig, CachedImage } from '../types';

/**
 * Обработчик изображений с кэшированием и проксированием
 */
export class ImageProcessor {
  private cache = new Map<string, CachedImage>();

  constructor(private config: ImageProcessorConfig) {}

  /**
   * Обрабатывает URL изображения
   */
  async processUrl(url: string): Promise<string> {
    if (!url) return '';

    // Проверяем кэш
    if (this.config.cacheEnabled && this.hasValidCache(url)) {
      return this.cache.get(url)!.url;
    }

    const processed = this.buildSafeUrl(url);

    // Сохраняем в кэш
    if (this.config.cacheEnabled) {
      this.cache.set(url, {
        url: processed,
        timestamp: Date.now()
      });
    }

    return processed;
  }

  /**
   * Создает безопасный URL для изображения
   */
  buildSafeUrl(url: string): string {
    if (!url) return '';

    // Локальные URL - оставляем как есть
    if (url.startsWith('/') || url.startsWith('data:') || url.startsWith('file:')) {
      return url;
    }

    // Внешние URL - проксируем если включено
    if (this.config.proxyEnabled && (url.startsWith('http://') || url.startsWith('https://'))) {
      try {
        const encoded = encodeURIComponent(url);
        return `${this.config.proxyUrl}/?url=${encoded}&w=${this.config.maxWidth}&output=webp`;
      } catch (e) {
        console.warn('Failed to proxy image URL:', url, e);
        return url;
      }
    }

    return url;
  }

  /**
   * Предзагружает массив изображений
   */
  async preloadImages(urls: string[]): Promise<void> {
    await Promise.all(urls.map(url => this.processUrl(url)));
  }

  /**
   * Проверяет валидность кэша для URL
   */
  private hasValidCache(url: string): boolean {
    const cached = this.cache.get(url);
    if (!cached) return false;

    const age = Date.now() - cached.timestamp;
    return age < this.config.cacheTTL;
  }

  /**
   * Очищает кэш
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Очищает устаревшие записи из кэша
   */
  cleanup(): void {
    const now = Date.now();
    for (const [url, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.config.cacheTTL) {
        this.cache.delete(url);
      }
    }
  }
}

