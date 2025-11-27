import { PdfDocumentBuilder } from '@/src/services/pdf-export/constructor/PdfDocumentBuilder';
import type { PdfDocument, PdfPage, PdfBlock } from '@/src/types/pdf-constructor';

// Юнит-тесты для PdfDocumentBuilder: проверяем логику без рендера или внешних зависимостей

describe('PdfDocumentBuilder', () => {
  const createBuilder = () => new PdfDocumentBuilder('Test Document', 'A4', 'portrait');

  it('creates document with initial page list empty and default theme', () => {
    const builder = createBuilder();
    const doc = builder.getDocument();

    expect(doc.title).toBe('Test Document');
    expect(doc.pages).toEqual([]);
    expect(doc.theme).toBeTruthy();
    expect(doc.format).toBe('A4');
    expect(doc.orientation).toBe('portrait');
  });

  it('adds page and assigns pageNumber sequentially', () => {
    const builder = createBuilder();

    const page1 = builder.addPage();
    const page2 = builder.addPage();

    const doc = builder.getDocument();
    expect(doc.pages).toHaveLength(2);
    expect(page1.pageNumber).toBe(1);
    expect(page2.pageNumber).toBe(2);
  });

  it('removes page and renumbers remaining pages', () => {
    const builder = createBuilder();
    const page1 = builder.addPage();
    const page2 = builder.addPage();
    const page3 = builder.addPage();

    const removed = builder.removePage(page2.id);
    const doc = builder.getDocument();

    expect(removed).toBe(true);
    expect(doc.pages).toHaveLength(2);
    expect(doc.pages[0].id).toBe(page1.id);
    expect(doc.pages[0].pageNumber).toBe(1);
    expect(doc.pages[1].id).toBe(page3.id);
    expect(doc.pages[1].pageNumber).toBe(2);
  });

  it('duplicatePage clones page with new ids for page and blocks', () => {
    const builder = createBuilder();
    const page = builder.addPage({
      blocks: [
        {
          id: 'block-1',
          type: 'paragraph',
          content: 'Hello',
          styles: { fontSize: 14, lineHeight: 1.5 },
          position: { x: 10, y: 20, width: 50, height: 20, unit: 'mm' },
        } as any,
      ],
    });

    const duplicated = builder.duplicatePage(page.id);
    const doc = builder.getDocument();

    expect(duplicated).not.toBeNull();
    expect(duplicated && duplicated.id).not.toBe(page.id);
    expect(duplicated && duplicated.blocks[0].id).not.toBe('block-1');
    expect(doc.pages).toHaveLength(2);
  });

  it('addBlock adds a new block with generated id to page', () => {
    const builder = createBuilder();
    const page = builder.addPage();

    const newBlock = builder.addBlock(page.id, {
      type: 'paragraph',
      content: 'Test block',
      styles: { fontSize: 14, lineHeight: 1.5 },
      position: { x: 0, y: 0, width: 100, height: 20, unit: 'percent' },
    } as any);

    expect(newBlock).not.toBeNull();
    const doc = builder.getDocument();
    const pageInDoc = doc.pages.find((p) => p.id === page.id)!;
    expect(pageInDoc.blocks).toHaveLength(1);
    expect(pageInDoc.blocks[0].content).toBe('Test block');
  });

  it('updateBlock updates existing block and returns true, false for missing', () => {
    const builder = createBuilder();
    const page = builder.addPage();
    const block = builder.addBlock(page.id, {
      type: 'paragraph',
      content: 'Old',
      styles: { fontSize: 14, lineHeight: 1.5 },
      position: { x: 0, y: 0, width: 100, height: 20, unit: 'percent' },
    } as any)!;

    const updated = builder.updateBlock(page.id, block.id, { content: 'New' });
    const missing = builder.updateBlock(page.id, 'no-such-block', { content: 'X' });

    const pageInDoc = builder.getDocument().pages.find((p) => p.id === page.id)!;
    expect(updated).toBe(true);
    expect(missing).toBe(false);
    expect(pageInDoc.blocks[0].content).toBe('New');
  });

  it('removeBlock removes block from page', () => {
    const builder = createBuilder();
    const page = builder.addPage();
    const block = builder.addBlock(page.id, {
      type: 'paragraph',
      content: 'To remove',
      styles: { fontSize: 14, lineHeight: 1.5 },
      position: { x: 0, y: 0, width: 100, height: 20, unit: 'percent' },
    } as any)!;

    const removed = builder.removeBlock(page.id, block.id);
    const pageInDoc = builder.getDocument().pages.find((p) => p.id === page.id)!;

    expect(removed).toBe(true);
    expect(pageInDoc.blocks).toHaveLength(0);
  });

  it('moveBlock changes order of blocks on page', () => {
    const builder = createBuilder();
    const page = builder.addPage();

    const block1 = builder.addBlock(page.id, {
      type: 'paragraph',
      content: 'First',
      styles: { fontSize: 14, lineHeight: 1.5 },
      position: { x: 0, y: 0, width: 100, height: 20, unit: 'percent' },
    } as any)!;

    const block2 = builder.addBlock(page.id, {
      type: 'paragraph',
      content: 'Second',
      styles: { fontSize: 14, lineHeight: 1.5 },
      position: { x: 0, y: 10, width: 100, height: 20, unit: 'percent' },
    } as any)!;

    const moved = builder.moveBlock(page.id, block2.id, 0);
    const pageInDoc = builder.getDocument().pages.find((p) => p.id === page.id)!;

    expect(moved).toBe(true);
    expect(pageInDoc.blocks[0].id).toBe(block2.id);
    expect(pageInDoc.blocks[1].id).toBe(block1.id);
  });

  it('updateDocumentFormat updates format and optionally scales blocks', () => {
    const builder = createBuilder();
    const page = builder.addPage({
      format: 'A4',
      orientation: 'portrait',
      blocks: [
        {
          id: 'b1',
          type: 'paragraph',
          content: 'Scaled',
          styles: { fontSize: 14, lineHeight: 1.5 },
          position: { x: 10, y: 20, width: 30, height: 40, unit: 'mm' },
        } as any,
      ],
    });

    builder.updateDocumentFormat('A5', 'portrait', true);
    const doc = builder.getDocument();
    const updatedPage = doc.pages.find((p) => p.id === page.id)!;

    expect(doc.format).toBe('A5');
    expect(updatedPage.format).toBe('A5');
    // Проверяем, что координаты блока были масштабированы (не равны исходным)
    const block = updatedPage.blocks[0];
    expect(block.position.x).not.toBe(10);
    expect(block.position.y).not.toBe(20);
  });

  it('loadDocument replaces current document and renumbers pages', () => {
    const builder = createBuilder();

    const externalDoc: PdfDocument = {
      id: 'external',
      title: 'External',
      pages: [
        {
          id: 'p1',
          pageNumber: 10,
          format: 'A4',
          orientation: 'portrait',
          blocks: [],
          margins: { top: 10, right: 10, bottom: 10, left: 10 },
        },
        {
          id: 'p2',
          pageNumber: 20,
          format: 'A4',
          orientation: 'portrait',
          blocks: [],
          margins: { top: 10, right: 10, bottom: 10, left: 10 },
        },
      ],
      theme: builder.getDocument().theme,
      format: 'A4',
      orientation: 'portrait',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    builder.loadDocument(externalDoc);
    const doc = builder.getDocument();

    expect(doc.id).toBe('external');
    expect(doc.pages[0].pageNumber).toBe(1);
    expect(doc.pages[1].pageNumber).toBe(2);
  });
});
