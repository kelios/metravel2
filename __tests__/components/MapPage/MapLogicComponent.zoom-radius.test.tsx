const React = require('react');
const { render, act } = require('@testing-library/react-native');

const { MapLogicComponent } = require('@/components/MapPage/Map/MapLogicComponent');

describe('MapLogicComponent radius zoom initialization', () => {
  const originalRaf = global.requestAnimationFrame;

  beforeAll(() => {
    global.requestAnimationFrame = (cb: any) => cb(0);
  });

  afterAll(() => {
    global.requestAnimationFrame = originalRaf;
  });

  // #1291 — стартовый вид применяется ровно один раз, сразу конечным. Промежуточный
  // радиусный зум (r=50 км → z13) убран: Leaflet успевал скачать его тайлы, хотя
  // авто-фит перекрывал этот вид до первого кадра.
  it('fits the radius circle without ever passing through an intermediate radius zoom', async () => {
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
      hasInitializedRef: { current: false },
      lastModeRef: { current: null },
      lastAutoFitKeyRef: { current: null },
      leafletBaseLayerRef: { current: null },
      leafletOverlayLayersRef: { current: new Map() },
      leafletControlRef: { current: null },
      useMap,
      useMapEvents,
    };

    const { rerender } = render(<MapLogicComponent {...baseProps} travelData={[]} />);

    await act(async () => {});

    // Круг вокруг пользователя виден с первого кадра, ещё до результатов, —
    // и это сразу конечный вид, а не промежуточный зум.
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(map.setView).not.toHaveBeenCalled();

    rerender(
      <MapLogicComponent
        {...baseProps}
        travelData={[{ id: 1, coord: '53.9,27.5667', address: 'A' }]}
      />
    );

    await act(async () => {});

    // Приход результатов только уточняет рамку тем же fitBounds; радиусного
    // setView (60 км → z13) не должно случиться ни разу за весь старт.
    expect(map.setView).not.toHaveBeenCalled();
    expect(map.fitBounds).toHaveBeenCalledTimes(2);
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
