// src/services/pdf-export/constructor/ClipboardManager.ts
// ✅ АРХИТЕКТУРА: Менеджер буфера обмена для блоков

import type { PdfBlock } from '@/src/types/pdf-constructor';

export class ClipboardManager {
  private static instance: ClipboardManager;
  private clipboard: PdfBlock | null = null;

  private constructor() {}

  static getInstance(): ClipboardManager {
    if (!ClipboardManager.instance) {
      ClipboardManager.instance = new ClipboardManager();
    }
    return ClipboardManager.instance;
  }

  /**
   * Копирует блок в буфер обмена
   */
  copy(block: PdfBlock): void {
    // Создаем глубокую копию блока
    this.clipboard = this.deepClone(block);
  }

  /**
   * Вставляет блок из буфера обмена
   */
  paste(): PdfBlock | null {
    if (!this.clipboard) return null;

    // Создаем новую копию с новым ID
    const pastedBlock = this.deepClone(this.clipboard);
    pastedBlock.id = this.generateId();
    
    // Слегка смещаем позицию, чтобы было видно, что это копия
    pastedBlock.position = {
      ...pastedBlock.position,
      x: pastedBlock.position.x + 10,
      y: pastedBlock.position.y + 10,
    };

    return pastedBlock;
  }

  /**
   * Проверяет, есть ли блок в буфере обмена
   */
  hasContent(): boolean {
    return this.clipboard !== null;
  }

  /**
   * Очищает буфер обмена
   */
  clear(): void {
    this.clipboard = null;
  }

  /**
   * Генерирует уникальный ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Глубокая копия блока
   */
  private deepClone(block: PdfBlock): PdfBlock {
    return JSON.parse(JSON.stringify(block));
  }
}

