// src/services/pdf-export/constructor/ImageLoader.ts
// ✅ АРХИТЕКТУРА: Сервис загрузки и оптимизации изображений

export interface ImageLoadOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'png' | 'webp' | 'jpeg';
}

export class ImageLoader {
  private static instance: ImageLoader;
  private cache: Map<string, HTMLImageElement> = new Map();
  private loadingPromises: Map<string, Promise<HTMLImageElement>> = new Map();

  private constructor() {}

  static getInstance(): ImageLoader {
    if (!ImageLoader.instance) {
      ImageLoader.instance = new ImageLoader();
    }
    return ImageLoader.instance;
  }

  /**
   * Загружает изображение с кэшированием
   */
  async loadImage(url: string): Promise<HTMLImageElement> {
    // Проверяем кэш
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }

    // Проверяем, не загружается ли уже
    if (this.loadingPromises.has(url)) {
      return this.loadingPromises.get(url)!;
    }

    // Создаем промис загрузки
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        this.cache.set(url, img);
        this.loadingPromises.delete(url);
        resolve(img);
      };
      
      img.onerror = (error) => {
        this.loadingPromises.delete(url);
        reject(new Error(`Failed to load image: ${url}`));
      };
      
      img.src = url;
    });

    this.loadingPromises.set(url, promise);
    return promise;
  }

  /**
   * Оптимизирует изображение (изменяет размер и формат)
   */
  async optimizeImage(
    img: HTMLImageElement,
    options: ImageLoadOptions = {}
  ): Promise<HTMLImageElement> {
    const {
      maxWidth = img.width,
      maxHeight = img.height,
      quality = 0.9,
      format = 'webp',
    } = options;

    // Вычисляем новый размер с сохранением пропорций
    const ratio = Math.min(maxWidth / img.width, maxHeight / img.height);
    const newWidth = Math.round(img.width * ratio);
    const newHeight = Math.round(img.height * ratio);

    // Если размер не изменился и формат не нужен, возвращаем оригинал
    if (newWidth === img.width && newHeight === img.height && format === 'png') {
      return img;
    }

    // Создаем canvas для оптимизации
    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Устанавливаем высокое качество рендеринга
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Рисуем изображение
    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    // Конвертируем в нужный формат
    const mimeType = format === 'webp' ? 'image/webp' : format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const dataUrl = canvas.toDataURL(mimeType, quality);

    // Создаем новое изображение из оптимизированных данных
    const optimized = new Image();
    return new Promise((resolve, reject) => {
      optimized.onload = () => resolve(optimized);
      optimized.onerror = reject;
      optimized.src = dataUrl;
    });
  }

  /**
   * Загружает и оптимизирует изображение
   */
  async loadAndOptimize(url: string, options: ImageLoadOptions = {}): Promise<HTMLImageElement> {
    const img = await this.loadImage(url);
    return this.optimizeImage(img, options);
  }

  /**
   * Очищает кэш
   */
  clearCache(): void {
    this.cache.clear();
    this.loadingPromises.clear();
  }

  /**
   * Удаляет изображение из кэша
   */
  removeFromCache(url: string): void {
    this.cache.delete(url);
    this.loadingPromises.delete(url);
  }
}

