// src/infrastructure/image/ImageLoader.ts
// ✅ АРХИТЕКТУРА: Загрузчик изображений с retry и batch обработкой

import { ExportConfig } from '@/types/pdf-export';
import { ErrorHandler } from '@/infrastructure/error/ErrorHandler';
import { devWarn } from '@/utils/logger';

/**
 * Сервис для загрузки изображений с retry механизмом
 */
const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" rx="12" ry="12" fill="rgb(243, 244, 246)"/>
  <path d="M60 210 L140 130 L190 180 L260 110 L340 210" stroke="rgb(209, 213, 219)" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="140" cy="120" r="24" fill="rgb(209, 213, 219)"/>
  <circle cx="285" cy="150" r="16" fill="rgb(229, 231, 235)"/>
</svg>`;
const PLACEHOLDER_DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PLACEHOLDER_SVG)}`;

export class ImageLoader {
  private loadedImages: Map<string, HTMLImageElement> = new Map();
  private failedImages: Set<string> = new Set();

  constructor(
    private config: ExportConfig = {},
    private errorHandler: ErrorHandler
  ) {}

  /**
   * Загружает одно изображение с retry
   * ✅ PDF-002: При ошибке возвращает placeholder вместо throw
   */
  async loadImage(url: string, retryCount = 0, usePlaceholderOnError = true): Promise<HTMLImageElement> {
    // Проверяем кэш
    if (this.loadedImages.has(url)) {
      return this.loadedImages.get(url)!;
    }

    // Проверяем, не провалилось ли уже
    if (this.failedImages.has(url) && retryCount === 0) {
      if (usePlaceholderOnError) {
        devWarn(`[ImageLoader] Image ${url} previously failed, using placeholder`);
        return this.createPlaceholderImage();
      }
      throw new Error(`Image ${url} previously failed to load`);
    }

    const maxRetries = this.config.maxRetries || 3;
    // ✅ ИСПРАВЛЕНИЕ: Уменьшаем таймаут на попытку, т.к. пробуем несколько стратегий
    const timeout = Math.min(this.config.imageLoadTimeout || 10000, 5000);

    try {
      const img = await this.loadImageWithTimeout(url, timeout);
      this.loadedImages.set(url, img);
      return img;
    } catch (error) {
      if (retryCount < maxRetries) {
        const delay = this.errorHandler.getRetryDelay(retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.loadImage(url, retryCount + 1, usePlaceholderOnError);
      } else {
        this.failedImages.add(url);
        
        // ✅ PDF-002: Возвращаем placeholder вместо throw, если включен режим graceful degradation
        if (usePlaceholderOnError) {
          devWarn(`[ImageLoader] Failed to load image after ${maxRetries} retries: ${url}, using placeholder`);
          const placeholder = this.createPlaceholderImage();
          // Кэшируем placeholder для этого URL, чтобы не создавать его каждый раз
          this.loadedImages.set(url, placeholder);
          return placeholder;
        }
        
        throw this.errorHandler.handle(
          error,
          { url, retryCount, maxRetries }
        );
      }
    }
  }

  /**
   * ✅ PDF-002: Создает placeholder изображение
   */
  createPlaceholderImage(): HTMLImageElement {
    const img = new Image();
    img.src = PLACEHOLDER_DATA_URL;
    img.alt = 'Изображение недоступно';
    return img;
  }

  /**
   * Извлекает оригинальный URL из прокси URL (images.weserv.nl)
   */
  private extractOriginalUrl(proxyUrl: string): string | null {
    try {
      if (proxyUrl.includes('images.weserv.nl')) {
        const url = new URL(proxyUrl);
        const urlParam = url.searchParams.get('url');
        if (urlParam) {
          // Декодируем URL и добавляем протокол если отсутствует
          const decoded = decodeURIComponent(urlParam);
          if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
            return decoded;
          }
          return `https://${decoded}`;
        }
      }
    } catch (error) {
      devWarn('[ImageLoader] Failed to extract original URL from proxy:', error);
    }
    return null;
  }

  /**
   * Загружает изображение с таймаутом и fallback на оригинальный URL
   * ✅ ИСПРАВЛЕНИЕ: Пробует несколько стратегий загрузки для обхода CORS
   */
  private loadImageWithTimeout(url: string, timeout: number, attempt = 0): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const isProxyUrl = url.includes('images.weserv.nl');
      const originalUrl = isProxyUrl ? this.extractOriginalUrl(url) : null;
      
      // Стратегии загрузки для прокси URL:
      // 0: Прокси без crossOrigin (может работать если прокси поддерживает)
      // 1: Прокси с crossOrigin (для html2canvas)
      // 2: Оригинальный URL с crossOrigin
      // 3: Оригинальный URL без crossOrigin (последняя попытка)
      
      // Стратегии для обычных URL:
      // 0: С crossOrigin (для html2canvas)
      // 1: Без crossOrigin (fallback)
      
      let currentUrl = url;
      let useCrossOrigin = false;
      let maxAttempts = isProxyUrl && originalUrl ? 4 : 2;
      
      if (isProxyUrl) {
        if (attempt === 0) {
          // Первая попытка: прокси без crossOrigin
          useCrossOrigin = false;
          currentUrl = url;
        } else if (attempt === 1) {
          // Вторая попытка: прокси с crossOrigin
          useCrossOrigin = true;
          currentUrl = url;
        } else if (attempt === 2 && originalUrl) {
          // Третья попытка: оригинальный URL с crossOrigin
          useCrossOrigin = true;
          currentUrl = originalUrl;
          devWarn(`[ImageLoader] Proxy failed, trying original URL with CORS: ${originalUrl}`);
        } else if (attempt === 3 && originalUrl) {
          // Четвертая попытка: оригинальный URL без crossOrigin
          useCrossOrigin = false;
          currentUrl = originalUrl;
          devWarn(`[ImageLoader] Trying original URL without CORS: ${originalUrl}`);
        } else {
          reject(new Error(`Failed to load image after all attempts: ${url}`));
          return;
        }
      } else {
        // Обычный URL (не прокси)
        if (attempt === 0) {
          // Первая попытка: с crossOrigin
          useCrossOrigin = true;
          currentUrl = url;
        } else if (attempt === 1) {
          // Вторая попытка: без crossOrigin
          useCrossOrigin = false;
          currentUrl = url;
        } else {
          reject(new Error(`Failed to load image after all attempts: ${url}`));
          return;
        }
      }

      const img = new Image();
      if (useCrossOrigin) {
        img.crossOrigin = 'anonymous';
      }
      img.referrerPolicy = 'no-referrer';

      const timeoutId = setTimeout(() => {
        // Пробуем следующую стратегию
        if (attempt + 1 < maxAttempts) {
          this.loadImageWithTimeout(url, timeout, attempt + 1)
            .then(resolve)
            .catch(reject);
        } else {
          reject(new Error(`Image load timeout: ${url}`));
        }
      }, timeout);

      img.onload = () => {
        clearTimeout(timeoutId);
        resolve(img);
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        // Пробуем следующую стратегию
        if (attempt + 1 < maxAttempts) {
          this.loadImageWithTimeout(url, timeout, attempt + 1)
            .then(resolve)
            .catch(reject);
        } else {
          reject(new Error(`Failed to load image: ${url}`));
        }
      };

      img.src = currentUrl;
    });
  }

  /**
   * Загружает изображения батчами
   */
  async loadImagesBatch(
    urls: string[],
    batchSize: number = this.config.batchSize || 5,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<Map<string, HTMLImageElement>> {
    const results = new Map<string, HTMLImageElement>();
    const total = urls.length;
    let loaded = 0;

    // Фильтруем уже загруженные
    const urlsToLoad = urls.filter(url => !this.loadedImages.has(url));

    // Загружаем батчами
    for (let i = 0; i < urlsToLoad.length; i += batchSize) {
      const batch = urlsToLoad.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (url) => {
        try {
          // ✅ PDF-002: Используем placeholder при ошибке (usePlaceholderOnError = true по умолчанию)
          const img = await this.loadImage(url, 0, true);
          results.set(url, img);
          loaded++;
          onProgress?.(loaded, total);
          return { url, success: true, element: img };
        } catch (error) {
          // ✅ PDF-002: Даже при ошибке возвращаем placeholder
          loaded++;
          onProgress?.(loaded, total);
          const placeholder = this.createPlaceholderImage();
          results.set(url, placeholder);
          return { url, success: false, error: error as Error, element: placeholder };
        }
      });

      await Promise.allSettled(batchPromises);
    }

    // Добавляем уже загруженные из кэша
    urls.forEach(url => {
      if (this.loadedImages.has(url)) {
        results.set(url, this.loadedImages.get(url)!);
      }
    });

    return results;
  }

  /**
   * Загружает все изображения из контейнера
   */
  async loadImagesFromContainer(
    container: HTMLElement,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<void> {
    const images = container.querySelectorAll('img');
    const urls: string[] = [];

    images.forEach((img) => {
      const url = img.src || img.getAttribute('src');
      if (url && !url.startsWith('data:')) {
        urls.push(url);
      }
    });

    if (urls.length === 0) {
      return;
    }

    await this.loadImagesBatch(urls, this.config.batchSize || 5, onProgress);

    // Обновляем изображения в контейнере
    images.forEach((img) => {
      const url = img.src || img.getAttribute('src');
      if (url && this.loadedImages.has(url)) {
        const loadedImg = this.loadedImages.get(url)!;
        if (img.src !== loadedImg.src) {
          img.src = loadedImg.src;
        }
      } else if (url && this.failedImages.has(url)) {
        img.setAttribute('data-original-src', url);
        img.setAttribute('data-image-loader-fallback', 'true');
        img.src = PLACEHOLDER_DATA_URL;
        img.style.backgroundColor = 'rgb(243, 244, 246)';
        img.style.objectFit = 'cover';
        img.style.color = 'rgb(209, 213, 219)';
      }
    });
  }

  /**
   * Очищает кэш
   */
  clearCache(): void {
    this.loadedImages.clear();
    this.failedImages.clear();
  }

  /**
   * Получает статистику загрузки
   */
  getStats(): { loaded: number; failed: number; cached: number } {
    return {
      loaded: this.loadedImages.size,
      failed: this.failedImages.size,
      cached: this.loadedImages.size,
    };
  }
}
