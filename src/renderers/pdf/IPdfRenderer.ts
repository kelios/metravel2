// src/renderers/pdf/IPdfRenderer.ts
// ✅ АРХИТЕКТУРА: Интерфейс для PDF рендереров

import { PdfRenderOptions, ExportResult, PreviewResult } from '@/src/types/pdf-export';

/**
 * Интерфейс для PDF рендереров
 * Позволяет легко заменить html2pdf.js на другой рендерер
 */
export interface IPdfRenderer {
  /**
   * Рендерит HTML в PDF и возвращает Blob
   */
  render(html: string | HTMLElement, options: PdfRenderOptions): Promise<Blob>;

  /**
   * Создает превью PDF и возвращает URL blob
   */
  preview(html: string | HTMLElement, options: PdfRenderOptions): Promise<string>;

  /**
   * Проверяет, доступен ли рендерер
   */
  isAvailable(): boolean;

  /**
   * Инициализирует рендерер (загружает библиотеки)
   */
  initialize(): Promise<void>;
}

