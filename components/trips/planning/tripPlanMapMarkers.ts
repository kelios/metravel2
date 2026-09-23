// components/trips/planning/tripPlanMapMarkers.ts
// #2059: маркер точки маршрута и кадр карты конструктора — общий контракт web
// (`TripPlanRouteMarkers.tsx`, Leaflet DOM) и native (`TripPlanRouteMap.tsx` →
// payload WebView). Модуль чистый: ни Leaflet, ни React, поэтому его читают обе
// платформы и jest без моков.
import type { NativeRoutePointMarkersPayload } from '@/components/MapPage/Map/nativeRoutePointMarkersScript';
import { ROUTE_DAY_COLLAPSE_THRESHOLD } from '@/components/trips/planning/routeDayCollapse';
import type { ThemedColors } from '@/hooks/useTheme';
import type { MapFitPadding } from '@/types/mapUi';
import {
  NUMBERED_DROP_FONT_SIZES,
  buildNumberedDropMarkerHtml,
  numberedDropFontSize,
} from '@/utils/markerSvg';

/**
 * Номер маркера = номер строки в списке точек: `RoutePointRow` печатает
 * `index + 1` по тому же массиву `route`, который получает карта.
 */
export const routeMarkerLabel = (index: number): string => String(index + 1);

/**
 * Кластеры включаются только у крупного маршрута — больше 15 точек, тот же
 * порог, что сворачивает дни в списке (#2058). У короткого маршрута каждая
 * точка видна с номером на любом масштабе: кластер из трёх точек города —
 * лишний клик, а «одиночных маркеров на общем виде ≤ 15» выполняется само.
 */
export const shouldClusterRouteMarkers = (pointCount: number): boolean =>
  pointCount > ROUTE_DAY_COLLAPSE_THRESHOLD;

/** Обычная капля и активная (точка открыта в редакторе) — активная крупнее. */
export const ROUTE_MARKER_SIZE = 36;
export const ROUTE_MARKER_ACTIVE_SIZE = 44;

export const ROUTE_MARKER_CLASS = 'metravel-trip-plan-marker';
export const ROUTE_MARKER_ACTIVE_CLASS = `${ROUTE_MARKER_CLASS} metravel-trip-plan-marker-active`;

/** Плейсхолдеры шаблона капли: номер и размер цифры подставляются на месте. */
export const ROUTE_MARKER_LABEL_TOKEN = '{{n}}';
export const ROUTE_MARKER_FONT_TOKEN = '{{fs}}';

export type RouteMarkerIconTemplate = {
  className: string;
  html: string;
  size: [number, number];
  anchor: [number, number];
  popupAnchor: [number, number];
};

type MarkerColors = Pick<ThemedColors, 'primary' | 'primaryDark' | 'warning' | 'textOnPrimary'>;

/**
 * Шаблон капли без номера. Web подставляет номер сразу (`fillRouteMarkerTemplate`),
 * native отдаёт шаблон и номера в WebView — так разметка маркера на обеих
 * платформах собирается одной функцией, а не двумя копиями SVG.
 */
export function routeMarkerIconTemplate(
  colors: MarkerColors,
  active: boolean,
): RouteMarkerIconTemplate {
  const size = active ? ROUTE_MARKER_ACTIVE_SIZE : ROUTE_MARKER_SIZE;
  return {
    className: active ? ROUTE_MARKER_ACTIVE_CLASS : ROUTE_MARKER_CLASS,
    html: buildNumberedDropMarkerHtml({
      size,
      fill: active ? colors.warning : colors.primary,
      stroke: colors.primaryDark,
      textColor: colors.textOnPrimary,
      label: ROUTE_MARKER_LABEL_TOKEN,
      fontSize: ROUTE_MARKER_FONT_TOKEN,
    }),
    size: [size, size],
    // Остриё капли — внизу иконки: якорь в середине нижнего края.
    anchor: [size / 2, size],
    popupAnchor: [0, -(size - 2)],
  };
}

const escapeLabel = (label: string): string =>
  label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Шаблон → разметка конкретного маркера. То же делает WebView в native-скрипте. */
export const fillRouteMarkerTemplate = (html: string, label: string): string =>
  html
    .split(ROUTE_MARKER_LABEL_TOKEN).join(escapeLabel(label))
    .split(ROUTE_MARKER_FONT_TOKEN).join(String(numberedDropFontSize(label)));

/**
 * #2059: отступы подгонки кадра — общей (весь маршрут) и дня (#2058). Прежние
 * симметричные 28 px не знали ни высоты капли, ни кнопок в углах карты: на
 * mobile 390 после «на карте» верхняя-правая точка дня вставала под «Слои».
 *
 * - Верх: полоса угловых контролов (зум Leaflet слева — 10 + 2×30 + рамки ≈ 74;
 *   «Слои» и «Развернуть» справа — 10 + 44 = 54) плюс капля 36 над своей
 *   точкой и зазор 6: 74 + 36 + 6 = 116.
 * - Бока: половина капли 18 и зазор 10.
 * - Низ: строка атрибуции тайлов ≈ 18 и зазор 10; капля растёт вверх от точки,
 *   поэтому снизу её высота не нужна.
 *
 * Native рисует те же капли (шаблон выше) и те же кнопки «Слои»/«Развернуть»,
 * поэтому получает те же числа — через payload и команду `fitToCoords`.
 */
export const ROUTE_MAP_FIT_PADDING: MapFitPadding = {
  topLeft: [28, 116],
  bottomRight: [28, 28],
  /**
   * Доля стороны контейнера, больше которой отступ не бывает: иначе у низкой
   * карты полезная область уходит в ноль, и Leaflet отдаляет кадр до минимума
   * (то же правило, что у клика по кластеру на /map).
   */
  maxShare: 0.4,
};

export type RouteMapFitOptions = {
  paddingTopLeft: [number, number];
  paddingBottomRight: [number, number];
  maxZoom: number;
};

/** Опции `fitBounds` для кадра карты конструктора с учётом размера контейнера. */
export function routeMapFitBoundsOptions(
  container: { x: number; y: number } | null | undefined,
  maxZoom: number,
): RouteMapFitOptions {
  const width = container && Number.isFinite(container.x) && container.x > 0 ? container.x : null;
  const height = container && Number.isFinite(container.y) && container.y > 0 ? container.y : null;
  const clamp = (value: number, extent: number | null) =>
    extent == null ? value : Math.min(value, Math.floor(extent * ROUTE_MAP_FIT_PADDING.maxShare));
  const [left, top] = ROUTE_MAP_FIT_PADDING.topLeft;
  const [right, bottom] = ROUTE_MAP_FIT_PADDING.bottomRight;
  return {
    paddingTopLeft: [clamp(left, width), clamp(top, height)],
    paddingBottomRight: [clamp(right, width), clamp(bottom, height)],
    maxZoom,
  };
}

/**
 * Payload WebView для нумерованных точек планировщика: номера по порядку
 * `routePoints`, шаблон капли и таблица размеров цифры. Без него native-карта
 * рисует точки маршрута прежними кружками (маршрут /map).
 */
export type NativeRoutePointMarkers = NativeRoutePointMarkersPayload;

export function nativeRoutePointMarkers(
  labels: string[],
  colors: MarkerColors,
): NativeRoutePointMarkers {
  return {
    labels,
    icon: routeMarkerIconTemplate(colors, false),
    fontSizes: NUMBERED_DROP_FONT_SIZES,
    fitPadding: ROUTE_MAP_FIT_PADDING,
  };
}
