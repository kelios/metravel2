import { Alert, Platform } from 'react-native';

import type { MutableRefObject } from 'react';
import type { Travel } from '@/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import { ExportStage } from '@/types/pdf-export';
import { fetchTravel, fetchTravelBySlug } from '@/api/travelsApi';
import type { BookHtmlExportService } from '@/services/book/BookHtmlExportService';

type UpdateProgress = (
  stage: ExportStage,
  progressValue: number,
  messageText?: string,
  substepsList?: string[],
  timeRemaining?: number,
) => void;

type RunPdfExportOptions = {
  selected: Travel[];
  settings: BookSettings;
  travelCacheRef: MutableRefObject<Record<string | number, Travel>>;
  isMountedRef: MutableRefObject<boolean>;
  setIsGenerating: (value: boolean) => void;
  setError: (value: Error | null) => void;
  setCurrentStage: (value: ExportStage) => void;
  updateProgress: UpdateProgress;
};

let bookHtmlExportServicePromise: Promise<BookHtmlExportService> | null = null;
let bookPreviewWindowModulePromise: Promise<typeof import('@/utils/openBookPreviewWindow')> | null = null;

async function getBookHtmlExportService(): Promise<BookHtmlExportService> {
  if (!bookHtmlExportServicePromise) {
    bookHtmlExportServicePromise = import('@/services/book/BookHtmlExportService').then(
      (mod) => new mod.BookHtmlExportService(),
    );
  }

  return bookHtmlExportServicePromise;
}

async function openBookPreview(html: string): Promise<void> {
  if (!bookPreviewWindowModulePromise) {
    bookPreviewWindowModulePromise = import('@/utils/openBookPreviewWindow');
  }

  const mod = await bookPreviewWindowModulePromise;
  mod.openBookPreviewWindow(html);
}

export async function prewarmPdfExportRuntime(): Promise<void> {
  const canUseDom = typeof document !== 'undefined';
  if (Platform.OS !== 'web' && !canUseDom) {
    return;
  }

  await getBookHtmlExportService();
}

function needsDetails(travel: Travel) {
  const partial = travel as Partial<Travel>;
  return (
    typeof partial.description === 'undefined' ||
    typeof partial.recommendation === 'undefined' ||
    typeof partial.plus === 'undefined' ||
    typeof partial.minus === 'undefined' ||
    typeof partial.gallery === 'undefined' ||
    typeof partial.travelAddress === 'undefined' ||
    typeof (partial as unknown as { travel_image_url?: string }).travel_image_url === 'undefined'
  );
}

function mergeTravelData(base: Travel, detailed: Travel): Travel {
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
}

async function loadDetailedTravels(
  selected: Travel[],
  travelCacheRef: MutableRefObject<Record<string | number, Travel>>,
): Promise<Travel[]> {
  if (!selected?.length) return [];

  return Promise.all(
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
    }),
  );
}

export async function runPdfExport({
  selected,
  settings,
  travelCacheRef,
  isMountedRef,
  setIsGenerating,
  setError,
  setCurrentStage,
  updateProgress,
}: RunPdfExportOptions): Promise<void> {
  if (Platform.OS !== 'web') {
    Alert.alert(
      'Недоступно',
      'Просмотр книги и печать доступны только в веб-версии MeTravel',
    );
    return;
  }

  const htmlService = await getBookHtmlExportService();

  if (!isMountedRef.current) {
    Alert.alert('Ошибка', 'Предпросмотр книги недоступен');
    return;
  }

  setIsGenerating(true);
  setError(null);

  const startTime = Date.now();

  try {
    updateProgress(ExportStage.VALIDATING, 2, 'Проверка данных...', ['Проверка путешествий']);

    const travelsForExport = await loadDetailedTravels(selected, travelCacheRef);
    if (!travelsForExport.length) {
      Alert.alert('Внимание', 'Выберите хотя бы одно путешествие для экспорта');
      return;
    }

    updateProgress(ExportStage.VALIDATING, 5, 'Данные проверены', ['Проверка путешествий ✓']);
    updateProgress(ExportStage.TRANSFORMING, 7, 'Подготовка контента...', [
      'Нормализация данных',
      'Сортировка путешествий',
    ]);
    updateProgress(ExportStage.GENERATING_HTML, 15, 'Генерация страниц...', [
      'Обложка',
      'Оглавление',
      `Путешествия (0/${travelsForExport.length})`,
    ]);

    const html = await htmlService.generateTravelsHtml(travelsForExport, settings);

    updateProgress(ExportStage.GENERATING_HTML, 30, 'Страницы сгенерированы', [
      'Обложка ✓',
      'Оглавление ✓',
      `Путешествия (${travelsForExport.length}/${travelsForExport.length}) ✓`,
    ]);
    updateProgress(ExportStage.LOADING_IMAGES, 50, 'Загрузка изображений...', [
      'Обработка фотографий',
    ]);
    updateProgress(ExportStage.RENDERING, 85, 'Создание PDF...', [
      'Финализация документа',
    ]);

    await openBookPreview(html);

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
}
