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

  it('does not setView until radius results are ready', async () => {
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

    // No results yet: should not initialize view.
    expect(map.setView).not.toHaveBeenCalled();

    rerender(
      <MapLogicComponent
        {...baseProps}
        travelData={[{ id: 1, coord: '53.9,27.5667', address: 'A' }]}
      />
    );

    await act(async () => {});

    // Results exist: initialization should happen; prefer circleCenter.
    // Initial zoom is derived from radius (60km -> 13).
    expect(map.setView).toHaveBeenCalledWith([53.9, 27.5667], 13, { animate: false });
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
