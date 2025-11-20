// src/renderers/pdf/Html2PdfRenderer.ts
// ✅ АРХИТЕКТУРА: Реализация PDF рендерера через html2pdf.js

import { IPdfRenderer } from './IPdfRenderer';
import { PdfRenderOptions } from '@/src/types/pdf-export';

type Html2Pdf = (input: Element | string) => any;

declare global {
  interface Window {
    html2pdf?: Html2Pdf & { (): any };
  }
}

const CDN_SRC = 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js';

/**
 * Реализация PDF рендерера через html2pdf.js
 */
export class Html2PdfRenderer implements IPdfRenderer {
  private loadingPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    await this.ensureBundleLoaded();
  }

  isAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.html2pdf;
  }

  async render(html: string | HTMLElement, options: PdfRenderOptions): Promise<Blob> {
    await this.ensureBundleLoaded();
    
    if (!this.isAvailable()) {
      throw new Error('html2pdf is not available');
    }

    const element = typeof html === 'string' 
      ? this.createElementFromHTML(html)
      : html;

    const el = element as HTMLElement;
    const html2pdf = window.html2pdf!;
    const renderOptions = this.buildRenderOptions(options);
    
    // ✅ КРИТИЧНО: Если элемент имеет размеры, но они не указаны в опциях, добавляем их явно
    if (el.offsetWidth > 0 && el.offsetHeight > 0) {
      if (!renderOptions.html2canvas.width && !renderOptions.html2canvas.height) {
        renderOptions.html2canvas.width = el.offsetWidth;
        renderOptions.html2canvas.height = el.scrollHeight || el.offsetHeight;
        renderOptions.html2canvas.windowWidth = el.offsetWidth;
        renderOptions.html2canvas.windowHeight = el.scrollHeight || el.offsetHeight;
      }
    }
    
    // ✅ КРИТИЧНО: Проверяем что изображения загружены перед рендерингом
    const images = el.querySelectorAll('img');
    const imagePromises = Array.from(images).map((img: HTMLImageElement) => {
      if (img.complete) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          resolve(); // Продолжаем даже если изображение не загрузилось
        }, 10000);
        
        img.onload = () => {
          clearTimeout(timeout);
          resolve();
        };
        img.onerror = () => {
          clearTimeout(timeout);
          resolve(); // Продолжаем даже при ошибке
        };
      });
    });
    
    await Promise.all(imagePromises);
    
    // ✅ КРИТИЧНО: Дополнительная задержка для полного рендеринга
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // ✅ КРИТИЧНО: Временно перемещаем контейнер в видимую область для html2canvas
    const originalLeft = (el as HTMLElement).style.left;
    const originalTop = (el as HTMLElement).style.top;
    const originalPosition = (el as HTMLElement).style.position;
    
    (el as HTMLElement).style.position = 'fixed';
    (el as HTMLElement).style.left = '0';
    (el as HTMLElement).style.top = '0';
    (el as HTMLElement).style.zIndex = '999999';
    
    // Принудительный reflow после перемещения
    void (el as HTMLElement).offsetHeight;
    
    try {
      const worker = html2pdf().set(renderOptions).from(element);
      const blob: Blob = await worker.outputPdf('blob');
      
      // ✅ КРИТИЧНО: Возвращаем контейнер на место после рендеринга
      (el as HTMLElement).style.left = originalLeft;
      (el as HTMLElement).style.top = originalTop;
      (el as HTMLElement).style.position = originalPosition;

      // Очищаем временный элемент, если создавали
      if (typeof html === 'string' && element.parentNode) {
        element.parentNode.removeChild(element);
      }

      return blob;
    } catch (error) {
      // Возвращаем контейнер на место даже при ошибке
      (el as HTMLElement).style.left = originalLeft;
      (el as HTMLElement).style.top = originalTop;
      (el as HTMLElement).style.position = originalPosition;
      throw error;
    }
  }

  async preview(html: string | HTMLElement, options: PdfRenderOptions): Promise<string> {
    const blob = await this.render(html, options);
    return URL.createObjectURL(blob);
  }

  /**
   * Удаляет React Native компоненты из HTML строки
   * ✅ КРИТИЧНО: Дополнительная защита на уровне рендерера
   */
  private removeReactNativeComponents(html: string): string {
    let cleaned = html;
    let previousLength = 0;
    let iterations = 0;
    const maxIterations = 10;
    
    while (iterations < maxIterations) {
      const currentLength = cleaned.length;
      if (currentLength === previousLength) break;
      previousLength = currentLength;
      
      cleaned = cleaned
        .replace(/<View[^>]*>/gi, '')
        .replace(/<\/View>/gi, '')
        .replace(/<Text[^>]*>/gi, '')
        .replace(/<\/Text>/gi, '')
        .replace(/<ScrollView[^>]*>.*?<\/ScrollView>/gis, '')
        .replace(/<Image[^>]*\/?>/gi, '')
        .replace(/<TouchableOpacity[^>]*>.*?<\/TouchableOpacity>/gis, '')
        .replace(/<TouchableHighlight[^>]*>.*?<\/TouchableHighlight>/gis, '')
        .replace(/<SafeAreaView[^>]*>.*?<\/SafeAreaView>/gis, '')
        .replace(/<ActivityIndicator[^>]*\/?>/gi, '');
      
      iterations++;
    }
    
    return cleaned;
  }

  /**
   * Создает DOM элемент из HTML строки
   * ✅ КРИТИЧНО: Удаляем React Native компоненты перед парсингом
   */
  private createElementFromHTML(html: string): HTMLElement {
    // ✅ КРИТИЧНО: Удаляем React Native компоненты перед парсингом
    const cleanedHtml = this.removeReactNativeComponents(html);
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleanedHtml, 'text/html');
    
    // ✅ КРИТИЧНО: Проверяем наличие React Native компонентов после парсинга и удаляем при необходимости
    const bodyHTML = doc.body.innerHTML;
    const hasReactComponents = /<View|<Text|<ScrollView|<Image[^>]*>|<TouchableOpacity|<TouchableHighlight|<SafeAreaView|<ActivityIndicator/i.test(bodyHTML);
    if (hasReactComponents) {
      doc.body.innerHTML = this.removeReactNativeComponents(bodyHTML);
    }
    
    // Создаем контейнер
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.width = '210mm';
    container.style.minHeight = '297mm';
    container.style.backgroundColor = '#fff';
    
    // Копируем содержимое body
    container.innerHTML = doc.body.innerHTML;

    // Переносим стили и гарантируем что они не удаляются при присвоении innerHTML
    const headStyles = doc.head?.querySelectorAll('style');
    if (headStyles && headStyles.length > 0) {
      const styleElement = document.createElement('style');
      styleElement.textContent = Array.from(headStyles)
        .map((style) => style.textContent || '')
        .join('\n');

      container.insertBefore(styleElement, container.firstChild);
    }
    
    document.body.appendChild(container);
    
    return container;
  }

  /**
   * Строит опции для html2pdf из наших опций
   * ✅ ИСПРАВЛЕНИЕ: Фильтруем undefined значения, чтобы избежать ошибок toString
   */
  private buildRenderOptions(options: PdfRenderOptions): any {
    // Строим html2canvas опции, исключая undefined значения
    const html2canvasOptions: any = {
      useCORS: options.html2canvas?.useCORS ?? true,
      allowTaint: options.html2canvas?.allowTaint ?? false,
      backgroundColor: options.html2canvas?.backgroundColor ?? '#ffffff',
      scale: options.html2canvas?.scale ?? 2,
      x: options.html2canvas?.x ?? 0,
      y: options.html2canvas?.y ?? 0,
      scrollX: options.html2canvas?.scrollX ?? 0,
      scrollY: options.html2canvas?.scrollY ?? 0,
      logging: options.html2canvas?.logging ?? false,
      removeContainer: options.html2canvas?.removeContainer ?? false,
      // ✅ КРИТИЧНО: Убеждаемся что html2canvas видит весь контент
      ignoreElements: (element: Element) => {
        // Не игнорируем ничего - рендерим все
        return false;
      },
    };

    // Добавляем опциональные свойства только если они определены
    if (options.html2canvas?.width !== undefined) {
      html2canvasOptions.width = options.html2canvas.width;
    }
    if (options.html2canvas?.height !== undefined) {
      html2canvasOptions.height = options.html2canvas.height;
    }
    if (options.html2canvas?.windowWidth !== undefined) {
      html2canvasOptions.windowWidth = options.html2canvas.windowWidth;
    }
    if (options.html2canvas?.windowHeight !== undefined) {
      html2canvasOptions.windowHeight = options.html2canvas.windowHeight;
    }

    // Валидируем margin - убеждаемся что это массив чисел
    let margin: number[] = [10, 10, 14, 10];
    if (options.margin !== undefined) {
      if (Array.isArray(options.margin)) {
        margin = options.margin.filter((m): m is number => typeof m === 'number' && !isNaN(m));
        if (margin.length === 0) {
          margin = [10, 10, 14, 10];
        }
      } else if (typeof options.margin === 'number' && !isNaN(options.margin)) {
        margin = [options.margin, options.margin, options.margin, options.margin];
      }
    }

    return {
      filename: 'metravel-book.pdf',
      margin,
      image: {
        type: options.image?.type || 'jpeg',
        quality: options.image?.quality ?? 0.92,
      },
      html2canvas: html2canvasOptions,
      jsPDF: {
        unit: options.jsPDF?.unit || 'mm',
        format: typeof options.jsPDF?.format === 'string' 
          ? options.jsPDF.format.toLowerCase() 
          : 'a4', // ✅ ИСПРАВЛЕНИЕ: Убеждаемся что format это строка
        orientation: typeof options.jsPDF?.orientation === 'string'
          ? options.jsPDF.orientation.toLowerCase()
          : 'portrait', // ✅ ИСПРАВЛЕНИЕ: Убеждаемся что orientation это строка
      },
      pagebreak: { mode: ['css', 'legacy'] },
    };
  }

  /**
   * Загружает html2pdf.js библиотеку
   */
  private async ensureBundleLoaded(): Promise<void> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw new Error('Window is not available');
    }

    if (window.html2pdf) {
      return;
    }

    if (!this.loadingPromise) {
      this.loadingPromise = this.loadBundleWithFallback();
    }

    try {
      await this.loadingPromise;
    } finally {
      if (!window.html2pdf) {
        this.loadingPromise = null;
      }
    }

    if (!window.html2pdf) {
      throw new Error('html2pdf is not available');
    }
  }

  private async loadBundleWithFallback(): Promise<void> {
    try {
      await this.loadLocalBundle();
    } catch (localError) {
      await this.loadCdnBundle();
    }

    if (!window.html2pdf) {
      throw new Error('html2pdf failed to initialize');
    }
  }

  private async loadLocalBundle(): Promise<void> {
    const module = await import('html2pdf.js/dist/html2pdf.bundle.min.js');
    const html2pdf =
      (module as { default?: Html2Pdf }).default ||
      ((module as unknown as { html2pdf?: Html2Pdf }).html2pdf) ||
      (module as unknown as Html2Pdf);

    if (typeof html2pdf !== 'function') {
      throw new Error('html2pdf local bundle is invalid');
    }

    window.html2pdf = html2pdf as Html2Pdf & { (): any };
  }

  private loadCdnBundle(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.html2pdf) {
        resolve();
        return;
      }

      const existing = document.querySelector<HTMLScriptElement>('script[data-html2pdf]');
      if (existing) {
        existing.addEventListener('load', () => {
          window.html2pdf ? resolve() : reject(new Error('html2pdf bundle load failed'));
        });
        existing.addEventListener('error', () => reject(new Error('html2pdf bundle load failed')));
        return;
      }

      const script = document.createElement('script');
      script.src = CDN_SRC;
      script.defer = true;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.html2pdf = 'true';
      script.onload = () => {
        if (window.html2pdf) {
          resolve();
        } else {
          reject(new Error('html2pdf not found after CDN load'));
        }
      };
      script.onerror = () => reject(new Error('html2pdf bundle load failed'));
      document.head.appendChild(script);
    });
  }
}

