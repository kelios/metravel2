/**
 * #2453 — RN-сторона каналов данных native-карты (`Map.ios.tsx`, iOS + Android).
 *
 * Вместо одного снимка `__metravelRenderPoints(payload)` на любое изменение
 * каждый канал живёт своим эффектом по своей зависимости:
 *   центр      → `__metravelSetCenter({lat, lng})`;
 *   маршрут    → `__metravelSetRoute(route)` (дедуп по сериализованной строке);
 *   кластеры   → `__metravelSetClusters({add, removeKeys, reset?})`;
 *   маркеры    → `__metravelSetMarkers({add, removeKeys, reset?, pointsOnly, usesServerClusters})`.
 * Смена центра или токена замены маршрута больше не пересериализует маркеры, а
 * новый ответ кластеров — точки. Порядок эффектов (центр → маршрут → кластеры →
 * маркеры) важен: стартовое позиционирование в WebView выполняет канал маркеров
 * и должно видеть остальные данные.
 */
import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';

import { serializeForInlineScript } from '@/utils/webViewBridge';
import {
  diffNativeKeyedItems,
  isEmptyNativePatch,
  nativeClusterKey,
  nativeClusterSignature,
  nativeMarkerKey,
  nativeMarkerSignature,
} from './nativeMarkerDiff';
import type { NativeClusterPayloadItem, NativeMarkerPayloadItem } from './nativeMarkerPayload';

export interface NativeMapRoutePayload {
  mode: 'radius' | 'route';
  routePoints: [number, number][];
  routePointMarkers: unknown;
  routeLine: [number, number][];
  routeApproximate: boolean;
  originalTrackSegments: [number, number][][];
  routePointsInteractive: boolean;
  routeReplacementToken: number | undefined;
}

export interface NativeMapChannelsOptions {
  injectMapCommand: (script: string) => void;
  isReadyRef: MutableRefObject<boolean>;
  markers: NativeMarkerPayloadItem[];
  clusters: NativeClusterPayloadItem[];
  pointsOnly: boolean;
  usesServerClusters: boolean;
  route: NativeMapRoutePayload;
  centerLat: number;
  centerLng: number;
}

export interface NativeMapChannels {
  /** WebView готов: досылаем все каналы (повторная готовность — пустые патчи). */
  pushAll: () => void;
  /** Страница WebView перезагружена: всё отправленное раньше потеряно. */
  resetSentState: () => void;
}

export const useNativeMapChannels = ({
  injectMapCommand,
  isReadyRef,
  markers,
  clusters,
  pointsOnly,
  usesServerClusters,
  route,
  centerLat,
  centerLng,
}: NativeMapChannelsOptions): NativeMapChannels => {
  // null — в текущую страницу ещё ничего не отправлено.
  const sentMarkersRef = useRef<Map<string, string> | null>(null);
  const sentMarkerMetaRef = useRef<string | null>(null);
  const sentClustersRef = useRef<Map<string, string> | null>(null);
  const sentRouteRef = useRef<string | null>(null);
  const sentCenterRef = useRef<string | null>(null);

  const latestRef = useRef({ markers, clusters, pointsOnly, usesServerClusters, route, centerLat, centerLng });
  latestRef.current = { markers, clusters, pointsOnly, usesServerClusters, route, centerLat, centerLng };

  const pushCenter = useCallback(() => {
    if (!isReadyRef.current) return;
    const { centerLat: lat, centerLng: lng } = latestRef.current;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const serialized = JSON.stringify({ lat, lng });
    if (serialized === sentCenterRef.current) return;
    sentCenterRef.current = serialized;
    injectMapCommand(`window.__metravelSetCenter && window.__metravelSetCenter(${serialized})`);
  }, [injectMapCommand, isReadyRef]);

  const pushRoute = useCallback(() => {
    if (!isReadyRef.current) return;
    const serialized = serializeForInlineScript(latestRef.current.route);
    if (serialized === sentRouteRef.current) return;
    sentRouteRef.current = serialized;
    injectMapCommand(`window.__metravelSetRoute && window.__metravelSetRoute(${serialized})`);
  }, [injectMapCommand, isReadyRef]);

  const pushClusters = useCallback(() => {
    if (!isReadyRef.current) return;
    const reset = sentClustersRef.current === null;
    const { patch, nextSent } = diffNativeKeyedItems(
      sentClustersRef.current ?? new Map(),
      latestRef.current.clusters,
      nativeClusterKey,
      nativeClusterSignature,
    );
    sentClustersRef.current = nextSent;
    if (!reset && isEmptyNativePatch(patch)) return;
    const body = reset ? { add: patch.add, removeKeys: [], reset: true } : patch;
    injectMapCommand(`window.__metravelSetClusters && window.__metravelSetClusters(${serializeForInlineScript(body)})`);
  }, [injectMapCommand, isReadyRef]);

  const pushMarkers = useCallback(() => {
    if (!isReadyRef.current) return;
    const latest = latestRef.current;
    const reset = sentMarkersRef.current === null;
    const meta = `${latest.pointsOnly ? 1 : 0}|${latest.usesServerClusters ? 1 : 0}`;
    const { patch, nextSent } = diffNativeKeyedItems(
      sentMarkersRef.current ?? new Map(),
      latest.markers,
      nativeMarkerKey,
      nativeMarkerSignature,
    );
    sentMarkersRef.current = nextSent;
    if (!reset && isEmptyNativePatch(patch) && meta === sentMarkerMetaRef.current) return;
    sentMarkerMetaRef.current = meta;
    const body = {
      add: patch.add,
      removeKeys: reset ? [] : patch.removeKeys,
      ...(reset ? { reset: true } : null),
      pointsOnly: latest.pointsOnly,
      usesServerClusters: latest.usesServerClusters,
    };
    injectMapCommand(`window.__metravelSetMarkers && window.__metravelSetMarkers(${serializeForInlineScript(body)})`);
  }, [injectMapCommand, isReadyRef]);

  // Порядок эффектов = порядок отправки на обычных обновлениях (см. шапку).
  useEffect(() => {
    pushCenter();
  }, [centerLat, centerLng, pushCenter]);

  useEffect(() => {
    pushRoute();
  }, [route, pushRoute]);

  useEffect(() => {
    pushClusters();
  }, [clusters, pushClusters]);

  useEffect(() => {
    pushMarkers();
  }, [markers, pointsOnly, usesServerClusters, pushMarkers]);

  const pushAll = useCallback(() => {
    pushCenter();
    pushRoute();
    pushClusters();
    pushMarkers();
  }, [pushCenter, pushClusters, pushMarkers, pushRoute]);

  const resetSentState = useCallback(() => {
    sentMarkersRef.current = null;
    sentMarkerMetaRef.current = null;
    sentClustersRef.current = null;
    sentRouteRef.current = null;
    sentCenterRef.current = null;
  }, []);

  return { pushAll, resetSentState };
};
