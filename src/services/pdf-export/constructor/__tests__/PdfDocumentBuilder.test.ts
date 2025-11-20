// src/services/pdf-export/constructor/__tests__/PdfDocumentBuilder.test.ts
// ✅ ТЕСТЫ: Unit-тесты для PdfDocumentBuilder

import { PdfDocumentBuilder } from '../PdfDocumentBuilder';
import type { PdfBlock, BlockType } from '@/src/types/pdf-constructor';

describe('PdfDocumentBuilder', () => {
  let builder: PdfDocumentBuilder;

  beforeEach(() => {
    builder = new PdfDocumentBuilder('Test Document', 'A4');
  });

  describe('Создание документа', () => {
    it('должен создать документ с правильными параметрами', () => {
      const doc = builder.getDocument();
      expect(doc.title).toBe('Test Document');
      expect(doc.format).toBe('A4');
      expect(doc.orientation).toBe('portrait');
      expect(doc.pages).toHaveLength(0);
    });

    it('должен создать документ с темой по умолчанию', () => {
      const doc = builder.getDocument();
      expect(doc.theme).toBeDefined();
      expect(doc.theme.id).toBe('simple');
    });
  });

  describe('Управление страницами', () => {
    it('должен добавлять страницу', () => {
      const page = builder.addPage();
      expect(page).toBeDefined();
      expect(page.pageNumber).toBe(1);
      expect(builder.getDocument().pages).toHaveLength(1);
    });

    it('должен удалять страницу', () => {
      const page = builder.addPage();
      const result = builder.removePage(page.id);
      expect(result).toBe(true);
      expect(builder.getDocument().pages).toHaveLength(0);
    });

    it('должен дублировать страницу', () => {
      const page = builder.addPage();
      const block: Omit<PdfBlock, 'id'> = {
        type: 'paragraph',
        position: { x: 10, y: 10, width: 100, height: 50, unit: 'mm' },
        styles: {},
        content: 'Test content',
      };
      builder.addBlock(page.id, block);

      const duplicated = builder.duplicatePage(page.id);
      expect(duplicated).toBeDefined();
      expect(duplicated?.blocks).toHaveLength(1);
      expect(builder.getDocument().pages).toHaveLength(2);
    });

    it('должен перенумеровывать страницы после удаления', () => {
      const page1 = builder.addPage();
      const page2 = builder.addPage();
      const page3 = builder.addPage();

      builder.removePage(page2.id);
      const doc = builder.getDocument();
      expect(doc.pages[0].pageNumber).toBe(1);
      expect(doc.pages[1].pageNumber).toBe(2);
    });
  });

  describe('Управление блоками', () => {
    let pageId: string;

    beforeEach(() => {
      const page = builder.addPage();
      pageId = page.id;
    });

    it('должен добавлять блок на страницу', () => {
      const block: Omit<PdfBlock, 'id'> = {
        type: 'paragraph',
        position: { x: 10, y: 10, width: 100, height: 50, unit: 'mm' },
        styles: {},
        content: 'Test content',
      };

      const addedBlock = builder.addBlock(pageId, block);
      expect(addedBlock).toBeDefined();
      expect(addedBlock?.id).toBeDefined();
      expect(addedBlock?.type).toBe('paragraph');

      const doc = builder.getDocument();
      const page = doc.pages.find(p => p.id === pageId);
      expect(page?.blocks).toHaveLength(1);
    });

    it('должен обновлять блок', () => {
      const block: Omit<PdfBlock, 'id'> = {
        type: 'paragraph',
        position: { x: 10, y: 10, width: 100, height: 50, unit: 'mm' },
        styles: {},
        content: 'Original',
      };

      const addedBlock = builder.addBlock(pageId, block);
      if (!addedBlock) throw new Error('Block not added');

      const result = builder.updateBlock(pageId, addedBlock.id, { content: 'Updated' });
      expect(result).toBe(true);

      const doc = builder.getDocument();
      const page = doc.pages.find(p => p.id === pageId);
      const updatedBlock = page?.blocks.find(b => b.id === addedBlock.id);
      expect(updatedBlock?.content).toBe('Updated');
    });

    it('должен удалять блок', () => {
      const block: Omit<PdfBlock, 'id'> = {
        type: 'paragraph',
        position: { x: 10, y: 10, width: 100, height: 50, unit: 'mm' },
        styles: {},
        content: 'Test',
      };

      const addedBlock = builder.addBlock(pageId, block);
      if (!addedBlock) throw new Error('Block not added');

      const result = builder.removeBlock(pageId, addedBlock.id);
      expect(result).toBe(true);

      const doc = builder.getDocument();
      const page = doc.pages.find(p => p.id === pageId);
      expect(page?.blocks).toHaveLength(0);
    });

    it('должен перемещать блок', () => {
      const block1: Omit<PdfBlock, 'id'> = {
        type: 'paragraph',
        position: { x: 10, y: 10, width: 100, height: 50, unit: 'mm' },
        styles: {},
        content: 'Block 1',
      };
      const block2: Omit<PdfBlock, 'id'> = {
        type: 'paragraph',
        position: { x: 20, y: 20, width: 100, height: 50, unit: 'mm' },
        styles: {},
        content: 'Block 2',
      };

      const added1 = builder.addBlock(pageId, block1);
      const added2 = builder.addBlock(pageId, block2);
      if (!added1 || !added2) throw new Error('Blocks not added');

      builder.moveBlock(pageId, added1.id, 1);

      const doc = builder.getDocument();
      const page = doc.pages.find(p => p.id === pageId);
      expect(page?.blocks[0].id).toBe(added2.id);
      expect(page?.blocks[1].id).toBe(added1.id);
    });
  });

  describe('Обновление формата документа', () => {
    it('должен обновлять формат и ориентацию', () => {
      builder.addPage();
      builder.updateDocumentFormat('A5', 'landscape');

      const doc = builder.getDocument();
      expect(doc.format).toBe('A5');
      expect(doc.orientation).toBe('landscape');
      expect(doc.pages[0].format).toBe('A5');
      expect(doc.pages[0].orientation).toBe('landscape');
    });
  });
});

