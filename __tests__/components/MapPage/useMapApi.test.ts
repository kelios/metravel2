import { renderHook, act } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { useMapApi } from '@/components/MapPage/Map/useMapApi';

jest.mock('@/utils/routeExport', () => ({
  buildGpx: jest.fn(() => 'gpx'),
  buildKml: jest.fn(() => 'kml'),
  downloadTextFileWeb: jest.fn(),
}));

jest.mock('@/config/mapWebLayers', () => ({
  WEB_MAP_BASE_LAYERS: [],
}));

jest.mock('@/utils/mapWebLayers', () => ({
  createLeafletLayer: jest.fn(() => null),
}));

describe('useMapApi', () => {
  it('centerOnUser keeps compact web focus clear of floating controls', async () => {
    Platform.OS = 'web';

    const map = {
      setView: jest.fn(),
      panBy: jest.fn(),
      getContainer: jest.fn(() => ({ clientWidth: 390 })),
      closePopup: jest.fn(),
    };

    const onMapUiApiReady = jest.fn();

    const { unmount } = renderHook(() =>
      useMapApi({
        map,
        L: {},
        onMapUiApiReady,
        travelData: [],
        userLocation: { lat: 53.9, lng: 27.5667 },
        routePoints: [],
        leafletBaseLayerRef: { current: null },
        leafletOverlayLayersRef: { current: new Map() },
        leafletControlRef: { current: null },
      })
    );

    await act(async () => {});

    const api = onMapUiApiReady.mock.calls.find((c: any[]) => c[0] != null)?.[0];
    expect(api).toBeTruthy();

    await act(async () => {
      api.centerOnUser();
    });

    expect(map.setView).toHaveBeenCalledWith([53.9, 27.5667], 13, expect.any(Object));
    expect(map.panBy).toHaveBeenCalledWith([84, -92], expect.any(Object));

    unmount();
  });

  it('focusOnCoord centers and zooms the map', async () => {
    const map = {
      setView: jest.fn(),
      closePopup: jest.fn(),
    };

    const onMapUiApiReady = jest.fn();

    const { unmount } = renderHook(() =>
      useMapApi({
        map,
        L: {},
        onMapUiApiReady,
        travelData: [],
        userLocation: null,
        routePoints: [],
        leafletBaseLayerRef: { current: null },
        leafletOverlayLayersRef: { current: new Map() },
        leafletControlRef: { current: null },
      })
    );

    // Let effects run
    await act(async () => {});

    const api = onMapUiApiReady.mock.calls.find((c: any[]) => c[0] != null)?.[0];
    expect(api).toBeTruthy();
    expect(typeof api.focusOnCoord).toBe('function');

    await act(async () => {
      api.focusOnCoord('50.0619474, 19.9368564', { zoom: 15 });
    });

    expect(map.closePopup).toHaveBeenCalled();
    expect(map.setView).toHaveBeenCalledWith([50.0619474, 19.9368564], 15, expect.any(Object));

    unmount();
  });

  it('openPopupForCoord opens marker popup on moveend', async () => {
    jest.useFakeTimers();

    const openPopup = jest.fn();
    const setZIndexOffset = jest.fn();

    const moveEndHandlers: Array<() => void> = [];
    const mapInstance = {
      once: jest.fn((event: string, cb: any) => {
        if (event === 'moveend') moveEndHandlers.push(cb);
      }),
    };

    const marker = {
      _map: mapInstance,
      openPopup,
      setZIndexOffset,
    };

    const markerByCoord = new Map<string, any>([['50.0, 19.0', marker]]);

    const map = {
      setView: jest.fn(),
      closePopup: jest.fn(),
    };

    const onMapUiApiReady = jest.fn();

    const leafletControlRef = { current: { markerByCoord }, markerByCoord };
    const { unmount } = renderHook(() =>
      useMapApi({
        map,
        L: {},
        onMapUiApiReady,
        travelData: [],
        userLocation: null,
        routePoints: [],
        leafletBaseLayerRef: { current: null },
        leafletOverlayLayersRef: { current: new Map() },
        leafletControlRef,
      })
    );

    await act(async () => {});

    const api = onMapUiApiReady.mock.calls.find((c: any[]) => c[0] != null)?.[0];
    expect(api).toBeTruthy();
    expect(typeof api.openPopupForCoord).toBe('function');

    await act(async () => {
      api.openPopupForCoord('50.0, 19.0');
    });

    // Not opened yet; waiting for moveend
    expect(openPopup).not.toHaveBeenCalled();

    // Fire moveend
    await act(async () => {
      moveEndHandlers.forEach((cb) => cb());
    });

    expect(setZIndexOffset).toHaveBeenCalledWith(1000);
    expect(openPopup).toHaveBeenCalledTimes(1);

    act(() => {
      jest.runOnlyPendingTimers();
    });

    unmount();
    jest.useRealTimers();
  });

  it('openPopupForCoord uses timeout fallback if moveend is not fired', async () => {
    jest.useFakeTimers();

    const openPopup = jest.fn();
    const setZIndexOffset = jest.fn();

    const mapInstance = {
      once: jest.fn(),
    };

    const marker = {
      _map: mapInstance,
      openPopup,
      setZIndexOffset,
    };

    const markerByCoord = new Map<string, any>([['50.0, 19.0', marker]]);

    const map = {
      setView: jest.fn(),
      closePopup: jest.fn(),
    };

    const onMapUiApiReady = jest.fn();

    const leafletControlRef = { current: { markerByCoord }, markerByCoord };
    const { unmount } = renderHook(() =>
      useMapApi({
        map,
        L: {},
        onMapUiApiReady,
        travelData: [],
        userLocation: null,
        routePoints: [],
        leafletBaseLayerRef: { current: null },
        leafletOverlayLayersRef: { current: new Map() },
        leafletControlRef,
      })
    );

    await act(async () => {});

    const api = onMapUiApiReady.mock.calls.find((c: any[]) => c[0] != null)?.[0];
    expect(api).toBeTruthy();

    await act(async () => {
      api.openPopupForCoord('50.0, 19.0');
    });

    act(() => {
      jest.advanceTimersByTime(420);
    });

    expect(setZIndexOffset).toHaveBeenCalledWith(1000);
    expect(openPopup).toHaveBeenCalledTimes(1);

    act(() => {
      jest.runOnlyPendingTimers();
    });

    unmount();
    jest.useRealTimers();
  });
});
