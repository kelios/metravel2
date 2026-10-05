import type { MapUiApi } from '@/types/mapUi';
import { CoordinateConverter } from '@/utils/coordinateConverter';
import { serializeForInlineScript } from '@/utils/webViewBridge';
import { buildNativeMapFitCoordsCommand, buildNativeMapFocusCoordCommand } from './nativeMapViewCommandsScript';

/**
 * #2218 — полный `MapUiApi` приложения (WebView + Leaflet), который
 * `Map.ios.tsx` (и `Map.android.tsx` реэкспортом) отдаёт в `onMapUiApiReady`.
 *
 * Раньше приложение объявляло `Pick<MapUiApi, …>` из шести ключей, и каждый
 * следующий потребитель (#2066 — `focusOnCoord`, #2218 — `fitToResults` и
 * `capabilities`) молча получал пустоту: поповер «Слои» держал «Показать всё на
 * карте» вечно недоступной, а «Сбросить всё» сбрасывал фильтры без подгонки.
 * Теперь тип — полный `MapUiApi`: новый метод сайтового API без реализации здесь
 * не скомпилируется. Где у движка приложения возможности нет, метод — явный
 * no-op, а `capabilities` честно говорит `false` (потребители гейтят по ним).
 */

/** Зум одиночного места при «Показать всё на карте» (как фокус точки, #2066). */
export const NATIVE_FIT_TO_RESULTS_MAX_ZOOM = 14;

type ResultPoint = { coord?: string | null } | null | undefined;

/** Координаты текущих мест — тем же парсером, что и web (`useMapApi.fitToResults`). */
export const collectNativeResultCoords = (
  points: ReadonlyArray<ResultPoint>,
): Array<{ lat: number; lng: number }> => {
  const coords: Array<{ lat: number; lng: number }> = [];
  for (const point of points) {
    const raw = point?.coord;
    if (typeof raw !== 'string' || !raw) continue;
    const parsed = CoordinateConverter.fromLooseString(raw);
    if (parsed && CoordinateConverter.isValid(parsed)) coords.push({ lat: parsed.lat, lng: parsed.lng });
  }
  return coords;
};

type BuildNativeMapUiApiArgs = {
  injectMapCommand: (script: string) => void;
  setOverlayEnabled: (id: string, enabled: boolean) => void;
  /** Читается в момент вызова: функция стабильна, пока не сменилась возможность. */
  getResultCoords: () => ReadonlyArray<{ lat: number; lng: number }>;
  canFitToResults: boolean;
};

const noop = () => {};

export const buildNativeMapUiApi = ({
  injectMapCommand,
  setOverlayEnabled,
  getResultCoords,
  canFitToResults,
}: BuildNativeMapUiApiArgs): MapUiApi => ({
  zoomIn: () => injectMapCommand('window.__metravelMapZoomIn && window.__metravelMapZoomIn()'),
  zoomOut: () => injectMapCommand('window.__metravelMapZoomOut && window.__metravelMapZoomOut()'),
  centerOnUser: (target) => {
    const lat = Number(target?.lat);
    const lng = Number(target?.lng);
    const hasValidTarget =
      Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    injectMapCommand(
      hasValidTarget
        ? `window.__metravelMapCenterOnUser && window.__metravelMapCenterOnUser(${lat}, ${lng})`
        : 'window.__metravelMapCenterOnUser && window.__metravelMapCenterOnUser()',
    );
  },
  fitToResults: () => {
    const coords = getResultCoords();
    if (coords.length === 0) return;
    injectMapCommand(buildNativeMapFitCoordsCommand(coords, NATIVE_FIT_TO_RESULTS_MAX_ZOOM));
  },
  fitToCoords: (coords, { maxZoom, padding }) =>
    injectMapCommand(buildNativeMapFitCoordsCommand(coords, maxZoom, padding)),
  // #2066: тап по строке точки в списке планировщика — переход к координате.
  focusOnCoord: (coord, options) => {
    const command = buildNativeMapFocusCoordCommand(coord, options?.zoom);
    if (command) injectMapCommand(command);
  },
  setOverlayEnabled,
  // Подложка в приложении одна (`getThemedNativeBaseTileUrl`), выбор подложки
  // поповер показывает только при нескольких базовых слоях — no-op честен.
  setBaseLayer: noop,
  // Экспорта маршрута файлом в приложении нет: `canExportRoute: false`.
  exportGpx: noop,
  exportKml: noop,
  capabilities: {
    // Без явной цели WebView сам запрашивает позицию (`__metravelMapCenterOnUser()`).
    canCenterOnUser: true,
    canFitToResults,
    canExportRoute: false,
  },
});

/** Скрипт включения оверлея — общий для API и переприменения после reload WebView. */
export const buildNativeSetOverlayCommand = (id: string, enabled: boolean): string =>
  `window.__metravelSetOverlay && window.__metravelSetOverlay(${serializeForInlineScript(id)}, ${enabled ? 'true' : 'false'})`;
