import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import {
  getActiveOverlayLayers,
  getExclusiveGroupSiblings,
  WEATHER_TEMP_LABELS_LAYER_ID,
  WEATHER_TEMP_LAYER_ID,
} from '@/config/mapWebLayers';

/**
 * Выбор слоёв карты — общий для всех экранов с картой (#1306).
 *
 * Раньше состояние жило локальным `useState` внутри `useMapOverlays`, поэтому
 * каждый экран стартовал с чистого набора. Требование владельца: включил погоду
 * на `/map` — она включена и в конструкторе маршрута, и после перезагрузки.
 * Отсюда один persisted store вместо локального состояния.
 *
 * Хранится только карта `id → включён`. Сами определения слоёв остаются
 * единственным источником истины в `config/mapWebLayers.ts`.
 */
export const getDefaultOverlayState = (): Record<string, boolean> => {
  const initial: Record<string, boolean> = {};
  getActiveOverlayLayers().forEach((layer) => {
    initial[layer.id] = Boolean(layer.defaultEnabled);
  });
  return initial;
};

/**
 * Из сохранённого состояния берём только слои, доступные в текущем окружении:
 * удалённый из конфига или отключённый по `requiresEnv` слой (нет ключа OWM) не
 * должен воскресать из localStorage и уходить в `setOverlayEnabled` несуществующим id.
 */
const sanitizePersistedOverlays = (persisted: unknown): Record<string, boolean> => {
  const next = getDefaultOverlayState();
  if (!persisted || typeof persisted !== 'object') return next;

  const source = persisted as Record<string, unknown>;
  for (const id of Object.keys(next)) {
    if (typeof source[id] === 'boolean') next[id] = source[id];
  }
  return next;
};

/**
 * Правила связей между слоями (перенесены из `useMapOverlays` без изменений):
 * heatmap-слои погоды взаимоисключающие, а числовые подписи °C включаются и
 * гаснут вместе с заливкой температуры.
 */
const applyOverlayToggle = (
  previous: Record<string, boolean>,
  id: string,
  enabled: boolean,
): Record<string, boolean> => {
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
};

interface MapOverlaysState {
  enabledOverlays: Record<string, boolean>;
  setOverlayEnabled: (id: string, enabled: boolean) => void;
  resetOverlays: () => void;
}

export const useMapOverlaysStore = create<MapOverlaysState>()(
  persist(
    (set) => ({
      enabledOverlays: getDefaultOverlayState(),
      setOverlayEnabled: (id, enabled) =>
        set((state) => {
          const nextOverlays = applyOverlayToggle(state.enabledOverlays, id, enabled);
          if (nextOverlays === state.enabledOverlays) return state;
          return { enabledOverlays: nextOverlays };
        }),
      resetOverlays: () => set({ enabledOverlays: getDefaultOverlayState() }),
    }),
    {
      name: 'map-overlays-storage',
      storage: createJSONStorage(() => {
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
          return localStorage;
        }
        return AsyncStorage;
      }),
      partialize: (state) => ({ enabledOverlays: state.enabledOverlays }),
      merge: (persisted, current) => ({
        ...current,
        enabledOverlays: sanitizePersistedOverlays(
          (persisted as { enabledOverlays?: unknown } | undefined)?.enabledOverlays,
        ),
      }),
    },
  ),
);
