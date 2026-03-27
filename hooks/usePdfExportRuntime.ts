import { Alert, Platform } from 'react-native';

import type { MutableRefObject } from 'react';
import type { Travel } from '@/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import { ExportStage } from '@/types/pdf-export';
import type { ExportConfig } from '@/types/pdf-export';
import { fetchTravel, fetchTravelBySlug } from '@/api/travelDetailsQueries';
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
  config?: ExportConfig;
  travelCacheRef: MutableRefObject<Record<string | number, Travel>>;
  isMountedRef: MutableRefObject<boolean>;
  setIsGenerating: (value: boolean) => void;
  setError: (value: Error | null) => void;
  setCurrentStage: (value: ExportStage) => void;
  updateProgress: UpdateProgress;
};

let bookHtmlExportServicePromise: Promise<BookHtmlExportService> | null = null;
let bookPreviewWindowModulePromise: Promise<typeof import('@/utils/openBookPreviewWindow')> | null = null;
const DEFAULT_BATCH_SIZE = 3;
const DEFAULT_MAX_RETRIES = 2;

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

function isNonEmptyArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0;
}

function needsDetails(travel: Travel, settings: BookSettings) {
  const partial = travel as Partial<Travel>;
  const galleryIsReady = !settings.includeGallery || isNonEmptyArray(partial.gallery);
  const mapIsReady = !settings.includeMap || isNonEmptyArray(partial.travelAddress);

  return (
    typeof partial.description === 'undefined' ||
    typeof partial.recommendation === 'undefined' ||
    typeof partial.plus === 'undefined' ||
    typeof partial.minus === 'undefined' ||
    !galleryIsReady ||
    !mapIsReady ||
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
  settings: BookSettings,
  config: ExportConfig | undefined,
  travelCacheRef: MutableRefObject<Record<string | number, Travel>>,
  updateProgress?: UpdateProgress,
): Promise<Travel[]> {
  if (!selected?.length) return [];

  const batchSize = Math.max(1, config?.batchSize ?? DEFAULT_BATCH_SIZE);
  const maxRetries = Math.max(0, config?.maxRetries ?? DEFAULT_MAX_RETRIES);
  const results: Travel[] = [];

  for (let start = 0; start < selected.length; start += batchSize) {
    const batch = selected.slice(start, start + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (travel) => {
      const cacheKey = travel.id ?? travel.slug ?? travel.url;
      const cachedTravel = cacheKey ? travelCacheRef.current[cacheKey] : undefined;

      if (cachedTravel && !needsDetails(cachedTravel, settings)) {
        return mergeTravelData(travel, cachedTravel);
      }

      if (!needsDetails(travel, settings)) {
        if (cacheKey) {
          travelCacheRef.current[cacheKey] = travel;
        }
        return travel;
      }

      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
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
          if (attempt === maxRetries) {
            console.warn('[usePdfExport] Не удалось загрузить детали путешествия', travel.id, error);
            return travel;
          }
        }
      }
    }),
    );

    results.push(...batchResults);
    updateProgress?.(
      ExportStage.VALIDATING,
      Math.min(5, 2 + Math.round((results.length / selected.length) * 3)),
      'Проверка данных...',
      [`Путешествия (${results.length}/${selected.length})`],
    );
  }

  return results;
}

export async function runPdfExport({
  selected,
  settings,
  config,
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

    const travelsForExport = await loadDetailedTravels(selected, settings, config, travelCacheRef, updateProgress);
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
