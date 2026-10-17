/**
 * mapViewportCoverage — общий контракт «вьюпорт уже покрыт» для web и native (#2450).
 *
 * Карта публикует новый snapshot вьюпорта (и тем самым новый queryKey серверных
 * кластеров) только когда видимая область ВЫШЛА за уже загруженную с запасом
 * область или сменился округлённый зум. До #2450 этот контракт жил только в web-хуке
 * `useMapViewportSnapshot`; native-приёмник `MAP_VIEWPORT` клал каждый сдвиг в state
 * и слал запрос почти на каждый pan. Чистые функции здесь не зависят от Leaflet и
 * React, чтобы оба рендерера и их unit-тесты использовали одну и ту же математику.
 *
 * Дополнительно bbox запроса привязывается к тайловой сетке зума
 * (`snapBBoxToTileGrid`): ключ кэша для одного и того же района совпадает между
 * визитами (zoom in → zoom out, возврат на экран), а не промахивается на каждую
 * тысячную градуса.
 */
import type { MapClusterBBox } from '@/api/map';

export interface ViewportSnapshotLike {
  bbox: MapClusterBBox | null;
  zoom: number;
}

/**
 * Запас вокруг видимого вьюпорта: 0.35 с каждой стороны = 1.7× по оси, ~2.9× по
 * площади. Сдвиг до трети экрана в любую сторону остаётся внутри покрытия и не
 * ходит в сеть (#2450; до этого 0.2 — свободен был только сдвиг до пятой части).
 */
export const VIEWPORT_MARGIN_RATIO = 0.35;

const EPSILON = 0.0001;
const MAX_MERCATOR_LAT = 85.0511287798;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const isFiniteBBox = (bbox: MapClusterBBox | null | undefined): bbox is MapClusterBBox =>
  Boolean(
    bbox &&
      Number.isFinite(bbox.south) &&
      Number.isFinite(bbox.west) &&
      Number.isFinite(bbox.north) &&
      Number.isFinite(bbox.east),
  );

export const padViewportBBox = (
  bbox: MapClusterBBox,
  ratio: number = VIEWPORT_MARGIN_RATIO,
): MapClusterBBox => {
  const latMargin = Math.abs(bbox.north - bbox.south) * ratio;
  const lngMargin = Math.abs(bbox.east - bbox.west) * ratio;
  return {
    south: Math.max(-90, bbox.south - latMargin),
    north: Math.min(90, bbox.north + latMargin),
    west: Math.max(-180, bbox.west - lngMargin),
    east: Math.min(180, bbox.east + lngMargin),
  };
};

export const bboxContains = (
  outer: MapClusterBBox | null | undefined,
  inner: MapClusterBBox | null | undefined,
): boolean => {
  if (!isFiniteBBox(outer) || !isFiniteBBox(inner)) return false;
  return (
    inner.south >= outer.south - EPSILON &&
    inner.north <= outer.north + EPSILON &&
    inner.west >= outer.west - EPSILON &&
    inner.east <= outer.east + EPSILON
  );
};

/**
 * true — текущий вьюпорт целиком внутри уже опубликованной (с запасом) области на том
 * же округлённом зуме: публиковать нечего, запрос кластеров не нужен.
 */
export const isViewportCovered = (
  published: ViewportSnapshotLike | null | undefined,
  next: ViewportSnapshotLike,
): boolean =>
  Boolean(
    published &&
      next.bbox &&
      Math.round(published.zoom) === Math.round(next.zoom) &&
      bboxContains(published.bbox, next.bbox),
  );

/**
 * Решение о публикации: `null` — остаться на прежнем snapshot; иначе snapshot с
 * запасом, который становится новой опубликованной областью.
 */
export const resolveViewportPublication = (
  published: ViewportSnapshotLike | null | undefined,
  next: ViewportSnapshotLike,
): ViewportSnapshotLike | null => {
  if (isViewportCovered(published, next)) return null;
  return next.bbox ? { bbox: padViewportBBox(next.bbox), zoom: next.zoom } : next;
};

// --- Тайловая сетка Web Mercator ----------------------------------------------

const lngToTileX = (lng: number, scale: number): number => ((lng + 180) / 360) * scale;

const latToTileY = (lat: number, scale: number): number => {
  const rad = (clamp(lat, -MAX_MERCATOR_LAT, MAX_MERCATOR_LAT) * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale;
};

const tileXToLng = (x: number, scale: number): number => (x / scale) * 360 - 180;

const tileYToLat = (y: number, scale: number): number => {
  const n = Math.PI - (2 * Math.PI * y) / scale;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};

const round6 = (value: number): number => Math.round(value * 1e6) / 1e6;

/**
 * Расширяет bbox наружу до границ тайлов сетки `zoom` (плюс `padTiles` тайлов с
 * каждой стороны). Результат детерминирован для любого bbox внутри тех же тайлов,
 * поэтому ключ кэша кластеров совпадает между визитами одного района.
 */
export const snapBBoxToTileGrid = (
  bbox: MapClusterBBox,
  zoom: number,
  padTiles = 0,
): MapClusterBBox => {
  const z = clamp(Math.round(Number.isFinite(zoom) ? zoom : 0), 0, 22);
  const scale = 2 ** z;
  const x0 = clamp(Math.floor(lngToTileX(bbox.west, scale)) - padTiles, 0, scale);
  const x1 = clamp(Math.ceil(lngToTileX(bbox.east, scale)) + padTiles, 0, scale);
  const y0 = clamp(Math.floor(latToTileY(bbox.north, scale)) - padTiles, 0, scale);
  const y1 = clamp(Math.ceil(latToTileY(bbox.south, scale)) + padTiles, 0, scale);
  return {
    west: round6(tileXToLng(x0, scale)),
    east: round6(tileXToLng(x1, scale)),
    north: round6(tileYToLat(y0, scale)),
    south: round6(tileYToLat(y1, scale)),
  };
};

export const sameViewportBBox = (
  left: MapClusterBBox | null | undefined,
  right: MapClusterBBox | null | undefined,
  epsilon: number = EPSILON,
): boolean => {
  if (left === right) return true;
  if (!left || !right) return false;
  return (
    Math.abs(left.south - right.south) < epsilon &&
    Math.abs(left.west - right.west) < epsilon &&
    Math.abs(left.north - right.north) < epsilon &&
    Math.abs(left.east - right.east) < epsilon
  );
};

export const sameViewportSnapshot = (
  left: ViewportSnapshotLike,
  right: ViewportSnapshotLike,
): boolean => Math.abs(left.zoom - right.zoom) < EPSILON && sameViewportBBox(left.bbox, right.bbox);
