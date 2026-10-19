import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';

import { getActiveOverlayLayers, getOwmApiKey } from '@/config/mapWebLayers';
import { useSafeAreaInsetsSafe } from '@/hooks/useSafeAreaInsetsSafe';
import {
  createWeatherLabelsController,
  WEATHER_LABELS_LAYER_ID,
  type WeatherLabelsController,
  type WeatherLabelsPatch,
} from '@/utils/mapWeatherLabels';
import { serializeForInlineScript } from '@/utils/webViewBridge';
import type { NativeViewportSnapshot } from './nativeBridge';
import { readMapWeatherLabelInsets } from './mapWeatherLabelInsets';

export const buildNativeSetWeatherLabelsCommand = (patch: WeatherLabelsPatch) =>
  `window.__metravelSetWeatherLabels && window.__metravelSetWeatherLabels(${serializeForInlineScript(patch)})`;

export interface NativeWeatherLabelsApi {
  /** Тогл оверлея по id (тот же, что `setOverlayEnabled`); чужие id игнорируются. */
  onOverlayToggle(id: string, enabled: boolean): void;
  /** Каждое `MAP_VIEWPORT` из WebView (до гейта покрытия кластеров). */
  onViewport(viewport: NativeViewportSnapshot | null): void;
  /** WebView (пере)загружен и оверлеи переприменены: отдать подписи заново. */
  onRendererReady(): void;
}

/**
 * #2661 — слой «Погода» в приложении: общий контроллер ячеек
 * (`utils/mapWeatherLabels.ts`, тот же, что на web) живёт на стороне RN,
 * запросы к OpenWeatherMap идут сетью приложения, а не из WebView рядом с
 * тайлами; в WebView уходит только патч подписей.
 */
export const useNativeWeatherLabels = ({
  injectMapCommand,
  containerSizeRef,
}: {
  injectMapCommand: (script: string) => void;
  containerSizeRef: MutableRefObject<{ width: number; height: number }>;
}): NativeWeatherLabelsApi => {
  const topSafeInset = useSafeAreaInsetsSafe().top;
  const injectRef = useRef(injectMapCommand);
  injectRef.current = injectMapCommand;
  const topSafeInsetRef = useRef(topSafeInset);
  topSafeInsetRef.current = topSafeInset;
  const enabledRef = useRef(false);
  const viewportRef = useRef<NativeViewportSnapshot | null>(null);
  const controllerRef = useRef<WeatherLabelsController | null>(null);

  const api = useMemo<NativeWeatherLabelsApi>(() => {
    const getController = () => {
      if (!controllerRef.current) {
        const def = getActiveOverlayLayers().find((layer) => layer.id === WEATHER_LABELS_LAYER_ID);
        controllerRef.current = createWeatherLabelsController({
          getApiKey: getOwmApiKey,
          minZoom: def?.minZoom ?? 0,
          onPatch: (patch) => injectRef.current(buildNativeSetWeatherLabelsCommand(patch)),
        });
      }
      return controllerRef.current;
    };

    const pushView = () => {
      const viewport = viewportRef.current;
      const size = containerSizeRef.current;
      if (!enabledRef.current || !viewport || size.width <= 0 || size.height <= 0) return;
      getController().update({
        bbox: viewport.bbox,
        zoom: viewport.zoom,
        widthPx: size.width,
        heightPx: size.height,
        insets: readMapWeatherLabelInsets(topSafeInsetRef.current),
      });
    };

    return {
      onOverlayToggle: (id, enabled) => {
        if (id !== WEATHER_LABELS_LAYER_ID || enabledRef.current === enabled) return;
        enabledRef.current = enabled;
        if (enabled) pushView();
        else controllerRef.current?.stop();
      },
      onViewport: (viewport) => {
        if (!viewport) return;
        viewportRef.current = viewport;
        pushView();
      },
      onRendererReady: () => {
        if (!enabledRef.current) return;
        controllerRef.current?.resync();
        pushView();
      },
    };
  }, [containerSizeRef]);

  useEffect(() => () => controllerRef.current?.stop(), []);

  return api;
};
