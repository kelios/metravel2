// src/services/pdf-export/constructor/__tests__/HistoryManager.test.ts
// ✅ ТЕСТЫ: Unit-тесты для HistoryManager

import { HistoryManager } from '../HistoryManager';
import type { PdfDocument } from '@/src/types/pdf-constructor';

describe('HistoryManager', () => {
  let historyManager: HistoryManager;
  let initialDoc: PdfDocument;

  beforeEach(() => {
    historyManager = new HistoryManager();
    initialDoc = {
      id: 'doc-1',
      title: 'Test Document',
      pages: [],
      theme: {
        id: 'simple',
        name: 'Simple',
        colors: {} as any,
        typography: {} as any,
        spacing: {} as any,
        blocks: {} as any,
      },
      format: 'A4',
      orientation: 'portrait',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };
    historyManager.initialize(initialDoc);
  });

  describe('Инициализация', () => {
    it('должен инициализировать историю с начальным состоянием', () => {
      expect(historyManager.canUndo()).toBe(false);
      expect(historyManager.canRedo()).toBe(false);
    });
  });

  describe('Undo/Redo', () => {
    it('должен сохранять состояние при push', () => {
      const newDoc = { ...initialDoc, title: 'Updated Title' };
      historyManager.push(newDoc);
      expect(historyManager.canUndo()).toBe(true);
    });

    it('должен отменять действие', () => {
      const newDoc = { ...initialDoc, title: 'Updated Title' };
      historyManager.push(newDoc);

      const undone = historyManager.undo();
      expect(undone).toBeDefined();
      expect(undone?.title).toBe('Test Document');
      expect(historyManager.canRedo()).toBe(true);
    });

    it('должен повторять отмененное действие', () => {
      const newDoc = { ...initialDoc, title: 'Updated Title' };
      historyManager.push(newDoc);
      historyManager.undo();

      const redone = historyManager.redo();
      expect(redone).toBeDefined();
      expect(redone?.title).toBe('Updated Title');
    });

    it('не должен отменять, если нет истории', () => {
      const undone = historyManager.undo();
      expect(undone).toBeNull();
    });

    it('не должен повторять, если нет отмененных действий', () => {
      const redone = historyManager.redo();
      expect(redone).toBeNull();
    });
  });

  describe('Ограничение размера истории', () => {
    it('должен ограничивать размер истории', () => {
      // Добавляем больше действий, чем максимум
      for (let i = 0; i < 60; i++) {
        const newDoc = { ...initialDoc, title: `Title ${i}` };
        historyManager.push(newDoc);
      }

      // История должна быть ограничена
      expect(historyManager.canUndo()).toBe(true);
    });
  });
});

