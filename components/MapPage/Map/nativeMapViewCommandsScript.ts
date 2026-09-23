// Команды вида native-карты, которые RN шлёт через `injectJavaScript`: зум
// плавающих контролов (перенесён из nativeMapHtml.ts без изменений) и подгонка
// кадра под набор координат — день маршрута планировщика (#2058).
// Вставляется в bodyScript после `L.map(...)` и `__metravelProgrammaticMoveUntil`.
// `metravelFitOptions` объявлен в `nativeRoutePointMarkersScript.ts` того же
// скрипта: объявление функции всплывает, а зовётся команда только после загрузки.
import type { MapFitPadding } from '@/types/mapUi';
import { CoordinateConverter } from '@/utils/coordinateConverter';

export const NATIVE_MAP_VIEW_COMMANDS_SCRIPT = `        window.__metravelMapZoomIn = function() {
          try { map.zoomIn(); } catch (e) {}
        };
        window.__metravelMapZoomOut = function() {
          try { map.zoomOut(); } catch (e) {}
        };
        window.__metravelMapFitCoords = function(coords, maxZoom, padding) {
          try {
            var latLngs = [];
            for (var i = 0; i < coords.length; i += 1) {
              var lat = Number(coords[i] && coords[i][0]);
              var lng = Number(coords[i] && coords[i][1]);
              if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
                latLngs.push([lat, lng]);
              }
            }
            if (!latLngs.length) return false;
            __metravelProgrammaticMoveUntil = Date.now() + 700;
            if (latLngs.length === 1) {
              map.setView(latLngs[0], Math.max(map.getZoom ? map.getZoom() : maxZoom, maxZoom));
            } else {
              map.fitBounds(L.latLngBounds(latLngs), metravelFitOptions(padding, [50, 50], maxZoom));
            }
            return true;
          } catch (e) {
            return false;
          }
        };`;

const finitePair = (pair: readonly [number, number]): [number, number] =>
  [Number.isFinite(pair[0]) ? pair[0] : 0, Number.isFinite(pair[1]) ? pair[1] : 0];

/**
 * Команда `injectJavaScript` для `MapUiApi.fitToCoords`: только конечные числа.
 * #2059: `padding` уходит в WebView третьим аргументом, иначе там `[50, 50]`.
 */
export const buildNativeMapFitCoordsCommand = (
  coords: ReadonlyArray<{ lat: number; lng: number }>,
  maxZoom: number,
  padding?: MapFitPadding,
): string => {
  const pairs = coords
    .filter(({ lat, lng }) => Number.isFinite(lat) && Number.isFinite(lng))
    .map(({ lat, lng }) => [lat, lng]);
  const paddingArg = padding
    ? `, ${JSON.stringify({
      topLeft: finitePair(padding.topLeft),
      bottomRight: finitePair(padding.bottomRight),
      maxShare: Number.isFinite(padding.maxShare) ? padding.maxShare : 0.4,
    })}`
    : '';
  return `window.__metravelMapFitCoords && window.__metravelMapFitCoords(${JSON.stringify(pairs)}, ${maxZoom}${paddingArg})`;
};

/**
 * #2066: команда `injectJavaScript` для `MapUiApi.focusOnCoord` — тап по строке
 * точки в списке планировщика. Парсит координаты тем же `CoordinateConverter`,
 * что и web (`useMapApi.ts`), и переиспользует одноточечную ветку
 * `__metravelMapFitCoords` (`map.setView` с зумом не ниже переданного).
 * Невалидная строка → `null`, команда в WebView не уходит.
 */
export const buildNativeMapFocusCoordCommand = (coord: string, zoom?: number): string | null => {
  const parsed = CoordinateConverter.fromLooseString(String(coord));
  if (!parsed || !CoordinateConverter.isValid(parsed)) return null;

  const targetZoom = typeof zoom === 'number' && Number.isFinite(zoom) ? zoom : 14;
  return buildNativeMapFitCoordsCommand([{ lat: parsed.lat, lng: parsed.lng }], targetZoom);
};
