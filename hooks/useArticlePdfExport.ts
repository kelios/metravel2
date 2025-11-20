// hooks/useArticlePdfExport.ts
// ✅ АРХИТЕКТУРА: React hook для экспорта одной статьи в PDF

import { useState, useCallback, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import type { Travel } from '@/src/types/types';
import type { ArticleExportSettings } from '@/src/services/pdf-export/generators/ArticlePdfGenerator';
import { ArticlePdfExportService } from '@/src/services/pdf-export/ArticlePdfExportService';

/**
 * React hook для экспорта одной статьи в PDF
 */
export function useArticlePdfExport() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState<Error | null>(null);

  const serviceRef = useRef<ArticlePdfExportService | null>(null);

  // Инициализируем сервис один раз
  if (!serviceRef.current && (Platform.OS === 'web' || typeof document !== 'undefined')) {
    serviceRef.current = new ArticlePdfExportService();
  }

  /**
   * Экспортирует статью в PDF
   */
  const exportArticle = useCallback(
    async (travel: Travel, settings: ArticleExportSettings) => {
      if (Platform.OS !== 'web') {
        Alert.alert('Недоступно', 'Экспорт PDF доступен только в веб-версии');
        return;
      }

      if (!serviceRef.current) {
        Alert.alert('Ошибка', 'Сервис экспорта не инициализирован');
        return;
      }

      setIsGenerating(true);
      setProgress(0);
      setProgressMessage('Начало экспорта...');
      setError(null);

      try {
        const result = await serviceRef.current.export(
          travel,
          settings,
          (prog, message) => {
            setProgress(prog);
            setProgressMessage(message);
          }
        );

        // Скачиваем файл
        const url = URL.createObjectURL(result.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setProgress(100);
        setProgressMessage('Готово!');
      } catch (err) {
        const exportError = err instanceof Error ? err : new Error('Неизвестная ошибка');
        setError(exportError);
        Alert.alert('Ошибка экспорта', exportError.message);
      } finally {
        setIsGenerating(false);
      }
    },
    []
  );

  return {
    exportArticle,
    isGenerating,
    progress,
    progressMessage,
    error,
  };
}

