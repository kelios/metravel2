import { useEffect, useMemo } from 'react';

import { getActiveOverlayLayers } from '@/config/mapWebLayers';
import { useMapOverlaysStore } from '@/stores/mapOverlaysStore';
import type { MapUiApi } from '@/types/mapUi';

/**
 * Список слоёв + синхронизация выбора с конкретной картой.
 *
 * Сам выбор живёт в общем persisted store (`stores/mapOverlaysStore`), поэтому
 * /map и карта конструктора маршрута показывают одинаковый набор включённых
 * слоёв (#1306). Хук вызывается каждым экраном со своим `mapUiApi` и приводит
 * его карту к общему состоянию.
 */
export function useMapOverlays(mapUiApi: MapUiApi | null) {
  const activeOverlayLayers = useMemo(() => getActiveOverlayLayers(), []);
  const overlayOptions = useMemo(
    () =>
      activeOverlayLayers
        .filter(
          (layer) =>
            layer.kind.startsWith('osm-overpass-') ||
            layer.kind === 'weather-temp-labels' ||
            Boolean(layer.url),
        )
        .map((layer) => ({
          id: layer.id,
          title: layer.title,
          category: layer.category,
          subtitle: layer.subtitle,
          badge: layer.badge,
        })),
    [activeOverlayLayers],
  );

  const enabledOverlays = useMapOverlaysStore((state) => state.enabledOverlays);
  const handleOverlayToggle = useMapOverlaysStore((state) => state.setOverlayEnabled);
  const resetOverlays = useMapOverlaysStore((state) => state.resetOverlays);

  const controlledOverlayIds = useMemo(
    () => overlayOptions.map((layer) => layer.id),
    [overlayOptions],
  );

  useEffect(() => {
    if (!mapUiApi) return;
    controlledOverlayIds.forEach((id) => {
      try {
        mapUiApi.setOverlayEnabled(id, Boolean(enabledOverlays[id]));
      } catch {
        // A renderer teardown may race this synchronization.
      }
    });
  }, [controlledOverlayIds, enabledOverlays, mapUiApi]);

  return { enabledOverlays, handleOverlayToggle, overlayOptions, resetOverlays };
}
