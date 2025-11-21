// src/services/pdf-export/PdfExportService.ts
// ✅ АРХИТЕКТУРА: Основной сервис для экспорта в PDF

import { Platform } from 'react-native';
import type { Travel } from '@/src/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import type { TravelForBook } from '@/src/types/pdf-export';
import { buildPhotoBookHTML } from '@/src/utils/pdfBookGenerator';
import { EnhancedPdfGenerator } from './generators/EnhancedPdfGenerator';
import { getThemeConfig } from './themes/PdfThemeConfig';
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

const MODERN_TEMPLATES: ReadonlySet<BookSettings['template']> = new Set([
  'minimal',
  'light',
  'dark',
  'travel-magazine',
]);

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
      
      // ✅ НОВОЕ: Используем пользовательский макет, если он указан
      let html: string;
      if (settings.layout) {
        const { LayoutHtmlGenerator } = await import('./generators/LayoutHtmlGenerator');
        const layoutGenerator = new LayoutHtmlGenerator();
        html = await layoutGenerator.generate(settings.layout, travelsForBook, settings);
      } else {
        // Используем новый генератор для новых тем, старый для legacy
        const isNewTheme = MODERN_TEMPLATES.has(settings.template);
        html = isNewTheme
          ? await this.generateWithNewGenerator(travelsForBook, settings)
          : await buildPhotoBookHTML(travelsForBook, settings);
      }
      
      // ✅ КРИТИЧНО: Проверяем что HTML не пустой
      if (!html || html.trim().length === 0) {
        throw this.errorHandler.handle(
          new Error('Сгенерированный HTML пуст'),
          { travelsCount: travelsForBook.length, settings }
        );
      }
      
      this.progressTracker.setStage(ExportStage.GENERATING_HTML, 100);

      // Этап 4: Загрузка изображений
      this.progressTracker.setStage(ExportStage.LOADING_IMAGES, 0, 'Загрузка изображений...');
      const container = this.createContainer(html);
      
      // ✅ КРИТИЧНО: Проверяем что контейнер содержит контент
      const pages = container.querySelectorAll('.pdf-page');
      if (pages.length === 0) {
        throw this.errorHandler.handle(
          new Error('Контейнер не содержит страниц для PDF'),
          { containerHTML: container.innerHTML.substring(0, 500) }
        );
      }
      
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

      // ✅ КРИТИЧНО: Дополнительная проверка перед рендерингом
      // Убеждаемся что контейнер видим для html2canvas
      void container.offsetHeight; // Принудительный reflow

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
      
      // ✅ НОВОЕ: Используем пользовательский макет, если он указан
      let html: string;
      if (settings.layout) {
        const { LayoutHtmlGenerator } = await import('./generators/LayoutHtmlGenerator');
        const layoutGenerator = new LayoutHtmlGenerator();
        html = await layoutGenerator.generate(settings.layout, travelsForBook, settings);
      } else {
        // Используем новый генератор для новых тем, старый для legacy
        const isNewTheme = MODERN_TEMPLATES.has(settings.template);
        html = isNewTheme
          ? await this.generateWithNewGenerator(travelsForBook, settings)
          : await buildPhotoBookHTML(travelsForBook, settings);
      }
      
      // ✅ КРИТИЧНО: Проверяем что HTML не пустой
      if (!html || html.trim().length === 0) {
        throw this.errorHandler.handle(
          new Error('Сгенерированный HTML пуст'),
          { travelsCount: travelsForBook.length, settings }
        );
      }
      
      this.progressTracker.setStage(ExportStage.GENERATING_HTML, 100);

      this.progressTracker.setStage(ExportStage.LOADING_IMAGES, 0, 'Загрузка изображений...');
      const container = this.createContainer(html);
      
      // ✅ КРИТИЧНО: Проверяем что контейнер содержит контент
      const pages = container.querySelectorAll('.pdf-page');
      if (pages.length === 0) {
        throw this.errorHandler.handle(
          new Error('Контейнер не содержит страниц для PDF'),
          { containerHTML: container.innerHTML.substring(0, 500) }
        );
      }
      
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

      // ✅ КРИТИЧНО: Дополнительная проверка перед рендерингом
      // Убеждаемся что контейнер видим для html2canvas
      void container.offsetHeight; // Принудительный reflow

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
   * ✅ ИСПРАВЛЕНИЕ: Используем left: -9999px вместо zIndex: -1 для видимости html2canvas
   */
  private createContainer(html: string): HTMLElement {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const bodyContent = doc.body.innerHTML;
    const headStyles = doc.head.querySelectorAll('style');

    const container = document.createElement('div');
    // ✅ КРИТИЧНО: Используем position: fixed с left: -9999px вместо zIndex: -1
    // Это позволяет html2canvas видеть контент, но не мешает пользователю
    // ВАЖНО: html2canvas может работать с элементами вне видимой области, но нужно убедиться что размеры правильные
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '210mm';
    container.style.minHeight = '297mm';
    container.style.backgroundColor = '#fff';
    container.style.overflow = 'visible';
    container.style.opacity = '1';
    container.style.visibility = 'visible';
    container.style.zIndex = '1'; // Положительный z-index для html2canvas
    container.style.pointerEvents = 'none';
    // ✅ КРИТИЧНО: Убеждаемся что контейнер имеет правильные размеры для html2canvas
    container.style.height = 'auto'; // Автоматическая высота для контента

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

    // ✅ КРИТИЧНО: Принудительный reflow для применения стилей и расчета размеров
    void container.offsetHeight;
    
    // ✅ КРИТИЧНО: Если высота 0, но есть scrollHeight, устанавливаем явную высоту
    const initialHeight = container.offsetHeight;
    const scrollHeight = container.scrollHeight;
    if (initialHeight === 0 && scrollHeight > 0) {
      container.style.height = `${scrollHeight}px`;
      void container.offsetHeight;
    }

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
    // ✅ ИСПРАВЛЕНИЕ: Безопасная проверка margins с fallback
    const margins = settings.margins || 'standard';
    return {
      margin: margins === 'narrow' 
        ? [5, 5, 7, 5] 
        : margins === 'wide' 
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

  /**
   * Генерирует HTML с новым генератором
   */
  private async generateWithNewGenerator(
    travels: TravelForBook[],
    settings: BookSettings
  ): Promise<string> {
    const generator = new EnhancedPdfGenerator(settings.template);
    return await generator.generate(travels, settings);
  }
}
