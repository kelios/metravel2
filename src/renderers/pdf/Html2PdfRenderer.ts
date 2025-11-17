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

    const html2pdf = window.html2pdf!;
    const renderOptions = this.buildRenderOptions(options);

    const worker = html2pdf().set(renderOptions).from(element);
    const blob: Blob = await worker.outputPdf('blob');

    // Очищаем временный элемент, если создавали
    if (typeof html === 'string' && element.parentNode) {
      element.parentNode.removeChild(element);
    }

    return blob;
  }

  async preview(html: string | HTMLElement, options: PdfRenderOptions): Promise<string> {
    const blob = await this.render(html, options);
    return URL.createObjectURL(blob);
  }

  /**
   * Создает DOM элемент из HTML строки
   */
  private createElementFromHTML(html: string): HTMLElement {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
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
   */
  private buildRenderOptions(options: PdfRenderOptions): any {
    return {
      filename: 'metravel-book.pdf',
      margin: options.margin ?? [10, 10, 14, 10],
      image: {
        type: options.image?.type || 'jpeg',
        quality: options.image?.quality ?? 0.92,
      },
      html2canvas: {
        useCORS: options.html2canvas?.useCORS ?? true,
        allowTaint: options.html2canvas?.allowTaint ?? false,
        backgroundColor: options.html2canvas?.backgroundColor ?? '#ffffff',
        scale: options.html2canvas?.scale ?? 2,
        width: options.html2canvas?.width,
        height: options.html2canvas?.height,
        windowWidth: options.html2canvas?.windowWidth,
        windowHeight: options.html2canvas?.windowHeight,
        x: options.html2canvas?.x ?? 0,
        y: options.html2canvas?.y ?? 0,
        scrollX: options.html2canvas?.scrollX ?? 0,
        scrollY: options.html2canvas?.scrollY ?? 0,
        logging: options.html2canvas?.logging ?? false,
        removeContainer: options.html2canvas?.removeContainer ?? false,
      },
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
    if (typeof window === 'undefined') {
      throw new Error('Window is not available');
    }

    if (window.html2pdf) {
      return;
    }

    if (!this.loadingPromise) {
      this.loadingPromise = new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = CDN_SRC;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = (e) => reject(new Error('html2pdf bundle load failed'));
        document.head.appendChild(script);
      });
    }

    await this.loadingPromise;
  }
}

