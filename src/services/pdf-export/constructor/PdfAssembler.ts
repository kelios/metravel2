// src/services/pdf-export/constructor/PdfAssembler.ts
// ✅ АРХИТЕКТУРА: Сборщик PDF из изображений

import type { RenderedPage, PdfExportResult, PdfExportConfig } from '@/src/types/pdf-constructor';

/**
 * Сборщик PDF из изображений
 * Использует jsPDF для создания PDF из отрендеренных страниц
 */
export class PdfAssembler {
  private config: PdfExportConfig;

  constructor(config: Partial<PdfExportConfig> = {}) {
    this.config = {
      dpi: config.dpi || 300,
      imageFormat: config.imageFormat || 'png',
      imageQuality: config.imageQuality || 0.95,
      optimizeImages: config.optimizeImages ?? true,
      compressPdf: config.compressPdf ?? true,
    };
  }

  /**
   * Собирает PDF из отрендеренных страниц
   * ВАЖНО: Этот метод временно отключен из-за проблем с html2canvas в Metro bundler
   * Используйте assemblePdfWithPdfLib вместо этого
   */
  async assemblePdf(
    renderedPages: RenderedPage[],
    filename: string
  ): Promise<PdfExportResult> {
    // jsPDF требует html2canvas, который не работает в Metro bundler
    // Используем pdf-lib вместо этого
    throw new Error('jsPDF временно отключен из-за проблем с html2canvas. Используйте assemblePdfWithPdfLib.');
  }

  /**
   * Альтернативный метод сборки через pdf-lib (если нужна большая гибкость)
   * Требует установки: npm install pdf-lib
   */
  async assemblePdfWithPdfLib(
    renderedPages: RenderedPage[],
    filename: string
  ): Promise<PdfExportResult> {
    // Динамически импортируем pdf-lib (опционально)
    let PDFDocument: any;
    try {
      const pdfLib = await import('pdf-lib');
      PDFDocument = pdfLib.PDFDocument;
    } catch (error) {
      throw new Error('pdf-lib не установлен. Установите: npm install pdf-lib');
    }
    
    const sortedPages = [...renderedPages].sort((a, b) => a.pageNumber - b.pageNumber);

    if (sortedPages.length === 0) {
      throw new Error('No pages to assemble');
    }

    // Создаем новый PDF документ
    const pdfDoc = await PDFDocument.create();

    // Добавляем каждую страницу
    for (const page of sortedPages) {
      // Конвертируем base64 в Uint8Array
      const base64Data = page.imageData.split(',')[1];
      const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

      // Определяем тип изображения
      let imageType: 'png' | 'jpg' = 'png';
      if (page.imageData.startsWith('data:image/jpeg') || page.imageData.startsWith('data:image/webp')) {
        imageType = 'jpg';
      }

      // Встраиваем изображение
      const image = imageType === 'png' 
        ? await pdfDoc.embedPng(imageBytes)
        : await pdfDoc.embedJpg(imageBytes);

      // Получаем размеры страницы
      const mmPerPixel = 25.4 / this.config.dpi;
      const pageWidth = page.width * mmPerPixel;
      const pageHeight = page.height * mmPerPixel;

      // Создаем страницу с размерами изображения
      const pdfPage = pdfDoc.addPage([pageWidth, pageHeight]);

      // Добавляем изображение на страницу
      pdfPage.drawImage(image, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      });
    }

    // Сохраняем PDF
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });

    return {
      blob,
      filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
      size: blob.size,
      pagesCount: sortedPages.length,
      renderedPages: sortedPages,
    };
  }
}
