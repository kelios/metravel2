// src/services/pdf-export/constructor/HistoryManager.ts
// ✅ АРХИТЕКТУРА: Менеджер истории изменений (Undo/Redo)

import type { PdfDocument } from '@/src/types/pdf-constructor';

export class HistoryManager {
  private history: PdfDocument[] = [];
  private currentIndex: number = -1;
  private maxHistorySize: number = 50;

  /**
   * Добавляет состояние в историю
   */
  push(document: PdfDocument): void {
    // Удаляем все действия после текущего индекса (если был undo)
    this.history = this.history.slice(0, this.currentIndex + 1);
    
    // Добавляем новое состояние (глубокая копия)
    const documentCopy = this.deepClone(document);
    this.history.push(documentCopy);
    
    // Ограничиваем размер истории
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }
  }

  /**
   * Отменяет последнее действие
   */
  undo(): PdfDocument | null {
    if (this.canUndo()) {
      this.currentIndex--;
      return this.deepClone(this.history[this.currentIndex]);
    }
    return null;
  }

  /**
   * Повторяет отмененное действие
   */
  redo(): PdfDocument | null {
    if (this.canRedo()) {
      this.currentIndex++;
      return this.deepClone(this.history[this.currentIndex]);
    }
    return null;
  }

  /**
   * Проверяет, можно ли отменить действие
   */
  canUndo(): boolean {
    return this.currentIndex > 0;
  }

  /**
   * Проверяет, можно ли повторить действие
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Очищает историю
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }

  /**
   * Инициализирует историю с начальным состоянием
   */
  initialize(document: PdfDocument): void {
    this.clear();
    this.push(document);
  }

  /**
   * Сохраняет историю в localStorage
   */
  saveToLocalStorage(documentId: string): void {
    try {
      const data = {
        history: this.history,
        currentIndex: this.currentIndex,
        timestamp: new Date().toISOString(),
      };
      localStorage.setItem(`pdf-history-${documentId}`, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save history to localStorage', error);
    }
  }

  /**
   * Загружает историю из localStorage
   */
  loadFromLocalStorage(documentId: string): boolean {
    try {
      const data = localStorage.getItem(`pdf-history-${documentId}`);
      if (data) {
        const parsed = JSON.parse(data);
        // Проверяем, что данные не старше 24 часов
        const timestamp = new Date(parsed.timestamp);
        const now = new Date();
        const hoursDiff = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);
        
        if (hoursDiff < 24) {
          this.history = parsed.history;
          this.currentIndex = parsed.currentIndex;
          return true;
        } else {
          // Удаляем устаревшие данные
          localStorage.removeItem(`pdf-history-${documentId}`);
        }
      }
    } catch (error) {
      console.warn('Failed to load history from localStorage', error);
    }
    return false;
  }

  /**
   * Очищает историю в localStorage
   */
  clearLocalStorage(documentId: string): void {
    try {
      localStorage.removeItem(`pdf-history-${documentId}`);
    } catch (error) {
      console.warn('Failed to clear history from localStorage', error);
    }
  }

  /**
   * Глубокая копия документа
   */
  private deepClone(document: PdfDocument): PdfDocument {
    return JSON.parse(JSON.stringify(document));
  }
}

