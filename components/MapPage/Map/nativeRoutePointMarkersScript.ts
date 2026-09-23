// components/MapPage/Map/nativeRoutePointMarkersScript.ts
// Маркеры точек маршрута в native WebView-карте. Кружок точки маршрута /map
// (#1781) перенесён из nativeMapHtml.ts без изменений; #2059 добавил капли с
// номером для планировщика поездки: номера, шаблон разметки и таблица размеров
// цифры приходят в payload (`routePointMarkers`), шаблон собирает та же функция,
// что и web-маркер (`components/trips/planning/tripPlanMapMarkers.ts`). #2071
// добавил клиентскую кластеризацию (`leaflet.markercluster`, паритет с web
// `mapClusterGroup.ts`) и увеличенную активную точку — оба вне кластера.
// Вставляется в bodyScript после ROUTE_* констант и до `escapeHtml`.
import { normalizeRoutePoint } from './nativeBridge';

type RoutePointIconSpec = {
  className: string;
  html: string;
  size: [number, number];
  anchor: [number, number];
};

/** Payload WebView для нумерованных точек (форма `NativeRoutePointMarkers` планировщика). */
export type NativeRoutePointMarkersPayload = {
  labels: string[];
  icon: RoutePointIconSpec;
  /** #2071: капля активной точки — крупнее обычной, живёт вне кластера. */
  activeIcon?: RoutePointIconSpec;
  /**
   * #2071: индекс активной точки в итоговом списке маркеров WebView — уже
   * после фильтра `normalizeRoutePoint` (та же нумерация, что у `labels`/
   * `latLngs` после `normalizeRoutePointsWithMarkers`). `null` — активной
   * точки нет.
   */
  activeIndex?: number | null;
  fontSizes: readonly number[];
  fitPadding?: {
    topLeft: readonly [number, number];
    bottomRight: readonly [number, number];
    maxShare: number;
  };
  /**
   * #2071: паритет с web-кластеризацией маршрута (`mapClusterGroup.ts` +
   * `FOCUS_POINT_ZOOM`) — включается только у крупного маршрута
   * (`shouldClusterRouteMarkers`), `null`/`undefined` — точки рисуются как
   * раньше, без кластеров.
   */
  cluster?: {
    maxClusterRadius: number;
    disableClusteringAtZoom: number;
  } | null;
};

/**
 * Пары точек маршрута для WebView и номера к ним. `normalizeRoutePoint`
 * отбрасывает пару вне диапазона широты/долготы — номер такой точки уходит
 * вместе с ней, иначе все следующие маркеры получили бы чужие номера.
 * `sourceIndices` — позиция каждого маркера WebView во входном `routePoints`:
 * по ней тап и перетаскивание маркера возвращаются индексом переданного
 * списка (контракт `ROUTE_POINT_*` в `nativeBridge.ts`).
 *
 * #2071: `markers.activeIndex` приходит в той же нумерации, что и
 * `markers.labels` (позиция во входном `routePoints`, ДО фильтра). Здесь он
 * переводится в позицию среди уже отфильтрованных `latLngs` — ровно ту, по
 * которой WebView-скрипт (`routePoints.forEach`) сверяет `activeIndex`.
 */
export function normalizeRoutePointsWithMarkers(
  routePoints: ReadonlyArray<[number, number]>,
  markers: NativeRoutePointMarkersPayload | undefined,
): {
  latLngs: Array<[number, number]>;
  sourceIndices: number[];
  markers: NativeRoutePointMarkersPayload | null;
} {
  const latLngs: Array<[number, number]> = [];
  const sourceIndices: number[] = [];
  const labels: string[] = [];
  let activeIndex: number | null = null;
  routePoints.forEach((point, index) => {
    const normalized = normalizeRoutePoint(point);
    if (!normalized) return;
    latLngs.push(normalized);
    sourceIndices.push(index);
    if (markers) labels.push(String(markers.labels[index] ?? ''));
    if (markers?.activeIndex != null && markers.activeIndex === index) {
      activeIndex = latLngs.length - 1;
    }
  });
  return { latLngs, sourceIndices, markers: markers ? { ...markers, labels, activeIndex } : null };
}

/**
 * Скрипт WebView (без кириллицы внутри шаблона — строки шаблона проверяет
 * `uiLiteralGovernance`, поэтому пояснения живут здесь):
 *
 * - `makeRoutePointIcon` (#1781) — маркер точки маршрута: тот же круг, что
 *   раньше рисовал L.circleMarker, но как divIcon, потому что перетаскивать
 *   Leaflet умеет только L.Marker; box-sizing:border-box повторяет
 *   центрированную обводку.
 * - `metravelFitOptions` (#2059) — опции fitBounds с несимметричными отступами
 *   планировщика (капля маркера и кнопки карты, `ROUTE_MAP_FIT_PADDING`).
 *   Отступ не больше доли стороны контейнера: иначе у низкой карты полезная
 *   область уходит в ноль и Leaflet отдаляет кадр до минимума. Без отступов
 *   планировщика — прежний симметричный fallback (/map, 70 или 50 px). Зовёт её
 *   и `__metravelMapFitCoords` из `nativeMapViewCommandsScript.ts`: объявление
 *   функции всплывает на весь скрипт.
 * - `routePointIcon` (#2059, активный маркер — #2071) — капля с номером точки
 *   из списка планировщика. Разметку собирает RN тем же шаблоном, что
 *   web-маркер; здесь подставляются только номер и размер цифры. Активная
 *   точка (`isActive`) берёт более крупный `spec.activeIcon`, если он есть —
 *   как на web (`TripPlanRouteMarkers.tsx`, активная точка крупнее и вне
 *   кластера). Без номера — прежний кружок маршрута /map.
 */
export const NATIVE_ROUTE_POINT_MARKERS_SCRIPT = `        const ROUTE_POINT_WEIGHT = 3;
        function makeRoutePointIcon(radius, fillColor) {
          var size = radius * 2 + ROUTE_POINT_WEIGHT;
          var half = size / 2;
          var style = 'width:' + size + 'px;height:' + size + 'px;border-radius:50%;'
            + 'box-sizing:border-box;background:' + fillColor + ';'
            + 'border:' + ROUTE_POINT_WEIGHT + 'px solid ' + ROUTE_SURFACE + ';';
          return L.divIcon({
            className: 'metravel-route-point',
            html: '<div aria-hidden="true" style="' + style + '"></div>',
            iconSize: [size, size],
            iconAnchor: [half, half]
          });
        }
        function metravelFitOptions(padding, fallback, maxZoom) {
          var options = {};
          if (isFinite(maxZoom)) options.maxZoom = maxZoom;
          if (!padding || !padding.topLeft || !padding.bottomRight) {
            options.padding = fallback;
            return options;
          }
          var size = map.getSize ? map.getSize() : null;
          var share = isFinite(padding.maxShare) ? padding.maxShare : 0.4;
          function clamp(value, extent) {
            var n = Number(value) || 0;
            return size && extent > 0 ? Math.min(n, Math.floor(extent * share)) : n;
          }
          options.paddingTopLeft = [clamp(padding.topLeft[0], size && size.x), clamp(padding.topLeft[1], size && size.y)];
          options.paddingBottomRight = [clamp(padding.bottomRight[0], size && size.x), clamp(padding.bottomRight[1], size && size.y)];
          return options;
        }
        function routePointIcon(spec, index, isStart, isEnd, isActive) {
          var label = spec && Array.isArray(spec.labels) ? spec.labels[index] : null;
          var icon = spec && (isActive && spec.activeIcon ? spec.activeIcon : spec.icon);
          if (!label || !icon || typeof icon.html !== 'string') {
            return makeRoutePointIcon(isStart || isEnd ? 8 : 6, isStart ? ROUTE_START : ROUTE_COLOR);
          }
          var text = String(label);
          var sizes = Array.isArray(spec.fontSizes) && spec.fontSizes.length ? spec.fontSizes : [8];
          var fontSize = sizes[Math.min(Math.max(text.length, 1), sizes.length) - 1];
          return L.divIcon({
            className: icon.className || 'metravel-trip-plan-marker',
            html: icon.html.split('{{n}}').join(escapeHtml(text)).split('{{fs}}').join(String(fontSize)),
            iconSize: icon.size,
            iconAnchor: icon.anchor
          });
        }`;
