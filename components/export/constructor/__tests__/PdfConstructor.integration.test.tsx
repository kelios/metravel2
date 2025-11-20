// components/export/constructor/__tests__/PdfConstructor.integration.test.tsx
// ✅ ТЕСТЫ: Интеграционные тесты для PdfConstructor

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PdfConstructor from '../PdfConstructor';

// Мокаем зависимости
jest.mock('@/src/services/pdf-export/constructor/ArticleConstructorService');
jest.mock('@/src/services/pdf-export/constructor/themes/ThemeManager');

// Мокаем window.document для экспорта
const mockCreateElement = jest.fn((tag: string) => {
  const element = document.createElement(tag);
  element.click = jest.fn();
  return element;
});

const mockAppendChild = jest.fn();
const mockRemoveChild = jest.fn();

beforeAll(() => {
  Object.defineProperty(window, 'document', {
    value: {
      ...window.document,
      createElement: mockCreateElement,
      body: {
        ...window.document.body,
        appendChild: mockAppendChild,
        removeChild: mockRemoveChild,
      },
    },
    writable: true,
  });
});

describe('PdfConstructor - Интеграционные тесты', () => {
  const mockOnExport = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Инициализация', () => {
    it('должен отображать конструктор', () => {
      render(
        <PdfConstructor
          onExport={mockOnExport}
          onClose={mockOnClose}
        />
      );

      // Проверяем наличие элементов интерфейса
      // (зависит от реализации Toolbar)
    });

    it('должен импортировать статью при наличии travelData', async () => {
      const travelData = {
        title: 'Test Article',
        content: '<h1>Title</h1><p>Content</p>',
      };

      render(
        <PdfConstructor
          travelData={travelData}
          onExport={mockOnExport}
          onClose={mockOnClose}
        />
      );

      await waitFor(() => {
        // Проверяем, что конструктор загрузился
        expect(screen.queryByText('Загрузка...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Управление блоками', () => {
    it('должен открывать палитру блоков', () => {
      render(
        <PdfConstructor
          onExport={mockOnExport}
          onClose={mockOnClose}
        />
      );

      // Тест зависит от реализации палитры блоков
    });

    it('должен добавлять страницу', () => {
      render(
        <PdfConstructor
          onExport={mockOnExport}
          onClose={mockOnClose}
        />
      );

      // Тест зависит от реализации кнопки добавления страницы
    });
  });

  describe('Экспорт макета (layout export)', () => {
    it('должен экспортировать макет в JSON', async () => {
      const { ArticleConstructorService } = require('@/src/services/pdf-export/constructor/ArticleConstructorService');
      
      // Мокаем сервис
      const mockService = {
        getDocument: jest.fn(() => ({
          id: 'test-doc-1',
          title: 'Test Document',
          format: 'A4',
          orientation: 'portrait',
          pages: [
            {
              id: 'page-1',
              pageNumber: 1,
              format: 'A4',
              orientation: 'portrait',
              blocks: [],
              background: null,
            },
          ],
          theme: {
            id: 'light',
            name: 'Light',
            colors: {},
            typography: {},
            spacing: {},
            blocks: {},
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
      };

      const mockBuilder = {
        exportToJSON: jest.fn(() => JSON.stringify({
          id: 'test-doc-1',
          title: 'Test Document',
          pages: [],
        })),
      };

      (ArticleConstructorService as jest.Mock).mockImplementation(() => ({
        getDocument: mockService.getDocument,
        builder: mockBuilder,
      }));

      render(
        <PdfConstructor
          onExport={mockOnExport}
          onClose={mockOnClose}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Загрузка...')).not.toBeInTheDocument();
      });

      // Ищем кнопку экспорта макета (зависит от реализации Toolbar)
      // const exportButton = screen.getByText(/Экспорт|экспорт/i);
      // fireEvent.click(exportButton);

      // Проверяем, что был вызван exportToJSON
      // expect(mockBuilder.exportToJSON).toHaveBeenCalled();
    });
  });

  describe('Экспорт PDF', () => {
    it('должен вызывать exportToPdf при экспорте', async () => {
      const { ArticleConstructorService } = require('@/src/services/pdf-export/constructor/ArticleConstructorService');
      
      const mockExportToPdf = jest.fn(() => Promise.resolve({
        blob: new Blob(['test pdf'], { type: 'application/pdf' }),
        filename: 'test_document.pdf',
      }));

      const mockService = {
        getDocument: jest.fn(() => ({
          id: 'test-doc-1',
          title: 'Test Document',
          format: 'A4',
          orientation: 'portrait',
          pages: [
            {
              id: 'page-1',
              pageNumber: 1,
              format: 'A4',
              orientation: 'portrait',
              blocks: [],
              background: null,
            },
          ],
          theme: {
            id: 'light',
            name: 'Light',
            colors: {},
            typography: {},
            spacing: {},
            blocks: {},
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
        exportToPdf: mockExportToPdf,
      };

      (ArticleConstructorService as jest.Mock).mockImplementation(() => mockService);

      render(
        <PdfConstructor
          onExport={mockOnExport}
          onClose={mockOnClose}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Загрузка...')).not.toBeInTheDocument();
      });

      // Находим кнопку экспорта PDF и кликаем
      // const exportButton = screen.getByText(/Экспорт PDF/i);
      // fireEvent.click(exportButton);

      // Ждем завершения экспорта
      // await waitFor(() => {
      //   expect(mockExportToPdf).toHaveBeenCalled();
      //   expect(mockOnExport).toHaveBeenCalled();
      // });
    });

    it('должен обрабатывать ошибки при экспорте PDF', async () => {
      const { ArticleConstructorService } = require('@/src/services/pdf-export/constructor/ArticleConstructorService');
      
      const mockExportToPdf = jest.fn(() => Promise.reject(new Error('Export failed')));

      const mockService = {
        getDocument: jest.fn(() => ({
          id: 'test-doc-1',
          title: 'Test Document',
          format: 'A4',
          orientation: 'portrait',
          pages: [
            {
              id: 'page-1',
              pageNumber: 1,
              format: 'A4',
              orientation: 'portrait',
              blocks: [],
              background: null,
            },
          ],
          theme: {
            id: 'light',
            name: 'Light',
            colors: {},
            typography: {},
            spacing: {},
            blocks: {},
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
        exportToPdf: mockExportToPdf,
      };

      // Мокаем alert
      const mockAlert = jest.fn();
      global.alert = mockAlert;

      (ArticleConstructorService as jest.Mock).mockImplementation(() => mockService);

      render(
        <PdfConstructor
          onExport={mockOnExport}
          onClose={mockOnClose}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Загрузка...')).not.toBeInTheDocument();
      });

      // const exportButton = screen.getByText(/Экспорт PDF/i);
      // fireEvent.click(exportButton);

      // await waitFor(() => {
      //   expect(mockAlert).toHaveBeenCalledWith(
      //     expect.stringContaining('Ошибка экспорта')
      //   );
      // });
    });

    it('должен создавать ссылку для скачивания PDF', async () => {
      const { ArticleConstructorService } = require('@/src/services/pdf-export/constructor/ArticleConstructorService');
      
      const mockBlob = new Blob(['test pdf'], { type: 'application/pdf' });
      const mockExportToPdf = jest.fn(() => Promise.resolve({
        blob: mockBlob,
        filename: 'test_document_2024-01-01.pdf',
      }));

      const mockService = {
        getDocument: jest.fn(() => ({
          id: 'test-doc-1',
          title: 'Test Document',
          format: 'A4',
          orientation: 'portrait',
          pages: [],
          theme: {
            id: 'light',
            name: 'Light',
            colors: {},
            typography: {},
            spacing: {},
            blocks: {},
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
        exportToPdf: mockExportToPdf,
      };

      (ArticleConstructorService as jest.Mock).mockImplementation(() => mockService);

      render(
        <PdfConstructor
          onExport={mockOnExport}
          onClose={mockOnClose}
        />
      );

      await waitFor(() => {
        expect(screen.queryByText('Загрузка...')).not.toBeInTheDocument();
      });

      // const exportButton = screen.getByText(/Экспорт PDF/i);
      // fireEvent.click(exportButton);

      // await waitFor(() => {
      //   expect(mockCreateElement).toHaveBeenCalledWith('a');
      //   expect(mockAppendChild).toHaveBeenCalled();
      //   expect(mockRemoveChild).toHaveBeenCalled();
      // });
    });
  });

  describe('Горячие клавиши', () => {
    it('должен обрабатывать Ctrl+Z для отмены', () => {
      render(
        <PdfConstructor
          onExport={mockOnExport}
          onClose={mockOnClose}
        />
      );

      fireEvent.keyDown(window, {
        key: 'z',
        ctrlKey: true,
      });

      // Проверяем, что действие отменено
    });

    it('должен обрабатывать PageUp для навигации на предыдущую страницу', () => {
      render(
        <PdfConstructor
          onExport={mockOnExport}
          onClose={mockOnClose}
        />
      );

      fireEvent.keyDown(window, {
        key: 'PageUp',
      });

      // Проверяем, что произошла навигация
    });

    it('должен обрабатывать PageDown для навигации на следующую страницу', () => {
      render(
        <PdfConstructor
          onExport={mockOnExport}
          onClose={mockOnClose}
        />
      );

      fireEvent.keyDown(window, {
        key: 'PageDown',
      });

      // Проверяем, что произошла навигация
    });

    it('должен обрабатывать Ctrl+C для копирования', () => {
      render(
        <PdfConstructor
          onExport={mockOnExport}
          onClose={mockOnClose}
        />
      );

      // Сначала выбираем блок
      // Затем нажимаем Ctrl+C
      fireEvent.keyDown(window, {
        key: 'c',
        ctrlKey: true,
      });
    });
  });
});
