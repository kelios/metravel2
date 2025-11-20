// hooks/usePdfConstructor.ts
// ✅ АРХИТЕКТУРА: React hook для работы с конструктором PDF

import { useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import type { PdfDocument, PdfExportResult, PdfExportConfig } from '@/src/types/pdf-constructor';
import type { Travel } from '@/src/types/types';
import { ArticleConstructorService } from '@/src/services/pdf-export/constructor/ArticleConstructorService';

/**
 * React hook для работы с конструктором PDF
 */
export function usePdfConstructor() {
  const [service] = useState(() => new ArticleConstructorService());
  const [document, setDocument] = useState<PdfDocument | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMessage, setExportMessage] = useState('');

  /**
   * Создает новый документ
   */
  const createDocument = useCallback((title: string, format: 'A4' | 'A5' | 'A6' | 'Letter' = 'A4') => {
    const doc = service.createDocument(title, format);
    setDocument(doc);
    return doc;
  }, [service]);

  /**
   * Импортирует статью в конструктор
   */
  const importArticle = useCallback((travel: Travel, themeId: string = 'light') => {
    const doc = service.importArticle(travel, themeId);
    setDocument(doc);
    return doc;
  }, [service]);

  /**
   * Получает текущий документ
   */
  const getDocument = useCallback(() => {
    return service.getDocument();
  }, [service]);

  /**
   * Обновляет документ
   */
  const updateDocument = useCallback((updates: Partial<PdfDocument>) => {
    service.updateDocument(updates);
    setDocument(service.getDocument());
  }, [service]);

  /**
   * Экспортирует документ в PDF
   */
  const exportToPdf = useCallback(async (
    config: Partial<PdfExportConfig> = {}
  ): Promise<PdfExportResult> => {
    if (Platform.OS !== 'web') {
      throw new Error('PDF export is only available on web');
    }

    setIsExporting(true);
    setExportProgress(0);
    setExportMessage('');

    try {
      const result = await service.exportToPdf(
        config,
        (progress, message) => {
          setExportProgress(progress);
          setExportMessage(message);
        }
      );

      return result;
    } finally {
      setIsExporting(false);
    }
  }, [service]);

  /**
   * Предпросмотр страницы
   */
  const previewPage = useCallback(async (pageId: string): Promise<string> => {
    return service.previewPage(pageId);
  }, [service]);

  /**
   * Сохраняет документ
   */
  const saveDocument = useCallback((key: string = 'pdf-constructor-draft') => {
    service.saveDocument(key);
  }, [service]);

  /**
   * Загружает документ
   */
  const loadDocument = useCallback((key: string = 'pdf-constructor-draft'): PdfDocument | null => {
    const doc = service.loadDocument(key);
    if (doc) {
      setDocument(doc);
    }
    return doc;
  }, [service]);

  return {
    document,
    isExporting,
    exportProgress,
    exportMessage,
    createDocument,
    importArticle,
    getDocument,
    updateDocument,
    exportToPdf,
    previewPage,
    saveDocument,
    loadDocument,
  };
}

