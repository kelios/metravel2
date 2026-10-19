/**
 * #2661 — native-сторона слоя «Погода»: общий контроллер в RN получает каждый
 * MAP_VIEWPORT, а в WebView уходит только патч `__metravelSetWeatherLabels`.
 */
import { act, renderHook } from '@testing-library/react-native';

import { useNativeWeatherLabels } from '@/components/MapPage/Map/useNativeWeatherLabels';
import { WEATHER_LABELS_CONFIG, WEATHER_LABELS_LAYER_ID } from '@/utils/mapWeatherLabels';

jest.mock('@/hooks/useSafeAreaInsetsSafe', () => ({ useSafeAreaInsetsSafe: () => ({ top: 47 }) }));
jest.mock('@/config/mapWebLayers', () => ({
  getOwmApiKey: () => 'test-key',
  getActiveOverlayLayers: () => [{ id: 'weather-temp-labels', kind: 'weather-temp-labels', minZoom: 6 }],
}));

const VIEWPORT = { bbox: { south: 53.75, west: 27.35, north: 54.05, east: 27.8 }, zoom: 11 };
const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, WEATHER_LABELS_CONFIG.flushDelayMs + 30));
  });

describe('useNativeWeatherLabels', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ main: { temp: 9 } }) }));
    global.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  const setup = () => {
    const inject = jest.fn();
    const containerSizeRef = { current: { width: 390, height: 844 } };
    const hook = renderHook(() => useNativeWeatherLabels({ injectMapCommand: inject, containerSizeRef }));
    const patchCommands = () => inject.mock.calls.map(([script]) => String(script)).filter((s) => s.includes('__metravelSetWeatherLabels'));
    return { inject, hook, patchCommands };
  };

  it('does nothing until the weather overlay is enabled', async () => {
    const { hook, patchCommands } = setup();
    hook.result.current.onViewport(VIEWPORT);
    hook.result.current.onOverlayToggle('osm-camping', true);
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(patchCommands()).toHaveLength(0);
  });

  it('injects only a label patch and does not refetch for the same viewport', async () => {
    const { hook, patchCommands } = setup();
    hook.result.current.onViewport(VIEWPORT);
    hook.result.current.onOverlayToggle(WEATHER_LABELS_LAYER_ID, true);
    await flush();
    await flush();
    const calls = fetchMock.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    expect(patchCommands().length).toBeGreaterThan(0);
    expect(patchCommands()[0]).toContain('"add":[');

    const commands = patchCommands().length;
    hook.result.current.onViewport(VIEWPORT);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(calls);
    expect(patchCommands()).toHaveLength(commands);
  });

  it('re-sends cached labels to a reloaded WebView without new requests', async () => {
    const { hook, patchCommands } = setup();
    hook.result.current.onOverlayToggle(WEATHER_LABELS_LAYER_ID, true);
    hook.result.current.onViewport(VIEWPORT);
    await flush();
    await flush();
    const calls = fetchMock.mock.calls.length;
    const commands = patchCommands().length;
    hook.result.current.onRendererReady();
    expect(patchCommands()).toHaveLength(commands + 1);
    expect(fetchMock).toHaveBeenCalledTimes(calls);
  });

  it('stops requesting after the overlay is turned off', async () => {
    const { hook } = setup();
    hook.result.current.onOverlayToggle(WEATHER_LABELS_LAYER_ID, true);
    hook.result.current.onOverlayToggle(WEATHER_LABELS_LAYER_ID, false);
    const calls = fetchMock.mock.calls.length;
    hook.result.current.onViewport({ ...VIEWPORT, bbox: { south: 52, west: 23, north: 52.4, east: 23.5 } });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(calls);
  });
});
