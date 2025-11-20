// src/services/pdf-export/constructor/PdfDocumentBuilder.ts
// ✅ АРХИТЕКТУРА: Билдер для создания и управления PDF документом

import type { PdfDocument, PdfPage, PdfBlock, BlockType, PageFormat, PageOrientation } from '@/src/types/pdf-constructor';
import { PAGE_FORMATS } from '@/src/types/pdf-constructor';

/**
 * Генерирует уникальный ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Билдер для создания PDF документа
 */
export class PdfDocumentBuilder {
  private document: PdfDocument;

  constructor(title: string, format: PageFormat = 'A4', orientation: PageOrientation = 'portrait') {
    this.document = {
      id: generateId(),
      title,
      pages: [],
      theme: this.getDefaultTheme(),
      format,
      orientation,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };
  }

  /**
   * Добавляет страницу
   */
  addPage(page?: Partial<PdfPage>): PdfPage {
    const newPage: PdfPage = {
      id: page?.id || generateId(),
      pageNumber: this.document.pages.length + 1,
      format: page?.format || this.document.format,
      orientation: page?.orientation || this.document.orientation,
      blocks: page?.blocks || [],
      background: page?.background,
      margins: page?.margins || { top: 20, right: 20, bottom: 20, left: 20 },
    };

    this.document.pages.push(newPage);
    this.updateTimestamp();
    return newPage;
  }

  /**
   * Удаляет страницу
   */
  removePage(pageId: string): boolean {
    const index = this.document.pages.findIndex((p) => p.id === pageId);
    if (index === -1) return false;

    this.document.pages.splice(index, 1);
    this.renumberPages();
    this.updateTimestamp();
    return true;
  }

  /**
   * Дублирует страницу
   */
  duplicatePage(pageId: string): PdfPage | null {
    const page = this.document.pages.find((p) => p.id === pageId);
    if (!page) return null;

    const duplicatedPage: PdfPage = {
      ...page,
      id: generateId(),
      pageNumber: this.document.pages.length + 1,
      blocks: page.blocks.map((block) => ({
        ...block,
        id: generateId(),
      })),
    };

    this.document.pages.push(duplicatedPage);
    this.renumberPages();
    this.updateTimestamp();
    return duplicatedPage;
  }

  /**
   * Добавляет блок на страницу
   */
  addBlock(pageId: string, block: Omit<PdfBlock, 'id'>): PdfBlock | null {
    const page = this.document.pages.find((p) => p.id === pageId);
    if (!page) return null;

    const newBlock: PdfBlock = {
      ...block,
      id: generateId(),
    };

    page.blocks.push(newBlock);
    this.updateTimestamp();
    return newBlock;
  }

  /**
   * Обновляет блок
   */
  updateBlock(pageId: string, blockId: string, updates: Partial<PdfBlock>): boolean {
    const page = this.document.pages.find((p) => p.id === pageId);
    if (!page) return false;

    const block = page.blocks.find((b) => b.id === blockId);
    if (!block) return false;

    Object.assign(block, updates);
    this.updateTimestamp();
    return true;
  }

  /**
   * Удаляет блок
   */
  removeBlock(pageId: string, blockId: string): boolean {
    const page = this.document.pages.find((p) => p.id === pageId);
    if (!page) return false;

    const index = page.blocks.findIndex((b) => b.id === blockId);
    if (index === -1) return false;

    page.blocks.splice(index, 1);
    this.updateTimestamp();
    return true;
  }

  /**
   * Перемещает блок (изменяет порядок)
   */
  moveBlock(pageId: string, blockId: string, newIndex: number): boolean {
    const page = this.document.pages.find((p) => p.id === pageId);
    if (!page) return false;

    const blockIndex = page.blocks.findIndex((b) => b.id === blockId);
    if (blockIndex === -1) return false;

    const [block] = page.blocks.splice(blockIndex, 1);
    page.blocks.splice(newIndex, 0, block);
    this.updateTimestamp();
    return true;
  }

  /**
   * Устанавливает тему
   */
  setTheme(theme: PdfDocument['theme']): void {
    this.document.theme = theme;
    this.updateTimestamp();
  }

  /**
   * Обновляет формат и ориентацию документа
   */
  updateDocumentFormat(format: PageFormat, orientation: PageOrientation, scaleBlocks: boolean = false): void {
    const oldFormat = PAGE_FORMATS[this.document.format];
    const newFormat = PAGE_FORMATS[format];
    
    // Вычисляем масштаб для блоков
    let scaleX = 1;
    let scaleY = 1;
    
    if (scaleBlocks) {
      scaleX = newFormat.width / oldFormat.width;
      scaleY = newFormat.height / oldFormat.height;
    }
    
    this.document.format = format;
    this.document.orientation = orientation;
    
    // Обновляем формат всех страниц и масштабируем блоки
    this.document.pages.forEach((page) => {
      page.format = format;
      page.orientation = orientation;
      
      if (scaleBlocks) {
        page.blocks.forEach((block) => {
          block.position.x *= scaleX;
          block.position.y *= scaleY;
          block.position.width *= scaleX;
          block.position.height *= scaleY;
        });
      }
    });
    
    this.updateTimestamp();
  }

  /**
   * Получает документ
   */
  getDocument(): PdfDocument {
    return { ...this.document };
  }

  /**
   * Загружает документ
   */
  loadDocument(document: PdfDocument): void {
    this.document = { ...document };
    this.renumberPages();
    this.updateTimestamp();
  }

  /**
   * Перенумеровывает страницы
   */
  private renumberPages(): void {
    this.document.pages.forEach((page, index) => {
      page.pageNumber = index + 1;
    });
  }

  /**
   * Обновляет timestamp
   */
  private updateTimestamp(): void {
    this.document.updatedAt = new Date().toISOString();
    if (this.document.version) {
      this.document.version += 1;
    }
  }

  /**
   * Получает тему по умолчанию
   */
  private getDefaultTheme(): PdfDocument['theme'] {
    return {
      id: 'simple',
      name: 'Simple',
      colors: {
        primary: '#ff9f5a',
        secondary: '#6b7280',
        text: '#1a202c',
        textSecondary: '#6b7280',
        background: '#ffffff',
        surface: '#f9fafb',
        accent: '#ff9f5a',
        border: '#e5e7eb',
        tipBlock: {
          background: '#f0fdf4',
          border: '#22c55e',
          text: '#166534',
        },
        importantBlock: {
          background: '#eff6ff',
          border: '#3b82f6',
          text: '#1e40af',
        },
        warningBlock: {
          background: '#fef3c7',
          border: '#f59e0b',
          text: '#92400e',
        },
      },
      typography: {
        headingFont: 'Inter, system-ui, sans-serif',
        bodyFont: 'Inter, system-ui, sans-serif',
        headingSizes: {
          h1: 32,
          h2: 24,
          h3: 20,
        },
        bodySize: 14,
        lineHeight: 1.6,
      },
      spacing: {
        pagePadding: 20,
        blockSpacing: 16,
        elementSpacing: 8,
      },
      blocks: {
        borderRadius: 8,
        borderWidth: 1,
        shadow: '0 2px 8px rgba(0,0,0,0.1)',
      },
    };
  }
}

