// src/services/pdf-export/PdfExportService.ts
// ✅ АРХИТЕКТУРА: Основной сервис для экспорта в PDF

import { Platform } from 'react-native';
import type { Travel } from '@/src/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import { buildPhotoBookHTML } from '@/src/utils/pdfBookGenerator';
import { TravelDataTransformer } from './TravelDataTransformer';
import { ImageLoader } from '@/src/infrastructure/image/ImageLoader';
import { ErrorHandler } from '@/src/infrastructure/error/ErrorHandler';
import { ProgressTracker } from '@/src/infrastructure/progress/ProgressTracker';
import { IPdfRenderer } from '@/src/renderers/pdf/IPdfRenderer';
import {
  ExportResult,
  PreviewResult,
  ExportProgress,
  ExportStage,
  ExportConfig,
  ProgressCallback,
  PdfRenderOptions,
} from '@/src/types/pdf-export';

/**
 * Основной сервис для экспорта в PDF
 * Оркестрирует весь процесс экспорта
 */
export class PdfExportService {
  private dataTransformer: TravelDataTransformer;
  private imageLoader: ImageLoader;
  private errorHandler: ErrorHandler;
  private progressTracker: ProgressTracker;

  constructor(
    private renderer: IPdfRenderer,
    private config: ExportConfig = {}
  ) {
    this.dataTransformer = new TravelDataTransformer();
    this.errorHandler = new ErrorHandler();
    this.progressTracker = new ProgressTracker();
    this.imageLoader = new ImageLoader(config, this.errorHandler);
  }

  /**
   * Экспортирует путешествия в PDF
   */
  async export(
    travels: Travel[],
    settings: BookSettings,
    progressCallback?: ProgressCallback
  ): Promise<ExportResult> {
    if (Platform.OS !== 'web') {
      throw this.errorHandler.handle(
        new Error('PDF export is only available on web'),
        { platform: Platform.OS }
      );
    }

    // Подписываемся на прогресс
    const unsubscribe = progressCallback
      ? this.progressTracker.subscribe(progressCallback)
      : null;

    try {
      // Инициализируем рендерер
      await this.renderer.initialize();

      // Этап 1: Валидация
      this.progressTracker.setStage(ExportStage.VALIDATING, 0, 'Проверка данных...');
      this.dataTransformer.validate(travels);

      // Этап 2: Трансформация
      this.progressTracker.setStage(ExportStage.TRANSFORMING, 50, 'Преобразование данных...');
      const travelsForBook = this.dataTransformer.transform(travels);

      // Этап 3: Генерация HTML
      this.progressTracker.setStage(ExportStage.GENERATING_HTML, 0, 'Генерация содержимого...');
      const html = await buildPhotoBookHTML(travelsForBook, settings);
      this.progressTracker.setStage(ExportStage.GENERATING_HTML, 100);

      // Этап 4: Загрузка изображений
      this.progressTracker.setStage(ExportStage.LOADING_IMAGES, 0, 'Загрузка изображений...');
      const container = this.createContainer(html);
      await this.imageLoader.loadImagesFromContainer(
        container,
        (loaded, total) => {
          const progress = Math.round((loaded / total) * 100);
          this.progressTracker.setStage(
            ExportStage.LOADING_IMAGES,
            progress,
            `Загружено ${loaded} из ${total} изображений`
          );
        }
      );
      this.progressTracker.setStage(ExportStage.LOADING_IMAGES, 100);

      // Этап 5: Рендеринг PDF
      this.progressTracker.setStage(ExportStage.RENDERING, 0, 'Создание PDF...');
      const renderOptions = this.buildRenderOptions(settings);
      const blob = await this.renderer.render(container, renderOptions);
      this.progressTracker.setStage(ExportStage.RENDERING, 100);

      // Очистка
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }

      // Завершение
      this.progressTracker.setStage(ExportStage.COMPLETE, 100, 'Готово!');
      
      // ✅ ИСПРАВЛЕНИЕ: Проверяем что title существует перед использованием toString/replace
      const title = settings.title || 'Мои_путешествия';
      const safeTitle = typeof title === 'string' ? title : String(title || 'Мои_путешествия');
      const filename = `${safeTitle.replace(/[^a-zа-яё0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

      return {
        blob,
        filename,
        size: blob.size,
      };
    } catch (error) {
      const currentProgress = this.progressTracker.getCurrentProgress();
      console.error('[PdfExportService] export failed', {
        stage: currentProgress.stage,
        progress: currentProgress.progress,
        message: currentProgress.message,
        error,
      });
      const exportError = this.errorHandler.handle(error);
      this.progressTracker.setStage(ExportStage.ERROR, 0, exportError.message);
      throw exportError;
    } finally {
      if (unsubscribe) {
        unsubscribe();
      }
      this.progressTracker.reset();
    }
  }

  /**
   * Создает превью PDF
   */
  async preview(
    travels: Travel[],
    settings: BookSettings,
    progressCallback?: ProgressCallback
  ): Promise<PreviewResult> {
    if (Platform.OS !== 'web') {
      throw this.errorHandler.handle(
        new Error('PDF preview is only available on web'),
        { platform: Platform.OS }
      );
    }

    const unsubscribe = progressCallback
      ? this.progressTracker.subscribe(progressCallback)
      : null;

    try {
      await this.renderer.initialize();

      this.progressTracker.setStage(ExportStage.VALIDATING, 0, 'Проверка данных...');
      this.dataTransformer.validate(travels);

      this.progressTracker.setStage(ExportStage.TRANSFORMING, 50, 'Преобразование данных...');
      const travelsForBook = this.dataTransformer.transform(travels);

      this.progressTracker.setStage(ExportStage.GENERATING_HTML, 0, 'Генерация содержимого...');
      const html = await buildPhotoBookHTML(travelsForBook, settings);
      this.progressTracker.setStage(ExportStage.GENERATING_HTML, 100);

      this.progressTracker.setStage(ExportStage.LOADING_IMAGES, 0, 'Загрузка изображений...');
      const container = this.createContainer(html);
      await this.imageLoader.loadImagesFromContainer(
        container,
        (loaded, total) => {
          const progress = Math.round((loaded / total) * 100);
          this.progressTracker.setStage(
            ExportStage.LOADING_IMAGES,
            progress,
            `Загружено ${loaded} из ${total} изображений`
          );
        }
      );
      this.progressTracker.setStage(ExportStage.LOADING_IMAGES, 100);

      this.progressTracker.setStage(ExportStage.RENDERING, 0, 'Создание превью...');
      const renderOptions = this.buildRenderOptions(settings);
      const blobUrl = await this.renderer.preview(container, renderOptions);
      this.progressTracker.setStage(ExportStage.RENDERING, 100);

      // Не удаляем контейнер сразу - он нужен для превью
      // Будет удален при закрытии превью

      this.progressTracker.setStage(ExportStage.COMPLETE, 100, 'Готово!');

      // Получаем размер blob из URL
      const response = await fetch(blobUrl);
      const blob = await response.blob();

      return {
        blobUrl,
        size: blob.size,
      };
    } catch (error) {
      const currentProgress = this.progressTracker.getCurrentProgress();
      console.error('[PdfExportService] preview failed', {
        stage: currentProgress.stage,
        progress: currentProgress.progress,
        message: currentProgress.message,
        error,
      });
      const exportError = this.errorHandler.handle(error);
      this.progressTracker.setStage(ExportStage.ERROR, 0, exportError.message);
      throw exportError;
    } finally {
      if (unsubscribe) {
        unsubscribe();
      }
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
    container.style.position = 'absolute';
    container.style.left = '0';
    container.style.top = '0';
    container.style.width = '210mm';
    container.style.minHeight = '297mm';
    container.style.backgroundColor = '#fff';
    container.style.overflow = 'visible';
    container.style.opacity = '1';
    container.style.zIndex = '-1';
    container.style.pointerEvents = 'none';

    // Вставляем содержимое
    container.innerHTML = bodyContent;

    // Переносим стили из head, гарантируя что они остаются внутри контейнера
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
   * Строит опции рендеринга из настроек
   */
  /**
   * Строит опции для рендеринга PDF
   * ✅ ИСПРАВЛЕНИЕ: Добавлена валидация всех опций для предотвращения ошибок toString
   */
  private buildRenderOptions(settings: BookSettings): PdfRenderOptions {
    return {
      margin: settings.margins === 'narrow' 
        ? [5, 5, 7, 5] 
        : settings.margins === 'wide' 
        ? [15, 15, 20, 15] 
        : [10, 10, 14, 10],
      image: {
        type: 'jpeg',
        quality: settings.imageQuality === 'high' 
          ? 0.95 
          : settings.imageQuality === 'medium' 
          ? 0.85 
          : 0.75,
      },
      html2canvas: {
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      },
      jsPDF: {
        unit: 'mm',
        // ✅ ИСПРАВЛЕНИЕ: Проверяем что format и orientation это строки перед вызовом toLowerCase
        format: typeof settings.format === 'string' 
          ? settings.format.toLowerCase() 
          : 'a4',
        orientation: (typeof settings.orientation === 'string'
          ? settings.orientation.toLowerCase()
          : 'portrait') as 'portrait' | 'landscape',
      },
    };
  }

  /**
   * Подписывается на прогресс
   */
  subscribeToProgress(callback: ProgressCallback): () => void {
    return this.progressTracker.subscribe(callback);
  }
}

