import { getOwmApiKey } from '@/config/mapWebLayers';
import { ensureMapPane } from '@/components/MapPage/Map/ensureMapPane';
import {
  createWeatherLabelsController,
  WEATHER_LABELS_PANE,
  WEATHER_LABELS_PANE_Z_INDEX,
  type WeatherLabelInsets,
  type WeatherLabelsPatch,
  type WeatherViewport,
} from '@/utils/mapWeatherLabels';

type LeafletMap = any;

export type WeatherTempLabelsOverlayOptions = {
  /** Слой ниже этого зума пуст (как `minZoom` определения слоя). */
  minZoom?: number;
  /** Зоны кнопок и шторки поверх карты, куда подпись не ставится. */
  getInsets?: () => WeatherLabelInsets;
  /** Provider attribution shown by Leaflet while this custom layer is active. */
  attribution?: string;
};

const ZERO_INSETS: WeatherLabelInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * #2661 — Leaflet-рендерер слоя «Погода»: ячейки, кэш и запросы — в общем
 * контроллере `utils/mapWeatherLabels.ts` (тот же, что у native), здесь только
 * патч `{add, removeKeys}` по ключу ячейки в отдельной панели под маркерами.
 */
export const attachWeatherTempLabelsOverlay = (
  L: any,
  map: LeafletMap,
  opts?: WeatherTempLabelsOverlayOptions,
) => {
  const layerGroup = L.layerGroup(
    [],
    opts?.attribution ? { attribution: opts.attribution } : undefined,
  );
  const markers = new Map<string, any>();
  let started = false;

  // Пропатченный `getPane` (utils/leafletFix) создаёт pane без стилей —
  // поэтому только через общий `ensureMapPane`, который стилизует всегда.
  let paneName: string | undefined;
  const ensurePane = () => {
    paneName = ensureMapPane(map, WEATHER_LABELS_PANE, {
      zIndex: WEATHER_LABELS_PANE_Z_INDEX,
      pointerEvents: 'none',
    });
  };

  const applyPatch = (patch: WeatherLabelsPatch) => {
    patch.removeKeys.forEach((key) => {
      const marker = markers.get(key);
      if (!marker) return;
      layerGroup.removeLayer(marker);
      markers.delete(key);
    });
    patch.add.forEach((label) => {
      if (markers.has(label.key)) return;
      try {
        const marker = L.marker([label.lat, label.lon], {
          icon: L.divIcon({ className: 'metravel-temp-label', html: label.html, iconSize: undefined, iconAnchor: [0, 0] }),
          pane: paneName,
          interactive: false,
          keyboard: false,
        });
        marker.addTo(layerGroup);
        markers.set(label.key, marker);
      } catch {
        // Пропускаем некорректную подпись — на основную карту не влияет.
      }
    });
  };

  const controller = createWeatherLabelsController({
    getApiKey: getOwmApiKey,
    minZoom: opts?.minZoom ?? 0,
    onPatch: applyPatch,
    onError: (message) => console.warn('[Weather Temp Labels] Failed to load OWM data:', message),
  });

  const readViewport = (): WeatherViewport | null => {
    try {
      const bounds = map.getBounds?.();
      const sw = bounds?.getSouthWest?.();
      const ne = bounds?.getNorthEast?.();
      const size = map.getSize?.();
      const zoom = Number(map.getZoom?.());
      if (!sw || !ne || !size || !Number.isFinite(zoom)) return null;
      return {
        bbox: { south: sw.lat, west: sw.lng, north: ne.lat, east: ne.lng },
        zoom,
        widthPx: Number(size.x),
        heightPx: Number(size.y),
        insets: opts?.getInsets?.() ?? ZERO_INSETS,
      };
    } catch {
      return null;
    }
  };

  const onMoveEnd = () => {
    if (!started) return;
    const view = readViewport();
    if (view) controller.update(view);
  };

  const start = () => {
    if (started) return;
    started = true;
    try {
      const begin = () => {
        if (!started) return;
        ensurePane();
        map.on('moveend', onMoveEnd);
        onMoveEnd();
      };
      if (typeof map.whenReady === 'function') map.whenReady(begin);
      else begin();
    } catch {
      // noop
    }
  };

  const stop = () => {
    if (!started) return;
    started = false;
    try {
      map.off?.('moveend', onMoveEnd);
    } catch {
      // noop
    }
    controller.stop();
    markers.clear();
    layerGroup.clearLayers();
  };

  return {
    layer: layerGroup,
    start,
    stop,
  };
};
