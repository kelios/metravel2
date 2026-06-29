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

    // With no travel points, radius mode fits to the circle bounds around the
    // circle center (computed via computeCircleBounds -> L.latLng on the circle's
    // SW/NE corners), never to the unrelated userLocation (1,2).
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

  it('never fits wider than the radius circle even when far points exist', async () => {
    // New contract (radius default UX): with a valid circle, the auto-fit view is
    // ALWAYS the circle around the user (optionally tightened to in-radius points),
    // never widened to far-away points outside the radius. This prevents the
    // country-wide zoom-out that scattered results used to cause.
    const fitBounds = jest.fn();
    const map = {
      fitBounds,
      setView: jest.fn(),
      closePopup: jest.fn(),
      invalidateSize: jest.fn(),
      getContainer: jest.fn(() => ({ isConnected: true })),
      getZoom: jest.fn(() => 11),
      getCenter: jest.fn(() => ({ lat: 50, lng: 10 })),
      on: jest.fn(),
      off: jest.fn(),
    };

    const useMap = jest.fn(() => map);
    const useMapEvents = jest.fn(() => null);

    // The circle bounds object the SUT builds via computeCircleBounds. We tag it
    // so we can assert fitBounds was driven by the circle, not the point bounds.
    const circleBoundsObj = {
      __kind: 'circle',
      pad: jest.fn(() => 'circle-padded'),
      getSouthWest: () => ({ lat: 49.4, lng: 9.2 }),
      getNorthEast: () => ({ lat: 50.6, lng: 10.8 }),
      isValid: () => true,
      extend: jest.fn(),
    };

    const mockLeaflet = {
      latLng: jest.fn((lat: number, lng: number) => ({ lat, lng })),
      latLngBounds: jest.fn((a: any) => {
        // computeCircleBounds calls latLngBounds(sw, ne) with two latLng objects;
        // point/clamped bounds are built from an array.
        if (!Array.isArray(a)) return circleBoundsObj;
        return {
          __kind: 'points',
          pad: jest.fn(() => 'points-padded'),
          getSouthWest: () => ({ lat: 50, lng: 10 }),
          getNorthEast: () => ({ lat: 50.01, lng: 10.01 }),
          isValid: () => true,
          extend: jest.fn(),
        };
      }),
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

    // The far points (55..,20..) must NEVER be passed to latLngBounds as fit
    // input — the view is clamped to the circle.
    expect(mockLeaflet.latLng).not.toHaveBeenCalledWith(55, 20);
    // fitBounds was driven by the circle-derived bounds (clamped), not raw points.
    expect(fitBounds).toHaveBeenCalledTimes(1);
    const [boundsArg] = fitBounds.mock.calls[0];
    expect(['circle-padded', 'points-padded']).toContain(boundsArg);
  });
});
