import { Alert, Platform } from 'react-native';

import type { MutableRefObject } from 'react';
import type { Travel } from '@/types/types';
import type { BookSettings } from '@/components/export/BookSettingsModal';
import { ExportStage } from '@/types/pdf-export';
import type { ExportConfig } from '@/types/pdf-export';
import { fetchTravel, fetchTravelBySlug } from '@/api/travelDetailsQueries';
import type { BookExportFormat, BookExportSettingsPayload } from '@/api/bookExportApi';
import { downloadBookExportArtifact, requestServerBookExport } from '@/api/bookExportApi';
import type { BookHtmlExportService } from '@/services/book/BookHtmlExportService';
import { activePdfEntitlementSource } from '@/services/pdf-export/entitlement/PdfEntitlementSource';
import { translate as i18nT } from '@/i18n'


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
    bookHtmlExportServicePromise = Promise.resolve(import('@/services/book/BookHtmlExportService'))
      .then((mod) => new mod.BookHtmlExportService())
      .catch((e) => {
        bookHtmlExportServicePromise = null;
        throw e;
      });
  }

  return bookHtmlExportServicePromise;
}

async function getBookPreviewModule() {
  if (!bookPreviewWindowModulePromise) {
    bookPreviewWindowModulePromise = Promise.resolve(import('@/utils/openBookPreviewWindow')).catch((e) => {
      bookPreviewWindowModulePromise = null;
      throw e;
    });
  }
  return bookPreviewWindowModulePromise;
}

async function openBookPreview(html: string, targetWindow?: Window | null): Promise<void> {
  const mod = await getBookPreviewModule();
  mod.openBookPreviewWindow(html, targetWindow ?? undefined);
}

// #716/#713: canonical-путь экспорта = серверный async job (format:"pdf"); клиентский
// рантайм остаётся полноценным fallback'ом (на проде серверный PDF пока
// PDF_RENDERER_UNAVAILABLE — тогда весь путь работает как раньше).
const SERVER_BOOK_EXPORT_FORMAT: BookExportFormat = 'pdf';

function collectServerExportTravelIds(selected: Travel[]): number[] | null {
  const ids: number[] = [];
  for (const travel of selected) {
    const id = Number(travel.id);
    if (!Number.isFinite(id) || id <= 0) return null;
    ids.push(id);
  }
  return ids.length ? ids : null;
}

function toServerBookSettings(settings: BookSettings): BookExportSettingsPayload {
  return {
    template: settings.template,
    include_gallery: settings.includeGallery,
    include_map: settings.includeMap,
    include_toc: settings.includeToc,
  };
}

function saveArtifactBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  }
}

// true = серверный экспорт доставил артефакт; false = любой отказ (capability,
// сетевые ошибки, failed job, таймаут) — работает текущий клиентский рантайм.
async function tryServerBookExport(
  selected: Travel[],
  settings: BookSettings,
  updateProgress: UpdateProgress,
): Promise<boolean> {
  const travelIds = collectServerExportTravelIds(selected);
  if (!travelIds) return false;

  try {
    const job = await requestServerBookExport({
      travelIds,
      settings: toServerBookSettings(settings),
      format: SERVER_BOOK_EXPORT_FORMAT,
    });
    if (!job) return false;

    updateProgress(ExportStage.RENDERING, 90, i18nT('export:hooks.usePdfExportRuntime.skachivanie_gotovoy_knigi_fe0424ef'), [
      i18nT('export:hooks.usePdfExportRuntime.servernyy_eksport_d0e26c9d'),
    ]);
    const artifact = await downloadBookExportArtifact(job);
    if (artifact.contentType?.includes('text/html')) {
      await openBookPreview(await artifact.blob.text());
    } else {
      saveArtifactBlob(
        artifact.blob,
        artifact.filename || `metravel-book-${job.job_id}.${SERVER_BOOK_EXPORT_FORMAT}`,
      );
    }
    return true;
  } catch (error) {
    console.warn('[usePdfExport] Серверный экспорт недоступен, используем клиентский рантайм', error);
    return false;
  }
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
      const cachedTravel = cacheKey != null ? travelCacheRef.current[cacheKey] : undefined;

      if (cachedTravel && !needsDetails(cachedTravel, settings)) {
        return mergeTravelData(travel, cachedTravel);
      }

      if (!needsDetails(travel, settings)) {
        if (cacheKey != null) {
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
          if (cacheKey != null) {
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

      return travel;
    }),
    );

    results.push(...batchResults);
    updateProgress?.(
      ExportStage.VALIDATING,
      Math.min(5, 2 + Math.round((results.length / selected.length) * 3)),
      i18nT('export:hooks.usePdfExportRuntime.proverka_dannyh_59cc6efe'),
      [i18nT('export:hooks.usePdfExportRuntime.puteshestviya_value1_value2_5f60a9bd', { value1: results.length, value2: selected.length })],
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
      i18nT('export:hooks.usePdfExportRuntime.nedostupno_33f2b2de'),
      i18nT('export:hooks.usePdfExportRuntime.prosmotr_knigi_i_pechat_dostupny_tolko_v_veb_8f59a809'),
    );
    return;
  }

  setIsGenerating(true);
  setError(null);

  const startTime = Date.now();

  try {
    updateProgress(ExportStage.VALIDATING, 2, i18nT('export:hooks.usePdfExportRuntime.proverka_dannyh_59cc6efe'), [i18nT('export:hooks.usePdfExportRuntime.proverka_puteshestviy_aee0e81c')]);

    if (await tryServerBookExport(selected, settings, updateProgress)) {
      const elapsedTime = Math.round((Date.now() - startTime) / 1000);
      if (isMountedRef.current) {
        updateProgress(ExportStage.COMPLETE, 100, i18nT('export:hooks.usePdfExportRuntime.gotovo_value1_sek_32520275', { value1: elapsedTime }), [i18nT('export:hooks.usePdfExportRuntime.dokument_sozdan_67abc478')]);
      }
      return;
    }

    const htmlService = await getBookHtmlExportService();

    if (!isMountedRef.current) {
      Alert.alert(i18nT('export:hooks.usePdfExportRuntime.oshibka_488ce4fc'), i18nT('export:hooks.usePdfExportRuntime.predprosmotr_knigi_nedostupen_7f86d03a'));
      return;
    }

    const travelsForExport = await loadDetailedTravels(selected, settings, config, travelCacheRef, updateProgress);
    if (!travelsForExport.length) {
      Alert.alert(i18nT('export:hooks.usePdfExportRuntime.vnimanie_9c60f2f4'), i18nT('export:hooks.usePdfExportRuntime.vyberite_hotya_by_odno_puteshestvie_dlya_eks_f99df420'));
      return;
    }

    const isPremium = activePdfEntitlementSource.getIsPremium();

    updateProgress(ExportStage.VALIDATING, 5, i18nT('export:hooks.usePdfExportRuntime.dannye_provereny_5a8fde8e'), [i18nT('export:hooks.usePdfExportRuntime.proverka_puteshestviy_9adc24e8')]);
    updateProgress(ExportStage.TRANSFORMING, 7, i18nT('export:hooks.usePdfExportRuntime.podgotovka_kontenta_eee24f1a'), [
      i18nT('export:hooks.usePdfExportRuntime.normalizatsiya_dannyh_6f8652c4'),
      i18nT('export:hooks.usePdfExportRuntime.sortirovka_puteshestviy_deff53ee'),
    ]);
    updateProgress(ExportStage.GENERATING_HTML, 15, i18nT('export:hooks.usePdfExportRuntime.generatsiya_stranits_a090c210'), [
      i18nT('export:hooks.usePdfExportRuntime.oblozhka_23ce81a0'),
      i18nT('export:hooks.usePdfExportRuntime.oglavlenie_e901879a'),
      i18nT('export:hooks.usePdfExportRuntime.puteshestviya_0_value1_4b5537f8', { value1: travelsForExport.length }),
    ]);

    const html = await htmlService.generateTravelsHtml(travelsForExport, settings, { isPremium });

    updateProgress(ExportStage.GENERATING_HTML, 30, i18nT('export:hooks.usePdfExportRuntime.stranitsy_sgenerirovany_882dd947'), [
      i18nT('export:hooks.usePdfExportRuntime.oblozhka_e5e8ac7b'),
      i18nT('export:hooks.usePdfExportRuntime.oglavlenie_48edcef4'),
      i18nT('export:hooks.usePdfExportRuntime.puteshestviya_value1_value2_e3f09fc3', { value1: travelsForExport.length, value2: travelsForExport.length }),
    ]);
    updateProgress(ExportStage.LOADING_IMAGES, 50, i18nT('export:hooks.usePdfExportRuntime.zagruzka_izobrazheniy_77a50e30'), [
      i18nT('export:hooks.usePdfExportRuntime.obrabotka_fotografiy_753bf7ed'),
    ]);
    updateProgress(ExportStage.RENDERING, 85, i18nT('export:hooks.usePdfExportRuntime.sozdanie_pdf_8f661cc0'), [
      i18nT('export:hooks.usePdfExportRuntime.finalizatsiya_dokumenta_bd98e906'),
    ]);

    await openBookPreview(html);

    const elapsedTime = Math.round((Date.now() - startTime) / 1000);

    if (isMountedRef.current) {
      updateProgress(ExportStage.COMPLETE, 100, i18nT('export:hooks.usePdfExportRuntime.gotovo_value1_sek_32520275', { value1: elapsedTime }), [i18nT('export:hooks.usePdfExportRuntime.dokument_sozdan_67abc478')]);
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (isMountedRef.current) {
      setError(error);
      Alert.alert(i18nT('export:hooks.usePdfExportRuntime.oshibka_488ce4fc'), error.message);
      setCurrentStage(ExportStage.ERROR);
    }
  } finally {
    if (isMountedRef.current) {
      setIsGenerating(false);
    }
  }
}
