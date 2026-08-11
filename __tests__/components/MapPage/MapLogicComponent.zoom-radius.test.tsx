const React = require('react');
const { render, act } = require('@testing-library/react-native');

const {
  MapLogicComponent,
  shouldDeferRadiusAutoFit,
} = require('@/components/MapPage/Map/MapLogicComponent');

describe('MapLogicComponent radius zoom initialization', () => {
  const originalRaf = global.requestAnimationFrame;

  beforeAll(() => {
    global.requestAnimationFrame = (cb: any) => cb(0);
  });

  afterAll(() => {
    global.requestAnimationFrame = originalRaf;
  });

  it('runs the first radius fit synchronously, before base tiles can mount', () => {
    expect(shouldDeferRadiusAutoFit(false)).toBe(false);
    expect(shouldDeferRadiusAutoFit(true)).toBe(true);
  });

  // #1291 — map readiness and tile readiness are separate. Leaflet may publish
  // its instance while data is loading, but the base layer is enabled only after
  // the settled result set has synchronously applied the one final fit.
  it('waits for settled results, fits once, then enables base-layer startup once', async () => {
    const map = {
      fitBounds: jest.fn(),
      setView: jest.fn(),
      closePopup: jest.fn(),
      getZoom: jest.fn(() => 11),
      getCenter: jest.fn(() => ({ lat: 50, lng: 10 })),
      on: jest.fn(),
      off: jest.fn(),
    };

    const useMap = jest.fn(() => map);
    const useMapEvents = jest.fn(() => null);

    const mockBounds = {
      pad: jest.fn(() => 'padded-bounds'),
      getSouthWest: () => ({ lat: 53, lng: 27 }),
      getNorthEast: () => ({ lat: 54, lng: 28 }),
      isValid: () => true,
      extend: jest.fn(),
    };
    const mockLeaflet = {
      latLng: jest.fn((lat: number, lng: number) => ({ lat, lng })),
      latLngBounds: jest.fn(() => mockBounds),
    };

    const attachBaseLayer = jest.fn();
    const baseProps = {
      mapClickHandler: () => undefined,
      mode: 'radius',
      coordinates: { lat: 50, lng: 10 },
      userLocation: { lat: 1, lng: 2 },
      disableFitBounds: false,
      L: mockLeaflet,
      circleCenter: { lat: 53.9, lng: 27.5667 },
      radiusInMeters: 60000,
      fitBoundsPadding: { paddingTopLeft: [0, 0], paddingBottomRight: [0, 0] },
      setMapZoom: jest.fn(),
      mapRef: { current: null },
      onMapReady: jest.fn(),
      onInitialViewReady: attachBaseLayer,
      savedMapViewRef: { current: null },
      hasInitializedRef: { current: false },
      lastModeRef: { current: null },
      lastAutoFitKeyRef: { current: null },
      leafletBaseLayerRef: { current: null },
      leafletOverlayLayersRef: { current: new Map() },
      leafletControlRef: { current: null },
      useMap,
      useMapEvents,
    };

    const { rerender } = render(
      <MapLogicComponent
        {...baseProps}
        travelData={[]}
        initialResultsSettled={false}
      />,
    );

    await act(async () => {});

    expect(baseProps.onMapReady).toHaveBeenCalledWith(map);
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(map.setView).not.toHaveBeenCalled();
    expect(attachBaseLayer).not.toHaveBeenCalled();

    rerender(
      <MapLogicComponent
        {...baseProps}
        initialResultsSettled
        travelData={[{ id: 1, coord: '53.9,27.5667', address: 'A' }]}
      />
    );

    await act(async () => {});

    expect(map.setView).not.toHaveBeenCalled();
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(attachBaseLayer).toHaveBeenCalledTimes(1);
    expect(map.fitBounds.mock.invocationCallOrder[0]).toBeLessThan(
      attachBaseLayer.mock.invocationCallOrder[0],
    );

    rerender(
      <MapLogicComponent
        {...baseProps}
        initialResultsSettled
        travelData={[
          { id: 1, coord: '53.9,27.5667', address: 'A' },
          { id: 2, coord: '53.91,27.58', address: 'B' },
        ]}
      />,
    );
    await act(async () => {});

    // Later pages/refetches neither re-fit the same results state nor re-enable
    // an already enabled layer.
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(attachBaseLayer).toHaveBeenCalledTimes(1);
  });

  it('uses the radius circle as the explicit fallback for a settled empty result', async () => {
    const map = {
      fitBounds: jest.fn(),
      setView: jest.fn(),
      closePopup: jest.fn(),
      getZoom: jest.fn(() => 9),
      getCenter: jest.fn(() => ({ lat: 53.9, lng: 27.5667 })),
      on: jest.fn(),
      off: jest.fn(),
    };
    const bounds = {
      pad: jest.fn(() => 'padded-circle-bounds'),
      getSouthWest: () => ({ lat: 53, lng: 27 }),
      getNorthEast: () => ({ lat: 54, lng: 28 }),
      isValid: () => true,
      extend: jest.fn(),
    };
    const onInitialViewReady = jest.fn();
    const props = {
      mapClickHandler: () => undefined,
      mode: 'radius',
      coordinates: { lat: 53.9, lng: 27.5667 },
      userLocation: { lat: 53.9, lng: 27.5667 },
      disableFitBounds: false,
      L: {
        latLng: jest.fn((lat: number, lng: number) => ({ lat, lng })),
        latLngBounds: jest.fn(() => bounds),
      },
      travelData: [],
      circleCenter: { lat: 53.9, lng: 27.5667 },
      radiusInMeters: 50000,
      fitBoundsPadding: { paddingTopLeft: [0, 0], paddingBottomRight: [0, 0] },
      setMapZoom: jest.fn(),
      mapRef: { current: null },
      onMapReady: jest.fn(),
      onInitialViewReady,
      savedMapViewRef: { current: null },
      hasInitializedRef: { current: false },
      lastModeRef: { current: null },
      lastAutoFitKeyRef: { current: null },
      leafletBaseLayerRef: { current: null },
      leafletOverlayLayersRef: { current: new Map() },
      leafletControlRef: { current: null },
      useMap: jest.fn(() => map),
      useMapEvents: jest.fn(() => null),
    };

    render(<MapLogicComponent {...props} initialResultsSettled />);
    await act(async () => {});

    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(map.fitBounds).toHaveBeenCalledWith(
      'padded-circle-bounds',
      expect.objectContaining({ animate: false, maxZoom: 16 }),
    );
    expect(onInitialViewReady).toHaveBeenCalledTimes(1);
    expect(map.fitBounds.mock.invocationCallOrder[0]).toBeLessThan(
      onInitialViewReady.mock.invocationCallOrder[0],
    );
  });

  it('retries a transient first-frame fit failure before enabling base layers', async () => {
    const map = {
      fitBounds: jest
        .fn()
        .mockImplementationOnce(() => {
          throw new Error('pane is not ready');
        })
        .mockImplementationOnce(() => undefined),
      setView: jest.fn(),
      closePopup: jest.fn(),
      getZoom: jest.fn(() => 9),
      getCenter: jest.fn(() => ({ lat: 53.9, lng: 27.5667 })),
      on: jest.fn(),
      off: jest.fn(),
    };
    const bounds = {
      pad: jest.fn(() => 'padded-bounds'),
      getSouthWest: () => ({ lat: 53, lng: 27 }),
      getNorthEast: () => ({ lat: 54, lng: 28 }),
      isValid: () => true,
      extend: jest.fn(),
    };
    const onInitialViewReady = jest.fn();

    render(
      <MapLogicComponent
        mapClickHandler={() => undefined}
        mode="radius"
        coordinates={{ lat: 53.9, lng: 27.5667 }}
        userLocation={{ lat: 53.9, lng: 27.5667 }}
        disableFitBounds={false}
        L={{
          latLng: jest.fn((lat: number, lng: number) => ({ lat, lng })),
          latLngBounds: jest.fn(() => bounds),
        }}
        travelData={[{ id: 1, coord: '53.9,27.5667', address: 'A' }]}
        initialResultsSettled
        onInitialViewReady={onInitialViewReady}
        circleCenter={{ lat: 53.9, lng: 27.5667 }}
        radiusInMeters={50000}
        fitBoundsPadding={{ paddingTopLeft: [0, 0], paddingBottomRight: [0, 0] }}
        setMapZoom={jest.fn()}
        mapRef={{ current: null }}
        onMapReady={jest.fn()}
        savedMapViewRef={{ current: null }}
        hasInitializedRef={{ current: false }}
        lastModeRef={{ current: null }}
        lastAutoFitKeyRef={{ current: null }}
        leafletBaseLayerRef={{ current: null }}
        leafletOverlayLayersRef={{ current: new Map() }}
        leafletControlRef={{ current: null }}
        useMap={jest.fn(() => map)}
        useMapEvents={jest.fn(() => null)}
      />,
    );
    await act(async () => {});

    expect(map.fitBounds).toHaveBeenCalledTimes(2);
    expect(onInitialViewReady).toHaveBeenCalledTimes(1);
    expect(map.fitBounds.mock.invocationCallOrder[1]).toBeLessThan(
      onInitialViewReady.mock.invocationCallOrder[0],
    );
  });

  it('releases a cancelled first-fit retry so a newer result can apply the viewport', async () => {
    const priorRaf = global.requestAnimationFrame;
    const priorCancelRaf = global.cancelAnimationFrame;
    const queuedFrames = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;
    global.requestAnimationFrame = jest.fn((callback: FrameRequestCallback) => {
      const id = nextFrameId++;
      queuedFrames.set(id, callback);
      return id;
    });
    global.cancelAnimationFrame = jest.fn((id: number) => {
      queuedFrames.delete(id);
    });

    try {
      const map = {
        fitBounds: jest
          .fn()
          .mockImplementationOnce(() => {
            throw new Error('pane is not ready');
          })
          .mockImplementationOnce(() => undefined),
        setView: jest.fn(),
        closePopup: jest.fn(),
        getZoom: jest.fn(() => 9),
        getCenter: jest.fn(() => ({ lat: 53.9, lng: 27.5667 })),
        on: jest.fn(),
        off: jest.fn(),
      };
      const bounds = {
        pad: jest.fn(() => 'padded-bounds'),
        getSouthWest: () => ({ lat: 53, lng: 27 }),
        getNorthEast: () => ({ lat: 54, lng: 28 }),
        isValid: () => true,
        extend: jest.fn(),
      };
      const onInitialViewReady = jest.fn();
      const lastAutoFitKeyRef = { current: null as string | null };
      const baseProps = {
        mapClickHandler: () => undefined,
        mode: 'radius' as const,
        coordinates: { lat: 53.9, lng: 27.5667 },
        userLocation: { lat: 53.9, lng: 27.5667 },
        disableFitBounds: false,
        L: {
          latLng: jest.fn((lat: number, lng: number) => ({ lat, lng })),
          latLngBounds: jest.fn(() => bounds),
        },
        initialResultsSettled: true,
        onInitialViewReady,
        circleCenter: { lat: 53.9, lng: 27.5667 },
        radiusInMeters: 50000,
        fitBoundsPadding: { paddingTopLeft: [0, 0], paddingBottomRight: [0, 0] },
        setMapZoom: jest.fn(),
        mapRef: { current: null },
        onMapReady: jest.fn(),
        savedMapViewRef: { current: null },
        hasInitializedRef: { current: false },
        lastModeRef: { current: null },
        lastAutoFitKeyRef,
        leafletBaseLayerRef: { current: null },
        leafletOverlayLayersRef: { current: new Map() },
        leafletControlRef: { current: null },
        useMap: jest.fn(() => map),
        useMapEvents: jest.fn(() => null),
      };

      const { rerender } = render(
        <MapLogicComponent
          {...baseProps}
          travelData={[{ id: 1, coord: '53.9,27.5667', address: 'A' }]}
        />,
      );
      await act(async () => {});
      expect(map.fitBounds).toHaveBeenCalledTimes(1);
      expect(onInitialViewReady).not.toHaveBeenCalled();
      expect(queuedFrames.size).toBe(1);

      rerender(
        <MapLogicComponent
          {...baseProps}
          travelData={[
            { id: 1, coord: '53.9,27.5667', address: 'A' },
            { id: 2, coord: '53.91,27.58', address: 'B' },
          ]}
        />,
      );
      await act(async () => {});

      expect(global.cancelAnimationFrame).toHaveBeenCalled();
      expect(map.fitBounds).toHaveBeenCalledTimes(2);
      expect(onInitialViewReady).toHaveBeenCalledTimes(1);
    } finally {
      global.requestAnimationFrame = priorRaf;
      global.cancelAnimationFrame = priorCancelRaf;
    }
  });

  // #1291 — авто-фит стал единственным владельцем стартового вида, поэтому
  // именно он теперь отвечает и за переключение режимов: раньше это делал
  // удалённый radius-setView, и без явного контракта переходы ломались молча.
  describe('mode switching after the startup view is applied', () => {
    const makeMap = () => ({
      fitBounds: jest.fn(),
      setView: jest.fn(),
      closePopup: jest.fn(),
      getZoom: jest.fn(() => 9),
      getCenter: jest.fn(() => ({ lat: 53.9, lng: 27.5667 })),
      on: jest.fn(),
      off: jest.fn(),
    });

    const makeProps = (map: ReturnType<typeof makeMap>) => {
      const mockBounds = {
        pad: jest.fn(() => 'padded-bounds'),
        getSouthWest: () => ({ lat: 53, lng: 27 }),
        getNorthEast: () => ({ lat: 54, lng: 28 }),
        isValid: () => true,
        extend: jest.fn(),
      };
      return {
        mapClickHandler: () => undefined,
        mode: 'radius',
        coordinates: { lat: 53.9, lng: 27.5667 },
        userLocation: { lat: 53.9, lng: 27.5667 },
        disableFitBounds: false,
        L: {
          latLng: jest.fn((lat: number, lng: number) => ({ lat, lng })),
          latLngBounds: jest.fn(() => mockBounds),
        },
        circleCenter: { lat: 53.9, lng: 27.5667 },
        radiusInMeters: 50000,
        fitBoundsPadding: { paddingTopLeft: [0, 0], paddingBottomRight: [0, 0] },
        setMapZoom: jest.fn(),
        mapRef: { current: null },
        onMapReady: jest.fn(),
        savedMapViewRef: { current: null },
        hasInitializedRef: { current: false },
        lastModeRef: { current: null },
        lastAutoFitKeyRef: { current: null },
        leafletBaseLayerRef: { current: null },
        leafletOverlayLayersRef: { current: new Map() },
        leafletControlRef: { current: null },
        useMap: jest.fn(() => map),
        useMapEvents: jest.fn(() => null),
        hintCenter: { lat: 53.9, lng: 27.5667 },
        travelData: [{ id: 1, coord: '53.9,27.5667', address: 'A' }],
      };
    };

    it('does not re-apply the route initial view once the radius view is fitted', async () => {
      const map = makeMap();
      const props = makeProps(map);

      const { rerender } = render(<MapLogicComponent {...props} />);
      await act(async () => {});
      expect(map.fitBounds).toHaveBeenCalled();

      map.setView.mockClear();
      rerender(<MapLogicComponent {...props} mode="route" />);
      await act(async () => {});

      // Вход в маршрут не выбрасывает уже применённый вид на анкер в z13.
      expect(map.setView).not.toHaveBeenCalled();
    });

    it('re-applies the radius view when coming back from route mode', async () => {
      const map = makeMap();
      const props = makeProps(map);

      const { rerender } = render(<MapLogicComponent {...props} />);
      await act(async () => {});

      rerender(<MapLogicComponent {...props} mode="route" />);
      await act(async () => {});

      map.fitBounds.mockClear();
      rerender(<MapLogicComponent {...props} mode="radius" />);
      await act(async () => {});

      // Маршрутный fitBounds увёл карту в коридор маршрута — радиусный вид
      // обязан вернуться, иначе пользователь остаётся на чужой рамке.
      expect(map.fitBounds).toHaveBeenCalledTimes(1);
    });
  });

  it('recomputes fitBounds when radius changes', async () => {
    const map = {
      fitBounds: jest.fn(),
      setView: jest.fn(),
      closePopup: jest.fn(),
      getZoom: jest.fn(() => 11),
      getCenter: jest.fn(() => ({ lat: 50, lng: 10 })),
      on: jest.fn(),
      off: jest.fn(),
    };

    const useMap = jest.fn(() => map);
    const useMapEvents = jest.fn(() => null);

    const mockLeaflet = {
      latLng: jest.fn((lat: number, lng: number) => ({ lat, lng })),
      latLngBounds: jest.fn(() => ({
        pad: jest.fn(() => 'padded-bounds'),
      })),
      circle: jest.fn(() => ({
        getBounds: () => ({
          pad: jest.fn(() => 'padded-bounds'),
          getSouthWest: () => ({ lat: 53, lng: 27 }),
          getNorthEast: () => ({ lat: 54, lng: 28 }),
        }),
      })),
    };

    const baseProps = {
      mapClickHandler: () => undefined,
      mode: 'radius',
      coordinates: { lat: 50, lng: 10 },
      userLocation: { lat: 1, lng: 2 },
      disableFitBounds: false,
      L: mockLeaflet,
      circleCenter: { lat: 53.9, lng: 27.5667 },
      radiusInMeters: 60000,
      fitBoundsPadding: { paddingTopLeft: [0, 0], paddingBottomRight: [0, 0] },
      setMapZoom: jest.fn(),
      mapRef: { current: null },
      onMapReady: jest.fn(),
      savedMapViewRef: { current: null },
      hasInitializedRef: { current: true },
      lastModeRef: { current: 'radius' },
      lastAutoFitKeyRef: { current: null },
      leafletBaseLayerRef: { current: null },
      leafletOverlayLayersRef: { current: new Map() },
      leafletControlRef: { current: null },
      useMap,
      useMapEvents,
    };

    const travelData = [{ id: 1, coord: '53.9,27.5667', address: 'A' }];

    const { rerender } = render(<MapLogicComponent {...baseProps} travelData={travelData} />);
    await act(async () => {});
    expect(map.fitBounds).toHaveBeenCalledTimes(1);

    map.fitBounds.mockClear();

    rerender(
      <MapLogicComponent
        {...baseProps}
        travelData={travelData}
        radiusInMeters={120000}
      />
    );
    await act(async () => {});
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('keeps the fitted viewport when a later results page changes only point composition', async () => {
    const map = {
      fitBounds: jest.fn(),
      setView: jest.fn(),
      closePopup: jest.fn(),
      getZoom: jest.fn(() => 14),
      getCenter: jest.fn(() => ({ lat: 53.9, lng: 27.56 })),
      on: jest.fn(),
      off: jest.fn(),
    };

    const useMap = jest.fn(() => map);
    const useMapEvents = jest.fn(() => null);
    const mockBounds = {
      pad: jest.fn(() => 'padded-bounds'),
      getSouthWest: () => ({ lat: 53, lng: 27 }),
      getNorthEast: () => ({ lat: 54, lng: 28 }),
      isValid: () => true,
      extend: jest.fn(),
    };
    const L = {
      latLng: jest.fn((lat: number, lng: number) => ({ lat, lng })),
      latLngBounds: jest.fn(() => mockBounds),
    };
    const baseProps = {
      mapClickHandler: () => undefined,
      mode: 'radius',
      coordinates: { lat: 53.9, lng: 27.56 },
      userLocation: { lat: 53.9, lng: 27.56 },
      disableFitBounds: false,
      L,
      circleCenter: { lat: 53.9, lng: 27.56 },
      radiusInMeters: 60000,
      fitBoundsPadding: { paddingTopLeft: [0, 0], paddingBottomRight: [0, 0] },
      setMapZoom: jest.fn(),
      mapRef: { current: null },
      onMapReady: jest.fn(),
      savedMapViewRef: { current: null },
      hasInitializedRef: { current: true },
      lastModeRef: { current: 'radius' },
      lastAutoFitKeyRef: { current: null },
      leafletBaseLayerRef: { current: null },
      leafletOverlayLayersRef: { current: new Map() },
      leafletControlRef: { current: null },
      useMap,
      useMapEvents,
      hintCenter: { lat: 53.9, lng: 27.56 },
    };
    const firstPage = [{ id: 1, coord: '53.9,27.56', address: 'A' }];
    const { rerender } = render(
      <MapLogicComponent {...baseProps} travelData={firstPage} />,
    );
    await act(async () => {});
    expect(map.fitBounds).toHaveBeenCalledTimes(1);

    map.fitBounds.mockClear();
    map.setView.mockClear();

    rerender(
      <MapLogicComponent
        {...baseProps}
        travelData={[
          ...firstPage,
          { id: 2, coord: '53.95,27.62', address: 'B' },
        ]}
      />,
    );
    await act(async () => {});

    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(map.setView).not.toHaveBeenCalled();
  });

  it('does not re-fit on small user location drift after the radius view is fitted', async () => {
    const map = {
      fitBounds: jest.fn(),
      setView: jest.fn(),
      closePopup: jest.fn(),
      getZoom: jest.fn(() => 14),
      getCenter: jest.fn(() => ({ lat: 53.9001, lng: 27.5601 })),
      on: jest.fn(),
      off: jest.fn(),
    };

    const useMap = jest.fn(() => map);
    const useMapEvents = jest.fn(() => null);

    const mockLeaflet = {
      latLng: jest.fn((lat: number, lng: number) => ({ lat, lng })),
      latLngBounds: jest.fn(() => ({
        pad: jest.fn(() => 'padded-bounds'),
        getSouthWest: () => ({ lat: 53, lng: 27 }),
        getNorthEast: () => ({ lat: 54, lng: 28 }),
        isValid: () => true,
        extend: jest.fn(),
      })),
    };

    const baseProps = {
      mapClickHandler: () => undefined,
      mode: 'radius',
      coordinates: { lat: 53.9001, lng: 27.5601 },
      userLocation: { lat: 53.9001, lng: 27.5601 },
      disableFitBounds: false,
      L: mockLeaflet,
      circleCenter: { lat: 53.9001, lng: 27.5601 },
      radiusInMeters: 60000,
      fitBoundsPadding: { paddingTopLeft: [0, 0], paddingBottomRight: [0, 0] },
      setMapZoom: jest.fn(),
      mapRef: { current: null },
      onMapReady: jest.fn(),
      savedMapViewRef: { current: null },
      hasInitializedRef: { current: true },
      lastModeRef: { current: 'radius' },
      lastAutoFitKeyRef: { current: null },
      leafletBaseLayerRef: { current: null },
      leafletOverlayLayersRef: { current: new Map() },
      leafletControlRef: { current: null },
      useMap,
      useMapEvents,
      hintCenter: { lat: 53.9001, lng: 27.5601 },
    };

    const travelData = [{ id: 1, coord: '53.9001,27.5601', address: 'A' }];

    const { rerender } = render(<MapLogicComponent {...baseProps} travelData={travelData} />);
    await act(async () => {});
    expect(map.fitBounds).toHaveBeenCalledTimes(1);

    map.fitBounds.mockClear();
    map.setView.mockClear();

    rerender(
      <MapLogicComponent
        {...baseProps}
        coordinates={{ lat: 53.9002, lng: 27.5602 }}
        userLocation={{ lat: 53.9002, lng: 27.5602 }}
        circleCenter={{ lat: 53.9002, lng: 27.5602 }}
        hintCenter={{ lat: 53.9002, lng: 27.5602 }}
        travelData={travelData}
      />
    );
    await act(async () => {});

    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(map.setView).not.toHaveBeenCalled();
  });

  it('keeps the fitted viewport stable on a later live-location tick', async () => {
    const map = {
      fitBounds: jest.fn(),
      setView: jest.fn(),
      closePopup: jest.fn(),
      getZoom: jest.fn(() => 14),
      getCenter: jest.fn(() => ({ lat: 53.9, lng: 27.56 })),
      on: jest.fn(),
      off: jest.fn(),
    };
    const useMap = jest.fn(() => map);
    const useMapEvents = jest.fn(() => null);
    const mockBounds = {
      pad: jest.fn(() => 'padded-bounds'),
      getSouthWest: () => ({ lat: 53, lng: 27 }),
      getNorthEast: () => ({ lat: 54, lng: 28 }),
      isValid: () => true,
      extend: jest.fn(),
    };
    const L = {
      latLng: jest.fn((lat: number, lng: number) => ({ lat, lng })),
      latLngBounds: jest.fn(() => mockBounds),
    };
    const baseProps = {
      mapClickHandler: () => undefined,
      mode: 'radius',
      coordinates: { lat: 53.9, lng: 27.56 },
      userLocation: { lat: 53.9, lng: 27.56 },
      disableFitBounds: false,
      L,
      circleCenter: { lat: 53.9, lng: 27.56 },
      radiusInMeters: 60000,
      fitBoundsPadding: { paddingTopLeft: [0, 0], paddingBottomRight: [0, 0] },
      setMapZoom: jest.fn(),
      mapRef: { current: null },
      onMapReady: jest.fn(),
      savedMapViewRef: { current: null },
      hasInitializedRef: { current: true },
      lastModeRef: { current: 'radius' },
      lastAutoFitKeyRef: { current: null },
      leafletBaseLayerRef: { current: null },
      leafletOverlayLayersRef: { current: new Map() },
      leafletControlRef: { current: null },
      useMap,
      useMapEvents,
      hintCenter: { lat: 53.9, lng: 27.56 },
    };
    const travelData = [{ id: 1, coord: '53.9,27.56', address: 'A' }];
    const { rerender } = render(<MapLogicComponent {...baseProps} travelData={travelData} />);
    await act(async () => {});
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    map.fitBounds.mockClear();
    map.setView.mockClear();

    rerender(
      <MapLogicComponent
        {...baseProps}
        userLocation={{ lat: 53.9111, lng: 27.5695 }}
        travelData={travelData}
      />
    );
    await act(async () => {});

    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(map.setView).not.toHaveBeenCalled();
  });
});
