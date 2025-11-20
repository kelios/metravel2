// src/services/pdf-export/constructor/ArticleConstructorService.ts
// ✅ АРХИТЕКТУРА: Основной сервис конструктора статей

import type { PdfDocument, PdfExportResult, PdfExportConfig } from '@/src/types/pdf-constructor';
import type { Travel } from '@/src/types/types';
import { PdfDocumentBuilder } from './PdfDocumentBuilder';
import { PageImageRenderer } from './renderers/PageImageRenderer';
import { PdfAssembler } from './PdfAssembler';
import { ArticleImporter } from './importers/ArticleImporter';
import { themeManager } from './themes/ThemeManager';

/**
 * Основной сервис конструктора статей
 */
export class ArticleConstructorService {
  private builder: PdfDocumentBuilder;
  private renderer: PageImageRenderer;
  private assembler: PdfAssembler;
  private importer: ArticleImporter;

  constructor() {
    this.builder = new PdfDocumentBuilder('', 'A4', 'portrait');
    this.renderer = new PageImageRenderer();
    this.assembler = new PdfAssembler();
    this.importer = new ArticleImporter();
  }

  /**
   * Создает новый документ
   */
  createDocument(title: string, format: 'A4' | 'A5' | 'A6' | 'Letter' = 'A4'): PdfDocument {
    this.builder = new PdfDocumentBuilder(title, format, 'portrait');
    return this.builder.getDocument();
  }

  /**
   * Импортирует статью в конструктор
   */
  importArticle(travel: Travel, themeId: string = 'light'): PdfDocument {
    const theme = themeManager.getTheme(themeId) || themeManager.getDefaultTheme();
    const document = this.importer.import(travel, theme);
    this.builder.loadDocument(document);
    return this.builder.getDocument();
  }

  /**
   * Получает текущий документ
   */
  getDocument(): PdfDocument {
    return this.builder.getDocument();
  }

  /**
   * Обновляет документ
   */
  updateDocument(updates: Partial<PdfDocument>): void {
    const current = this.builder.getDocument();
    this.builder.loadDocument({ ...current, ...updates });
  }

  /**
   * Экспортирует документ в PDF
   */
  async exportToPdf(
    config: Partial<PdfExportConfig> = {},
    onProgress?: (progress: number, message: string) => void
  ): Promise<PdfExportResult> {
    const document = this.builder.getDocument();
    const exportConfig: PdfExportConfig = {
      dpi: config.dpi || 300,
      imageFormat: config.imageFormat || 'png',
      imageQuality: config.imageQuality || 0.95,
      optimizeImages: config.optimimizeImages ?? true,
      compressPdf: config.compressPdf ?? true,
    };

    // Обновляем конфигурацию рендерера и сборщика
    this.renderer = new PageImageRenderer(exportConfig);
    this.assembler = new PdfAssembler(exportConfig);

    onProgress?.(0, 'Начало экспорта...');

    // Рендерим каждую страницу
    const renderedPages = [];
    const totalPages = document.pages.length;

    for (let i = 0; i < document.pages.length; i++) {
      const page = document.pages[i];
      const progress = Math.round((i / totalPages) * 80);
      onProgress?.(progress, `Рендеринг страницы ${i + 1} из ${totalPages}...`);

      try {
        const rendered = await this.renderer.renderPage(page, document.theme);
        renderedPages.push(rendered);
      } catch (error) {
        console.error(`Failed to render page ${i + 1}:`, error);
        throw new Error(`Ошибка при рендеринге страницы ${i + 1}: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
      }
    }

    onProgress?.(90, 'Сборка PDF...');

    // Собираем PDF
    const safeTitle = document.title.replace(/[^a-zа-яё0-9]/gi, '_').toLowerCase();
    const filename = `${safeTitle}_${new Date().toISOString().split('T')[0]}`;

    let result: PdfExportResult;
    // Используем только pdf-lib (jsPDF отключен из-за проблем с html2canvas в Metro)
    try {
      result = await this.assembler.assemblePdfWithPdfLib(renderedPages, filename);
    } catch (error) {
      throw new Error(`Ошибка сборки PDF: ${error instanceof Error ? error.message : String(error)}`);
    }

    onProgress?.(100, 'Готово!');

    return result;
  }

  /**
   * Предпросмотр страницы (рендерит одну страницу)
   */
  async previewPage(pageId: string): Promise<string> {
    const document = this.builder.getDocument();
    const page = document.pages.find((p) => p.id === pageId);
    
    if (!page) {
      throw new Error('Page not found');
    }

    const rendered = await this.renderer.renderPage(page, document.theme);
    return rendered.imageData;
  }

  /**
   * Сохраняет документ в localStorage
   */
  saveDocument(key: string = 'pdf-constructor-draft'): void {
    const document = this.builder.getDocument();
    try {
      localStorage.setItem(key, JSON.stringify(document));
    } catch (error) {
      console.error('Failed to save document:', error);
      throw new Error('Не удалось сохранить документ');
    }
  }

  /**
   * Загружает документ из localStorage
   */
  loadDocument(key: string = 'pdf-constructor-draft'): PdfDocument | null {
    try {
      const data = localStorage.getItem(key);
      if (!data) return null;

      const document = JSON.parse(data) as PdfDocument;
      this.builder.loadDocument(document);
      return document;
    } catch (error) {
      console.error('Failed to load document:', error);
      return null;
    }
  }
}

