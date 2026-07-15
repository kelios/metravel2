import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getActiveOverlayLayers,
  getExclusiveGroupSiblings,
  WEATHER_TEMP_LABELS_LAYER_ID,
  WEATHER_TEMP_LAYER_ID,
} from '@/config/mapWebLayers';
import type { MapUiApi } from '@/types/mapUi';

const getDefaultOverlayState = () => {
  const initial: Record<string, boolean> = {};
  getActiveOverlayLayers().forEach((layer) => {
    initial[layer.id] = Boolean(layer.defaultEnabled);
  });
  return initial;
};

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
  const [enabledOverlays, setEnabledOverlays] = useState<Record<string, boolean>>(
    getDefaultOverlayState,
  );

  const handleOverlayToggle = useCallback((id: string, enabled: boolean) => {
    setEnabledOverlays((previous) => {
      if (previous[id] === enabled) return previous;
      const next = { ...previous, [id]: enabled };

      if (enabled) {
        for (const siblingId of getExclusiveGroupSiblings(id)) {
          if (next[siblingId]) next[siblingId] = false;
        }
      }

      if (id === WEATHER_TEMP_LAYER_ID) {
        next[WEATHER_TEMP_LABELS_LAYER_ID] = enabled;
      } else if (previous[WEATHER_TEMP_LAYER_ID] && next[WEATHER_TEMP_LAYER_ID] === false) {
        next[WEATHER_TEMP_LABELS_LAYER_ID] = false;
      }

      return next;
    });
  }, []);

  const resetOverlays = useCallback(() => {
    setEnabledOverlays(getDefaultOverlayState());
  }, []);

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
