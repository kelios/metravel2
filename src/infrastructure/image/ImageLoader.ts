// src/infrastructure/image/ImageLoader.ts
// ✅ АРХИТЕКТУРА: Загрузчик изображений с retry и batch обработкой

import { ExportConfig } from '@/src/types/pdf-export';
import { ErrorHandler } from '@/src/infrastructure/error/ErrorHandler';

interface ImageLoadResult {
  url: string;
  success: boolean;
  error?: Error;
  element?: HTMLImageElement;
}

/**
 * Сервис для загрузки изображений с retry механизмом
 */
const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" rx="12" ry="12" fill="#f3f4f6"/>
  <path d="M60 210 L140 130 L190 180 L260 110 L340 210" stroke="#d1d5db" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="140" cy="120" r="24" fill="#d1d5db"/>
  <circle cx="285" cy="150" r="16" fill="#e5e7eb"/>
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
   */
  async loadImage(url: string, retryCount = 0): Promise<HTMLImageElement> {
    // Проверяем кэш
    if (this.loadedImages.has(url)) {
      return this.loadedImages.get(url)!;
    }

    // Проверяем, не провалилось ли уже
    if (this.failedImages.has(url) && retryCount === 0) {
      throw new Error(`Image ${url} previously failed to load`);
    }

    const maxRetries = this.config.maxRetries || 3;
    const timeout = this.config.imageLoadTimeout || 10000;

    try {
      const img = await this.loadImageWithTimeout(url, timeout);
      this.loadedImages.set(url, img);
      return img;
    } catch (error) {
      if (retryCount < maxRetries) {
        const delay = this.errorHandler.getRetryDelay(retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.loadImage(url, retryCount + 1);
      } else {
        this.failedImages.add(url);
        throw this.errorHandler.handle(
          error,
          { url, retryCount, maxRetries }
        );
      }
    }
  }

  /**
   * Загружает изображение с таймаутом
   */
  private loadImageWithTimeout(url: string, timeout: number): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';

      const timeoutId = setTimeout(() => {
        reject(new Error(`Image load timeout: ${url}`));
      }, timeout);

      img.onload = () => {
        clearTimeout(timeoutId);
        resolve(img);
      };

      img.onerror = (error) => {
        clearTimeout(timeoutId);
        reject(new Error(`Failed to load image: ${url}`));
      };

      img.src = url;
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
          const img = await this.loadImage(url);
          results.set(url, img);
          loaded++;
          onProgress?.(loaded, total);
          return { url, success: true, element: img };
        } catch (error) {
          loaded++;
          onProgress?.(loaded, total);
          return { url, success: false, error: error as Error };
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
        img.style.backgroundColor = '#f3f4f6';
        img.style.objectFit = 'cover';
        img.style.color = '#d1d5db';
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

