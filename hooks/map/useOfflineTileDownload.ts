// hooks/map/useOfflineTileDownload.ts
// Фаза 1 офлайн-карт: скачивание тайлов текущей области на диск с троттлингом.
// Native-only (web использует кэш браузера/сети). Тайлы и реестр регионов живут
// в utils/mapTileCache.ts.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getThemedNativeBaseTileUrl } from '@/config/mapWebLayers';
import { translate as i18nT } from '@/i18n';
import { fetchOfflineMapPoints } from '@/api/mapOffline';
import { saveMapRegionOffline } from '@/services/offline/mapOfflineAdapter';
import {
  AVG_TILE_BYTES,
  deleteDownloadedTiles,
  deleteRegion,
  downloadTileToDisk,
  enumerateTiles,
  estimateTiles,
  planOfflineZoomRange,
  registerRegion,
  type OfflineBBox,
  type OfflineZoomPlan,
} from '@/utils/mapTileCache';

export type OfflineTileDownloadState = 'idle' | 'estimating' | 'downloading' | 'done' | 'error';

export interface OfflineTileProgress {
  done: number;
  total: number;
}

export interface DownloadRegionOptions {
  minZ?: number;
  maxZ?: number;
  name?: string;
}

// #807: nginx zone=general режет бурст запросов к /proxy/tiles → 429/серые тайлы.
// Держим низкую конкурентность и паузу между тайлами.
const CONCURRENCY = 2;
const THROTTLE_MS = 60;
// Защита от «скачать весь мир»: при слишком большом bbox/зуме не начинаем.
const MAX_TILES = 4000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const buildTileUrl = (template: string, z: number, x: number, y: number): string =>
  template
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));

export interface UseOfflineTileDownload {
  state: OfflineTileDownloadState;
  progress: OfflineTileProgress;
  /** Оценка размера региона в байтах (tiles × средний вес тайла). */
  estimateBytes: (bbox: OfflineBBox, minZ: number, maxZ: number) => number;
  estimateTileCount: (bbox: OfflineBBox, minZ: number, maxZ: number) => number;
  /**
   * Подбирает диапазон зумов под бюджет `MAX_TILES`: срезает детализацию вместо
   * отказа. `null` — область не влезает даже на базовом зуме.
   */
  planZoomRange: (bbox: OfflineBBox, minZ: number, maxZ: number) => OfflineZoomPlan | null;
  maxTiles: number;
  downloadCurrentRegion: (bbox: OfflineBBox, options?: DownloadRegionOptions) => Promise<void>;
  cancel: () => void;
  reset: () => void;
}

export function useOfflineTileDownload(): UseOfflineTileDownload {
  const [state, setState] = useState<OfflineTileDownloadState>('idle');
  const [progress, setProgress] = useState<OfflineTileProgress>({ done: 0, total: 0 });
  const cancelRef = useRef(false);
  const activeAbortRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelRef.current = true;
      activeAbortRef.current?.abort();
    };
  }, []);

  const estimateBytes = useCallback(
    (bbox: OfflineBBox, minZ: number, maxZ: number): number =>
      estimateTiles(bbox, minZ, maxZ) * AVG_TILE_BYTES,
    [],
  );

  const estimateTileCount = useCallback(
    (bbox: OfflineBBox, minZ: number, maxZ: number): number => estimateTiles(bbox, minZ, maxZ),
    [],
  );

  const planZoomRange = useCallback(
    (bbox: OfflineBBox, minZ: number, maxZ: number): OfflineZoomPlan | null =>
      planOfflineZoomRange(bbox, minZ, maxZ, MAX_TILES),
    [],
  );

  const cancel = useCallback(() => {
    cancelRef.current = true;
    activeAbortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    if (runningRef.current) return;
    setState('idle');
    setProgress({ done: 0, total: 0 });
  }, []);

  const downloadCurrentRegion = useCallback(
    async (bbox: OfflineBBox, options?: DownloadRegionOptions): Promise<void> => {
      if (runningRef.current) return;
      const minZ = options?.minZ ?? 10;
      const maxZ = options?.maxZ ?? 16;

      runningRef.current = true;
      cancelRef.current = false;
      setState('estimating');
      setProgress({ done: 0, total: 0 });

      const tiles = enumerateTiles(bbox, minZ, maxZ);
      if (tiles.length === 0 || tiles.length > MAX_TILES) {
        runningRef.current = false;
        if (mountedRef.current) setState('error');
        return;
      }

      const downloadedTiles: typeof tiles = [];
      try {
        const abortController = new AbortController();
        activeAbortRef.current = abortController;
        // Точки — часть того же пакета. Если индекс не получен, регион нельзя
        // объявлять готовым даже при полностью скачанной подложке.
        const pointIndex = await fetchOfflineMapPoints(bbox, { signal: abortController.signal });
        if (cancelRef.current) throw Object.assign(new Error('Aborted'), { name: 'AbortError' });

        if (mountedRef.current) {
          setState('downloading');
          setProgress({ done: 0, total: tiles.length });
        }

        const template = getThemedNativeBaseTileUrl();
        let bytes = 0;
        let doneCount = 0;
        let failedCount = 0;
        let cursor = 0;

        const worker = async (): Promise<void> => {
          for (;;) {
            if (cancelRef.current || failedCount > 0) return;
            const index = cursor;
            cursor += 1;
            if (index >= tiles.length) return;
            const tile = tiles[index];
            const url = buildTileUrl(template, tile.z, tile.x, tile.y);
            const written = await downloadTileToDisk(tile.z, tile.x, tile.y, url);
            if (written == null) {
              failedCount += 1;
              return;
            }
            bytes += written;
            downloadedTiles.push(tile);
            doneCount += 1;
            if (mountedRef.current) setProgress({ done: doneCount, total: tiles.length });
            await sleep(THROTTLE_MS);
          }
        };

        await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

        if (cancelRef.current) {
          await deleteDownloadedTiles(downloadedTiles);
          if (mountedRef.current) setState('idle');
          return;
        }
        if (failedCount > 0 || doneCount !== tiles.length) {
          throw new Error('OFFLINE_MAP_TILE_DOWNLOAD_INCOMPLETE');
        }

        const region = {
          id: `region-${Date.now()}`,
          name: options?.name ?? i18nT('map:hooks.map.useOfflineTileDownload.oblast_karty_72ba6f3a'),
          bbox,
          minZ,
          maxZ,
          tileCount: tiles.length,
          bytes,
          savedAt: Date.now(),
        };
        await registerRegion(region);
        try {
          await saveMapRegionOffline(region, pointIndex.points, pointIndex.etag);
        } catch (error) {
          await deleteRegion(region.id);
          throw error;
        }

        if (mountedRef.current) setState('done');
      } catch (error) {
        await deleteDownloadedTiles(downloadedTiles);
        const aborted = cancelRef.current || (error as { name?: string })?.name === 'AbortError';
        if (mountedRef.current) setState(aborted ? 'idle' : 'error');
      } finally {
        activeAbortRef.current = null;
        runningRef.current = false;
      }
    },
    [],
  );

  return {
    state,
    progress,
    estimateBytes,
    estimateTileCount,
    planZoomRange,
    maxTiles: MAX_TILES,
    downloadCurrentRegion,
    cancel,
    reset,
  };
}
