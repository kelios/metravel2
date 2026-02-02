const React = require('react');
const { render, act } = require('@testing-library/react-native');

const { MapLogicComponent } = require('@/components/MapPage/Map/MapLogicComponent');

describe('MapLogicComponent radius zoom initialization', () => {
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
    expect(map.setView).toHaveBeenCalledWith([53.9, 27.5667], 11, { animate: false });
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
});
