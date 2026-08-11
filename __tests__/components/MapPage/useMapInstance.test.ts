jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    Platform: { ...actual.Platform, OS: 'web' },
  };
});

jest.mock('@/config/mapWebLayers', () => {
  const actual = jest.requireActual('@/config/mapWebLayers');
  return {
    ...actual,
    getActiveOverlayLayers: () => [],
  };
});

jest.mock('@/utils/mapWebLayers', () => {
  const actual = jest.requireActual('@/utils/mapWebLayers');
  return {
    ...actual,
    attachTileRetry: (layer: unknown) => layer,
  };
});

import { renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
import {
  getThemedBaseLayerOptions,
  useMapInstance,
} from '@/components/MapPage/Map/useMapInstance';
import { OSM_PROXY_MAX_ZOOM } from '@/config/mapWebLayers';

describe('getThemedBaseLayerOptions', () => {
  it('always returns the light OSM proxy layer options regardless of theme', () => {
    const options = getThemedBaseLayerOptions() as Record<string, unknown>;

    expect(options.maxZoom).toBe(OSM_PROXY_MAX_ZOOM);
    // OSM-прокси без субдоменов и без detectRetina (см. комментарий в хуке).
    expect(options.subdomains).toBeUndefined();
    expect(options.detectRetina).toBeUndefined();
  });
});

describe('useMapInstance startup gate', () => {
  it('does not create tiles before the initial view and attaches exactly once after it', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const baseLayer = {
      addTo: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    };
    const L = {
      tileLayer: jest.fn(() => baseLayer),
    };
    const map = {
      addLayer: jest.fn(),
      removeLayer: jest.fn(),
      hasLayer: jest.fn(() => false),
      getCenter: jest.fn(() => ({ lat: 53.9, lng: 27.5667 })),
      getZoom: jest.fn(() => 9),
      getSize: jest.fn(() => ({ x: 1350, y: 940 })),
      on: jest.fn(),
      off: jest.fn(),
    };

    const { rerender } = renderHook(
      ({ ready }) => useMapInstance({ map, L, layerStartupReady: ready }),
      { initialProps: { ready: false } },
    );

    expect(L.tileLayer).not.toHaveBeenCalled();
    expect(baseLayer.addTo).not.toHaveBeenCalled();

    rerender({ ready: true });

    expect(L.tileLayer).toHaveBeenCalledTimes(1);
    expect(baseLayer.addTo).toHaveBeenCalledTimes(1);
    expect(baseLayer.addTo).toHaveBeenCalledWith(map);

    // A normal parent rerender/refetch keeps the monotonic gate true. The hook
    // must reuse the existing layer rather than producing duplicate requests.
    rerender({ ready: true });
    expect(L.tileLayer).toHaveBeenCalledTimes(1);
    expect(baseLayer.addTo).toHaveBeenCalledTimes(1);
  });
});
