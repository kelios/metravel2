import { Alert, Platform } from 'react-native';

import type { MutableRefObject } from 'react';
import type { Travel } from '@/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import { ExportStage } from '@/types/pdf-export';
import type { ExportConfig } from '@/types/pdf-export';
import { fetchTravel, fetchTravelBySlug } from '@/api/travelDetailsQueries';
import { openWebWindow } from '@/utils/externalLinks';
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

async function getBookPreviewModule() {
  if (!bookPreviewWindowModulePromise) {
    bookPreviewWindowModulePromise = import('@/utils/openBookPreviewWindow');
  }
  return bookPreviewWindowModulePromise;
}

/**
 * Открывает окно предпросмотра синхронно (до async-работы), чтобы не попасть
 * под блокировку всплывающих окон. Показывает loading-экран. Возвращает Window или null.
 */
function openPendingPreviewWindow(): Window | null {
  if (typeof window === 'undefined') return null;
  try {
    const win = openWebWindow('about:blank');
    if (win) {
      try {
        win.document.open();
        win.document.write('<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Готовим книгу…</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f8f9fa;color:#1a1a1a}.card{border:1px solid #e5e7eb;border-radius:14px;padding:24px 32px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,0.08);text-align:center}.spinner{width:28px;height:28px;border:3px solid #e5e7eb;border-top-color:#e07840;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px}@keyframes spin{to{transform:rotate(360deg)}}.title{font-size:16px;font-weight:600;margin-bottom:4px}.sub{font-size:13px;color:#6b7280}</style></head><body><div class="card"><div class="spinner"></div><div class="title">Готовим печатную версию</div><div class="sub">Загрузка данных и изображений…</div></div></body></html>');
        win.document.close();
      } catch {
        // ignore write error — window is still usable
      }
    }
    return win;
  } catch {
    return null;
  }
}

async function openBookPreview(html: string, targetWindow?: Window | null): Promise<void> {
  const mod = await getBookPreviewModule();
  mod.openBookPreviewWindow(html, targetWindow ?? undefined);
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

  // Открываем окно СИНХРОННО (в контексте user-click), чтобы браузер не заблокировал popup.
  // Если не открылось — продолжаем, openBookPreview откроет через Blob URL.
  const pendingWindow = openPendingPreviewWindow();

  const htmlService = await getBookHtmlExportService();

  if (!isMountedRef.current) {
    if (pendingWindow && !pendingWindow.closed) pendingWindow.close();
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
      if (pendingWindow && !pendingWindow.closed) pendingWindow.close();
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

    await openBookPreview(html, pendingWindow);

    const elapsedTime = Math.round((Date.now() - startTime) / 1000);

    if (isMountedRef.current) {
      updateProgress(ExportStage.COMPLETE, 100, `Готово! (${elapsedTime} сек)`, ['Документ создан ✓']);
    }
  } catch (err) {
    if (pendingWindow && !pendingWindow.closed) pendingWindow.close();
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
