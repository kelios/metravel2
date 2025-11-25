// src/hooks/usePdfExport.ts
// ✅ АРХИТЕКТУРА: React hook для экспорта в PDF

import { useState, useCallback, useRef, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import type { Travel } from '@/src/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import { ExportProgress, ExportStage, ExportConfig } from '@/src/types/pdf-export';
import { fetchTravel, fetchTravelBySlug } from '@/src/api/travels';
import { BookHtmlExportService } from '@/src/services/book/BookHtmlExportService';
import { openBookPreviewWindow } from '@/src/utils/openBookPreviewWindow';

/**
 * React hook для экспорта путешествий в PDF
 * Тонкий слой над PdfExportService
 */
export function usePdfExport(selected: Travel[], config?: ExportConfig) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [currentStage, setCurrentStage] = useState<ExportStage>(ExportStage.VALIDATING);

  const htmlServiceRef = useRef<BookHtmlExportService | null>(null);
  const travelCacheRef = useRef<Record<string | number, Travel>>({});

  // Инициализируем HTML-сервис один раз (старый PdfExportService/html2pdf больше не используется)
  useEffect(() => {
    const canUseDom = typeof document !== 'undefined';
    if ((Platform.OS === 'web' || canUseDom) && !htmlServiceRef.current) {
      htmlServiceRef.current = new BookHtmlExportService();
    }

    return () => {
      // Cleanup при размонтировании
      htmlServiceRef.current = null;
    };
  }, [config]);

  // ✅ ИСПРАВЛЕНИЕ: Флаг для отслеживания монтирования компонента
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Callback для обновления прогресса
   */
  const handleProgress = useCallback((progress: ExportProgress) => {
    // ✅ ИСПРАВЛЕНИЕ: Проверяем монтирование перед обновлением состояния
    if (isMountedRef.current) {
      setProgress(progress.progress);
      setCurrentStage(progress.stage);
    }
  }, []);

  const needsDetails = useCallback((travel: Travel) => {
    const partial = travel as Partial<Travel>;
    return (
      typeof partial.description === 'undefined' ||
      typeof partial.recommendation === 'undefined' ||
      typeof partial.plus === 'undefined' ||
      typeof partial.minus === 'undefined' ||
      typeof partial.gallery === 'undefined' ||
      typeof partial.travelAddress === 'undefined'
    );
  }, []);

  const mergeTravelData = useCallback((base: Travel, detailed: Travel): Travel => {
    return {
      ...base,
      ...detailed,
      description: detailed.description ?? base.description,
      recommendation: detailed.recommendation ?? base.recommendation,
      plus: detailed.plus ?? base.plus,
      minus: detailed.minus ?? base.minus,
      gallery: detailed.gallery ?? base.gallery,
      travelAddress: detailed.travelAddress ?? base.travelAddress,
    };
  }, []);

  const loadDetailedTravels = useCallback(async () => {
    if (!selected?.length) return [];

    const enriched = await Promise.all(
      selected.map(async (travel) => {
        const cacheKey = travel.id ?? travel.slug ?? travel.url;

        if (cacheKey && travelCacheRef.current[cacheKey]) {
          return mergeTravelData(travel, travelCacheRef.current[cacheKey]);
        }

        if (!needsDetails(travel)) {
          if (cacheKey) {
            travelCacheRef.current[cacheKey] = travel;
          }
          return travel;
        }

        try {
          const numericId = Number(travel.id);
          let detailed: Travel;

          if (!Number.isNaN(numericId)) {
            detailed = await fetchTravel(numericId);
          } else if (travel.slug) {
            detailed = await fetchTravelBySlug(travel.slug);
          } else {
            detailed = travel;
          }
          const merged = mergeTravelData(travel, detailed);
          if (cacheKey) {
            travelCacheRef.current[cacheKey] = merged;
          }
          return merged;
        } catch (error) {
          console.warn('[usePdfExport] Не удалось загрузить детали путешествия', travel.id, error);
          return travel;
        }
      })
    );

    return enriched;
  }, [selected, mergeTravelData, needsDetails]);

  /**
   * Экспортирует путешествия в PDF
   */
  const exportPdf = useCallback(async (settings: BookSettings): Promise<void> => {
    // Экспорт PDF для книги теперь выполняется через HTML-поток (openPrintBook).
    if (Platform.OS !== 'web') {
      Alert.alert('Недоступно', 'Экспорт PDF доступен только в веб-версии MeTravel');
      return;
    }

    Alert.alert(
      'Экспорт книги',
      'Старый режим экспорта PDF отключён. Пожалуйста, используйте предпросмотр книги и сохранение через диалог печати браузера.',
    );
  }, []);

  /**
   * Создает превью PDF
   */
  const previewPdf = useCallback(async (settings: BookSettings): Promise<string | null> => {
    // Старое превью PDF через html2pdf отключено.
    if (Platform.OS !== 'web') {
      Alert.alert('Недоступно', 'Превью PDF доступно только в веб-версии MeTravel');
      return null;
    }

    Alert.alert(
      'Превью PDF отключено',
      'Для просмотра и сохранения книги используйте новый HTML-предпросмотр с печатью браузера.',
    );
    return null;
  }, []);

  /**
   * Открывает HTML-книгу в новом окне для печати (window.print)
   */
  const openPrintBook = useCallback(
    async (settings: BookSettings): Promise<void> => {
      if (Platform.OS !== 'web') {
        Alert.alert(
          'Недоступно',
          'Просмотр книги и печать доступны только в веб-версии MeTravel'
        );
        return;
      }

      if (!htmlServiceRef.current) {
        Alert.alert('Ошибка', 'Предпросмотр книги недоступен');
        return;
      }

      if (!isMountedRef.current) return;

      setIsGenerating(true);
      setError(null);
      setProgress(0);
      setCurrentStage(ExportStage.GENERATING_HTML);

      try {
        const travelsForExport = await loadDetailedTravels();
        if (!travelsForExport.length) {
          Alert.alert('Внимание', 'Выберите хотя бы одно путешествие для экспорта');
          return;
        }

        const html = await htmlServiceRef.current.generateTravelsHtml(
          travelsForExport,
          settings
        );

        openBookPreviewWindow(html);

        if (isMountedRef.current) {
          setProgress(100);
          setCurrentStage(ExportStage.COMPLETE);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (isMountedRef.current) {
          setError(error);
          Alert.alert('Ошибка', error.message);
          setCurrentStage(ExportStage.ERROR);
        }
      } finally {
        if (isMountedRef.current) {
          setIsGenerating(false);
        }
      }
    }, [loadDetailedTravels]);

  return {
    exportPdf,
    previewPdf,
    openPrintBook,
    isGenerating,
    progress,
    error,
    currentStage,
  };
}

