// src/hooks/usePdfExport.ts
// ✅ АРХИТЕКТУРА: React hook для экспорта в PDF

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import type { Travel } from '@/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import { ExportStage, ExportConfig } from '@/types/pdf-export';
import { fetchTravel, fetchTravelBySlug } from '@/api/travelsApi';
import { BookHtmlExportService } from '@/services/book/BookHtmlExportService';
import { openBookPreviewWindow } from '@/utils/openBookPreviewWindow';

/**
 * React hook для экспорта путешествий в PDF
 * Тонкий слой над PdfExportService
 */
export function usePdfExport(selected: Travel[], config?: ExportConfig) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [currentStage, setCurrentStage] = useState<ExportStage>(ExportStage.VALIDATING);
  const [message, setMessage] = useState<string>('');
  const [substeps, setSubsteps] = useState<string[]>([]);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | undefined>();

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
  /**
   * Обновить прогресс с подэтапами
   */
  const updateProgress = useCallback((
    stage: ExportStage,
    progressValue: number,
    messageText?: string,
    substepsList?: string[],
    timeRemaining?: number
  ) => {
    if (isMountedRef.current) {
      setCurrentStage(stage);
      setProgress(progressValue);
      if (messageText) setMessage(messageText);
      if (substepsList) setSubsteps(substepsList);
      if (timeRemaining !== undefined) setEstimatedTimeRemaining(timeRemaining);
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
      typeof partial.travelAddress === 'undefined' ||
      typeof (partial as any).travel_image_url === 'undefined'
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
      
      const startTime = Date.now();

      try {
        // Этап 1: Валидация (0-5%)
        updateProgress(ExportStage.VALIDATING, 2, 'Проверка данных...', ['Проверка путешествий']);
        
        const travelsForExport = await loadDetailedTravels();
        if (!travelsForExport.length) {
          Alert.alert('Внимание', 'Выберите хотя бы одно путешествие для экспорта');
          return;
        }

        updateProgress(ExportStage.VALIDATING, 5, 'Данные проверены', ['Проверка путешествий ✓']);

        // Этап 2: Трансформация (5-10%)
        updateProgress(ExportStage.TRANSFORMING, 7, 'Подготовка контента...', [
          'Нормализация данных',
          'Сортировка путешествий',
        ]);

        // Этап 3: Генерация HTML (10-30%)
        updateProgress(ExportStage.GENERATING_HTML, 15, 'Генерация страниц...', [
          'Обложка',
          'Оглавление',
          `Путешествия (0/${travelsForExport.length})`,
        ]);

        const html = await htmlServiceRef.current.generateTravelsHtml(
          travelsForExport,
          settings
        );

        updateProgress(ExportStage.GENERATING_HTML, 30, 'Страницы сгенерированы', [
          'Обложка ✓',
          'Оглавление ✓',
          `Путешествия (${travelsForExport.length}/${travelsForExport.length}) ✓`,
        ]);

        // Этап 4: Загрузка изображений (30-70%)
        updateProgress(ExportStage.LOADING_IMAGES, 50, 'Загрузка изображений...', [
          'Обработка фотографий',
        ]);

        // Этап 5: Рендеринг (70-95%)
        updateProgress(ExportStage.RENDERING, 85, 'Создание PDF...', [
          'Финализация документа',
        ]);

        openBookPreviewWindow(html);

        // Вычисляем затраченное время
        const elapsedTime = Math.round((Date.now() - startTime) / 1000);

        if (isMountedRef.current) {
          updateProgress(ExportStage.COMPLETE, 100, `Готово! (${elapsedTime} сек)`, ['Документ создан ✓']);
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
    }, [loadDetailedTravels, updateProgress]);

  return useMemo(() => ({
    openPrintBook,
    isGenerating,
    progress,
    error,
    currentStage,
    message,
    substeps,
    estimatedTimeRemaining,
  }), [openPrintBook, isGenerating, progress, error, currentStage, message, substeps, estimatedTimeRemaining]);
}
