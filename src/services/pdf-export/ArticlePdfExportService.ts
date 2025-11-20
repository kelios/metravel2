// src/services/pdf-export/ArticlePdfExportService.ts
// ✅ АРХИТЕКТУРА: Сервис экспорта одной статьи в PDF

import { Platform } from 'react-native';
import type { Travel } from '@/src/types/types';
import type { ArticlePdfModel } from '@/src/types/article-pdf';
import { ArticleParser } from './parsers/ArticleParser';
import { ArticlePdfGenerator, type ArticleExportSettings } from './generators/ArticlePdfGenerator';
import { Html2PdfRenderer } from '@/src/renderers/pdf/Html2PdfRenderer';
import { ImageLoader } from '@/src/infrastructure/image/ImageLoader';
import { ErrorHandler } from '@/src/infrastructure/error/ErrorHandler';

/**
 * Результат экспорта статьи
 */
export interface ArticleExportResult {
  blob: Blob;
  filename: string;
  size: number;
}

/**
 * Сервис экспорта одной статьи в PDF
 */
export class ArticlePdfExportService {
  private parser: ArticleParser;
  private generator: ArticlePdfGenerator;
  private renderer: Html2PdfRenderer;
  private imageLoader: ImageLoader;
  private errorHandler: ErrorHandler;

  constructor() {
    this.parser = new ArticleParser();
    this.renderer = new Html2PdfRenderer();
    this.errorHandler = new ErrorHandler();
    this.imageLoader = new ImageLoader({}, this.errorHandler);
  }

  /**
   * Экспортирует статью в PDF
   */
  async export(
    travel: Travel,
    settings: ArticleExportSettings,
    onProgress?: (progress: number, message: string) => void
  ): Promise<ArticleExportResult> {
    if (Platform.OS !== 'web') {
      throw this.errorHandler.handle(
        new Error('PDF export is only available on web'),
        { platform: Platform.OS }
      );
    }

    try {
      // Этап 1: Парсинг
      onProgress?.(10, 'Обработка данных...');
      const model = this.parser.parse(travel);

      // Этап 2: Генерация HTML
      onProgress?.(30, 'Генерация содержимого...');
      this.generator = new ArticlePdfGenerator(settings.theme);
      const html = this.generator.generate(model, settings);

      // Этап 3: Создание контейнера
      onProgress?.(50, 'Подготовка к рендерингу...');
      const container = this.createContainer(html);

      // Этап 4: Загрузка изображений
      onProgress?.(60, 'Загрузка изображений...');
      await this.imageLoader.loadImagesFromContainer(
        container,
        (loaded, total) => {
          const progress = 60 + Math.round((loaded / total) * 30);
          onProgress?.(progress, `Загружено ${loaded} из ${total} изображений`);
        }
      );

      // Этап 5: Рендеринг PDF
      onProgress?.(90, 'Создание PDF...');
      const renderOptions = this.buildRenderOptions(settings);
      const blob = await this.renderer.render(container, renderOptions);

      // Очистка
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }

      onProgress?.(100, 'Готово!');

      // Генерируем имя файла
      const safeTitle = (travel.name || 'travel')
        .replace(/[^a-zа-яё0-9]/gi, '_')
        .toLowerCase();
      const filename = `${safeTitle}_${new Date().toISOString().split('T')[0]}.pdf`;

      return {
        blob,
        filename,
        size: blob.size,
      };
    } catch (error) {
      const exportError = this.errorHandler.handle(error);
      throw exportError;
    }
  }

  /**
   * Создает DOM контейнер из HTML
   */
  private createContainer(html: string): HTMLElement {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const bodyContent = doc.body.innerHTML;
    const headStyles = doc.head.querySelectorAll('style');

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '210mm';
    container.style.minHeight = '297mm';
    container.style.backgroundColor = '#fff';
    container.style.overflow = 'visible';
    container.style.opacity = '1';
    container.style.visibility = 'visible';
    container.style.zIndex = '1';
    container.style.pointerEvents = 'none';
    container.style.height = 'auto';

    container.innerHTML = bodyContent;

    // Переносим стили
    if (headStyles.length > 0) {
      const styleElement = document.createElement('style');
      styleElement.textContent = Array.from(headStyles)
        .map((style) => style.textContent || '')
        .join('\n');
      container.insertBefore(styleElement, container.firstChild);
    }

    document.body.appendChild(container);

    // Принудительный reflow
    void container.offsetHeight;

    return container;
  }

  /**
   * Строит опции для рендеринга PDF
   */
  private buildRenderOptions(settings: ArticleExportSettings) {
    return {
      margin: [10, 10, 14, 10],
      image: {
        type: 'jpeg' as const,
        quality: 0.9,
      },
      html2canvas: {
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      },
      jsPDF: {
        unit: 'mm' as const,
        format: settings.format.toLowerCase(),
        orientation: 'portrait' as const,
      },
    };
  }
}

