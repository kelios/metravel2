/**
 * #2452 — RN-сторона подложки native-карты (`Map.ios.tsx`, iOS + Android).
 *
 * В онлайне тайлы грузит сам WebView; RN отвечает только за:
 *   * мостовой fallback — `TILE_REQ` после сетевой ошибки тайла или в офлайне:
 *     диск → (онлайн) скачивание с ретраями #1561 → батч-ответ
 *     `__metravelSetTiles` не чаще раза в кадр, очередь LIFO с отменой
 *     (`TILE_CANCEL`) и отбрасыванием тайлов прежнего зума;
 *   * сетевой режим слоя — `__metravelSetTileNetwork(online)`; переход
 *     офлайн → онлайн делает в WebView ровно один `redraw()` (#1665);
 *   * наполнение дискового кэша БЕЗ второй сетевой загрузки: после того как
 *     слой догрузил вьюпорт (`MAP_TILES_STATE`), RN просит WebView снять
 *     недостающие в кэше тайлы из уже загруженных картинок
 *     (`__metravelCaptureTiles`) и пишет ответы `TILE_CAPTURE` в файлы — без
 *     инжекта обратно. Офлайн-просмотр ранее увиденных областей сохраняется,
 *     трафик мобильного интернета не удваивается.
 */
import { useCallback, useEffect, useMemo, useRef, type MutableRefObject } from 'react';

import {
  downloadTileToDisk,
  getCachedTileDataUrl,
  hasFreshCachedTile,
  listViewportTiles,
  writeTileDataUrlToDisk,
} from '@/utils/mapTileCache';
import type { NativeTileStateSnapshot } from './nativeBridge';
import {
  createNativeTileBatchInjector,
  createNativeTileFallbackQueue,
  parseNativeTileCaptureEntry,
  planNativeTileCapture,
  type NativeTileCoord,
  type NativeTileFallbackRequest,
} from './nativeTileFallbackQueue';
import { fetchTileWithRetry } from './tileFetchRetry';

/** Одновременных запросов fallback (диск/сеть). #807: nginx-зона режет бурст. */
const FALLBACK_CONCURRENCY = 4;
/** Потолок тайлов одного захвата: один экран телефона с запасом. */
const CAPTURE_MAX_TILES = 48;

const scheduleFrame = (flush: () => void): void => {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => flush());
    return;
  }
  setTimeout(flush, 16);
};

const tileUrl = (template: string, { z, x, y }: NativeTileCoord): string =>
  template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));

export interface NativeTileBridgeOptions {
  injectMapCommand: (script: string) => void;
  isReadyRef: MutableRefObject<boolean>;
  isConnected: boolean;
  tileTemplate: string;
  /** Тайл из моста отрисован — снимаем индикатор загрузки (#1773). */
  onTileDelivered: () => void;
}

export interface NativeTileBridge {
  handleTileRequest: (request: NativeTileFallbackRequest) => void;
  handleTileCancel: (keys: readonly string[]) => void;
  /** Слой догрузил вьюпорт: планируем захват недостающих тайлов в кэш. */
  handleTilesState: (state: NativeTileStateSnapshot) => void;
  /** Пакет снятых WebView тайлов → файлы кэша (без инжекта обратно). */
  handleTileCapture: (gen: number | null, tiles: readonly unknown[]) => void;
  /** Canvas «грязный»: захват выключен до перезапуска карты. */
  handleCaptureDisabled: (reason: string) => void;
  /** WebView готов: досылаем текущий сетевой режим. */
  handleReady: () => void;
  /** Страница WebView перезагружена: ключи прежнего документа мертвы. */
  resetPage: () => void;
}

export const useNativeTileBridge = ({
  injectMapCommand,
  isReadyRef,
  isConnected,
  tileTemplate,
  onTileDelivered,
}: NativeTileBridgeOptions): NativeTileBridge => {
  // Онлайн-статус держим в ref: async-обработчики не должны читать устаревшее
  // замыкание. Default true до первого ответа NetInfo — онлайн-путь.
  const isOnlineRef = useRef(isConnected);
  isOnlineRef.current = isConnected;
  const onTileDeliveredRef = useRef(onTileDelivered);
  onTileDeliveredRef.current = onTileDelivered;
  // null — в текущую страницу режим ещё не отправлялся (свежая страница онлайн).
  const sentNetworkRef = useRef<boolean | null>(null);
  const previousConnectedRef = useRef(isConnected);
  // Переход офлайн → онлайн случился до готовности WebView (#1665): страница
  // могла уже набрать серых клеток в онлайн-режиме, redraw нужен принудительно.
  const pendingRedrawRef = useRef(false);
  // Поколение захвата: новый `load` слоя делает прежний план устаревшим.
  const captureGenRef = useRef(0);
  const captureDisabledRef = useRef(false);

  const machinery = useMemo(() => {
    const batch = createNativeTileBatchInjector({ inject: injectMapCommand, schedule: scheduleFrame });
    const queue = createNativeTileFallbackQueue({
      concurrency: FALLBACK_CONCURRENCY,
      resolve: async (request) => {
        const { z, x, y } = request;
        const cached = await getCachedTileDataUrl(z, x, y);
        if (cached) return cached;
        // Офлайн и нет в кэше → пустой тайл (документированная политика: без
        // сети догружать нечего, bulk-предзагрузка OSM запрещена).
        if (!isOnlineRef.current) return '';
        // #1561 — одна неудача сети не должна навсегда оставлять серую клетку.
        const ok = await fetchTileWithRetry({
          download: () => downloadTileToDisk(z, x, y, tileUrl(tileTemplate, request)),
          isOnline: () => isOnlineRef.current,
          wait: (ms) => new Promise<void>((resolve) => { setTimeout(resolve, ms); }),
        });
        if (!ok) return '';
        return (await getCachedTileDataUrl(z, x, y)) ?? '';
      },
      deliver: (key, dataUrl) => {
        if (dataUrl) onTileDeliveredRef.current();
        batch.push(key, dataUrl);
      },
    });
    return { batch, queue };
  }, [injectMapCommand, tileTemplate]);

  const pushNetworkMode = useCallback(() => {
    if (!isReadyRef.current) return;
    const online = isOnlineRef.current;
    const forceRedraw = online && pendingRedrawRef.current;
    if (online) pendingRedrawRef.current = false;
    if (!forceRedraw) {
      if (sentNetworkRef.current === online) return;
      if (sentNetworkRef.current === null && online) {
        // Свежая страница и так в онлайн-режиме — команда была бы пустой.
        sentNetworkRef.current = true;
        return;
      }
    }
    sentNetworkRef.current = online;
    injectMapCommand(
      `window.__metravelSetTileNetwork && window.__metravelSetTileNetwork(${online ? 'true' : 'false'}${forceRedraw ? ', true' : ''})`,
    );
  }, [injectMapCommand, isReadyRef]);

  // Смена сети: WebView переключает режим слоя; офлайн → онлайн там же даёт
  // ровно один redraw серых клеток без пересоздания WebView (#1665).
  useEffect(() => {
    const wasConnected = previousConnectedRef.current;
    previousConnectedRef.current = isConnected;
    if (!wasConnected && isConnected && !isReadyRef.current) pendingRedrawRef.current = true;
    pushNetworkMode();
  }, [isConnected, isReadyRef, pushNetworkMode]);

  useEffect(
    () => () => {
      captureGenRef.current += 1;
      machinery.queue.clear();
      machinery.batch.clear();
    },
    [machinery],
  );

  const handleTileRequest = useCallback(
    (request: NativeTileFallbackRequest) => machinery.queue.enqueue(request),
    [machinery],
  );

  const handleTileCancel = useCallback(
    (keys: readonly string[]) => machinery.queue.cancel(keys),
    [machinery],
  );

  const handleTilesState = useCallback(
    (state: NativeTileStateSnapshot) => {
      captureGenRef.current += 1;
      const gen = captureGenRef.current;
      const viewport = state.viewport;
      if (captureDisabledRef.current || !state.online || !viewport || !isReadyRef.current) return;
      const tiles = listViewportTiles(viewport.bbox, viewport.zoom, CAPTURE_MAX_TILES);
      void planNativeTileCapture({
        tiles,
        hasFresh: ({ z, x, y }) => hasFreshCachedTile(z, x, y),
      }).then((missing) => {
        if (gen !== captureGenRef.current || captureDisabledRef.current || !missing.length) return;
        injectMapCommand(
          `window.__metravelCaptureTiles && window.__metravelCaptureTiles(${JSON.stringify(missing)}, ${gen})`,
        );
      });
    },
    [injectMapCommand, isReadyRef],
  );

  const handleTileCapture = useCallback((gen: number | null, tiles: readonly unknown[]) => {
    if (gen !== captureGenRef.current) return;
    tiles.forEach((entry) => {
      const tile = parseNativeTileCaptureEntry(entry);
      if (tile) void writeTileDataUrlToDisk(tile.z, tile.x, tile.y, tile.dataUrl);
    });
  }, []);

  const handleCaptureDisabled = useCallback((reason: string) => {
    if (captureDisabledRef.current) return;
    captureDisabledRef.current = true;
    console.warn('[map-tiles] tile capture disabled until restart:', reason || 'SecurityError');
  }, []);

  const resetPage = useCallback(() => {
    sentNetworkRef.current = null;
    captureGenRef.current += 1;
    machinery.queue.clear();
    machinery.batch.clear();
  }, [machinery]);

  return {
    handleTileRequest,
    handleTileCancel,
    handleTilesState,
    handleTileCapture,
    handleCaptureDisabled,
    handleReady: pushNetworkMode,
    resetPage,
  };
};
