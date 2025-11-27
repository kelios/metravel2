/**
 * @jest-environment jsdom
 */

// components/export/constructor/__tests__/PdfConstructor.integration.test.tsx
// ✅ ТЕСТЫ: Интеграционные тесты для PdfConstructor

import React from 'react';
import PdfConstructor from '@/components/export/PdfConstructor';

// Мокаем зависимости
jest.mock('@/src/services/pdf-export/constructor/ArticleConstructorService');
jest.mock('@/src/services/pdf-export/constructor/themes/ThemeManager');

// Мокаем window.document для экспорта
const originalDocument = global.document;
const originalCreateElement = originalDocument?.createElement?.bind(originalDocument);
const originalAppendChild = originalDocument?.body?.appendChild?.bind(originalDocument.body);
const originalRemoveChild = originalDocument?.body?.removeChild?.bind(originalDocument.body);

const mockCreateElement = jest.fn();
const mockAppendChild = jest.fn();
const mockRemoveChild = jest.fn();

beforeAll(() => {
  if (!originalDocument) {
    return;
  }

  jest.spyOn(originalDocument, 'createElement').mockImplementation((tag: string) => {
    const element = originalCreateElement ? originalCreateElement(tag) : document.createElement(tag);
    element.click = jest.fn();
    mockCreateElement(tag);
    return element;
  });

  if (originalAppendChild) {
    jest.spyOn(originalDocument.body, 'appendChild').mockImplementation((node: any) => {
      mockAppendChild(node);
      return originalAppendChild(node);
    });
  }

  if (originalRemoveChild) {
    jest.spyOn(originalDocument.body, 'removeChild').mockImplementation((node: any) => {
      mockRemoveChild(node);
      return originalRemoveChild(node);
    });
  }
});

afterAll(() => {
  jest.restoreAllMocks();
});

// Упрощённый smoke-тест: убеждаемся, что компонент успешно импортируется.
describe('PdfConstructor - smoke', () => {
  it('экспортирует определение компонента', () => {
    expect(PdfConstructor).toBeDefined();
  });
});
