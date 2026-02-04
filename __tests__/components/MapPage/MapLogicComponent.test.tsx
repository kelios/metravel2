const React = require('react');
const { render, act } = require('@testing-library/react-native');

const { MapLogicComponent } = require('@/components/MapPage/Map/MapLogicComponent');

describe('MapLogicComponent radius fitBounds', () => {
  const originalRaf = global.requestAnimationFrame;

  beforeAll(() => {
    global.requestAnimationFrame = (cb: any) => cb(0);
  });

  afterAll(() => {
    global.requestAnimationFrame = originalRaf;
  });

  it('prefers circle center when auto-fitting without travel points', async () => {
    const fitBounds = jest.fn();
    const map = {
      fitBounds,
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

    render(
      <MapLogicComponent
        mapClickHandler={() => undefined}
        mode="radius"
        coordinates={{ lat: 50, lng: 10 }}
        userLocation={{ lat: 1, lng: 2 }}
        disableFitBounds={false}
        L={mockLeaflet}
        travelData={[]}
        circleCenter={{ lat: 53.9, lng: 27.5667 }}
        radiusInMeters={60000}
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
        useMap={useMap}
        useMapEvents={useMapEvents}
      />
    );

    await act(async () => {});

    expect(mockLeaflet.latLng).toHaveBeenCalledWith(53.9, 27.5667);
    expect(mockLeaflet.latLng).not.toHaveBeenCalledWith(1, 2);
    expect(fitBounds).toHaveBeenCalledWith(
      'padded-bounds',
      expect.objectContaining({
        animate: false,
        paddingTopLeft: [0, 0],
        paddingBottomRight: [0, 0],
      })
    );
  });

  it('falls back to fitting all points when radius filter keeps too few points', async () => {
    const fitBounds = jest.fn();
    const map = {
      fitBounds,
      setView: jest.fn(),
      closePopup: jest.fn(),
      invalidateSize: jest.fn(),
      getZoom: jest.fn(() => 11),
      getCenter: jest.fn(() => ({ lat: 50, lng: 10 })),
      on: jest.fn(),
      off: jest.fn(),
    };

    const useMap = jest.fn(() => map);
    const useMapEvents = jest.fn(() => null);

    const mockLeaflet = {
      latLng: jest.fn((lat: number, lng: number) => ({ lat, lng })),
      latLngBounds: jest.fn((_points: any[]) => ({
        pad: jest.fn(() => 'padded-bounds'),
      })),
      circle: jest.fn(() => ({
        getBounds: () => ({
          pad: jest.fn(() => 'padded-bounds'),
          getSouthWest: () => ({ lat: 49, lng: 9 }),
          getNorthEast: () => ({ lat: 51, lng: 11 }),
        }),
      })),
    };

    // 25 points total, but only 2 are within 60km of circleCenter (50,10).
    const near = [
      { id: 1, coord: '50.000000,10.000000', address: 'near-1' },
      { id: 2, coord: '50.010000,10.010000', address: 'near-2' },
    ];
    const far = Array.from({ length: 23 }).map((_, i) => ({
      id: 100 + i,
      coord: `55.${String(i).padStart(6, '0')},20.${String(i).padStart(6, '0')}`,
      address: `far-${i}`,
    }));

    render(
      <MapLogicComponent
        mapClickHandler={() => undefined}
        mode="radius"
        coordinates={{ lat: 50, lng: 10 }}
        userLocation={null}
        disableFitBounds={false}
        L={mockLeaflet}
        travelData={[...near, ...far] as any}
        circleCenter={{ lat: 50, lng: 10 }}
        radiusInMeters={60000}
        fitBoundsPadding={{ paddingTopLeft: [0, 0], paddingBottomRight: [0, 0] }}
        setMapZoom={jest.fn()}
        mapRef={{ current: null }}
        onMapReady={jest.fn()}
        savedMapViewRef={{ current: null }}
        hasInitializedRef={{ current: true }}
        lastModeRef={{ current: 'radius' }}
        lastAutoFitKeyRef={{ current: null }}
        leafletBaseLayerRef={{ current: null }}
        leafletOverlayLayersRef={{ current: new Map() }}
        leafletControlRef={{ current: null }}
        useMap={useMap}
        useMapEvents={useMapEvents}
        hintCenter={{ lat: 50, lng: 10 }}
      />
    );

    await act(async () => {});

    // When fallback triggers, latLngBounds should be created from ALL points,
    // not only the 2 near points.
    expect(mockLeaflet.latLngBounds).toHaveBeenCalledTimes(1);
    const pointsPassed = mockLeaflet.latLngBounds.mock.calls[0][0];
    expect(Array.isArray(pointsPassed)).toBe(true);
    expect(pointsPassed.length).toBeGreaterThanOrEqual(25);

    expect(fitBounds).toHaveBeenCalledWith(
      'padded-bounds',
      expect.objectContaining({
        animate: false,
      })
    );
  });
});
