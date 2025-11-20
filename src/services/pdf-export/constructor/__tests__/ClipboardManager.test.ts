// src/services/pdf-export/constructor/__tests__/ClipboardManager.test.ts
// ✅ ТЕСТЫ: Unit-тесты для ClipboardManager

import { ClipboardManager } from '../ClipboardManager';
import type { PdfBlock } from '@/src/types/pdf-constructor';

describe('ClipboardManager', () => {
  let clipboard: ClipboardManager;
  let testBlock: PdfBlock;

  beforeEach(() => {
    clipboard = ClipboardManager.getInstance();
    clipboard.clear();
    
    testBlock = {
      id: 'block-1',
      type: 'paragraph',
      position: { x: 10, y: 10, width: 100, height: 50, unit: 'mm' },
      styles: { fontSize: 14, color: '#000' },
      content: 'Test content',
    };
  });

  describe('Копирование', () => {
    it('должен копировать блок', () => {
      clipboard.copy(testBlock);
      expect(clipboard.hasContent()).toBe(true);
    });

    it('должен создавать глубокую копию', () => {
      clipboard.copy(testBlock);
      testBlock.content = 'Modified';
      
      const pasted = clipboard.paste();
      expect(pasted?.content).toBe('Test content');
    });
  });

  describe('Вставка', () => {
    it('должен вставлять блок с новым ID', () => {
      clipboard.copy(testBlock);
      const pasted = clipboard.paste();
      
      expect(pasted).toBeDefined();
      expect(pasted?.id).not.toBe(testBlock.id);
      expect(pasted?.content).toBe(testBlock.content);
    });

    it('должен смещать позицию при вставке', () => {
      clipboard.copy(testBlock);
      const pasted = clipboard.paste();
      
      expect(pasted?.position.x).toBe(testBlock.position.x + 10);
      expect(pasted?.position.y).toBe(testBlock.position.y + 10);
    });

    it('должен возвращать null, если буфер пуст', () => {
      const pasted = clipboard.paste();
      expect(pasted).toBeNull();
    });
  });

  describe('Очистка', () => {
    it('должен очищать буфер', () => {
      clipboard.copy(testBlock);
      clipboard.clear();
      expect(clipboard.hasContent()).toBe(false);
    });
  });
});

