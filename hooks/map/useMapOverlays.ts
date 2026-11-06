import { useCallback, useEffect, useMemo } from 'react';

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
type ScreenOverlay = {
  id: string;
  title: string;
  category: string;
  subtitle: string;
  enabled: boolean;
  toggle: (enabled: boolean) => void;
};

export function useMapOverlays(mapUiApi: MapUiApi | null, screenOverlay?: ScreenOverlay) {
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

  const screenId = screenOverlay?.id;
  const screenToggle = screenOverlay?.toggle;
  const toggle = useCallback((id: string, enabled: boolean) => {
    if (id === screenId && screenToggle) screenToggle(enabled);
    else handleOverlayToggle(id, enabled);
  }, [handleOverlayToggle, screenId, screenToggle]);
  const reset = useCallback(() => {
    resetOverlays();
    screenToggle?.(false);
  }, [resetOverlays, screenToggle]);
  const options = useMemo(() => screenOverlay ? [...overlayOptions, screenOverlay] : overlayOptions, [overlayOptions, screenOverlay]);
  const enabled = useMemo(() => screenOverlay ? { ...enabledOverlays, [screenOverlay.id]: screenOverlay.enabled } : enabledOverlays, [enabledOverlays, screenOverlay]);

  return { enabledOverlays: enabled, handleOverlayToggle: toggle, overlayOptions: options, resetOverlays: reset };
}
