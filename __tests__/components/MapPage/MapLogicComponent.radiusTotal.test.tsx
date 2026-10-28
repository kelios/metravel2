const React = require('react');
const { render, act } = require('@testing-library/react-native');

const { MapLogicComponent } = require('@/components/MapPage/Map/MapLogicComponent');

// #2450 — the radius auto-fit tightens the view to the loaded points only when they
// are the WHOLE result set. Page 1 (30 nearest of 576) used to zoom a 200 km radius
// into a 20 km box around the anchor and show two markers.
describe('MapLogicComponent radius auto-fit vs. server total', () => {
  const originalRaf = global.requestAnimationFrame;

  beforeAll(() => {
    global.requestAnimationFrame = (cb: any) => cb(0);
  });

  afterAll(() => {
    global.requestAnimationFrame = originalRaf;
  });

  const setup = () => {
    const map = {
      fitBounds: jest.fn(),
      setView: jest.fn(),
      closePopup: jest.fn(),
      getZoom: jest.fn(() => 11),
      getCenter: jest.fn(() => ({ lat: 53.9, lng: 27.5667 })),
      invalidateSize: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    };
    const pointBounds = {
      pad: jest.fn(() => 'padded-bounds'),
      getSouthWest: () => ({ lat: 53.89, lng: 27.55 }),
      getNorthEast: () => ({ lat: 53.92, lng: 27.6 }),
      isValid: () => true,
      extend: jest.fn(),
    };
    const mockLeaflet = {
      latLng: jest.fn((lat: number, lng: number) => ({ lat, lng })),
      latLngBounds: jest.fn(() => pointBounds),
    };
    const props = {
      mapClickHandler: () => undefined,
      mode: 'radius',
      coordinates: { lat: 53.9, lng: 27.5667 },
      userLocation: null,
      disableFitBounds: false,
      L: mockLeaflet,
      circleCenter: { lat: 53.9, lng: 27.5667 },
      radiusInMeters: 200000,
      fitBoundsPadding: { paddingTopLeft: [0, 0], paddingBottomRight: [0, 0] },
      setMapZoom: jest.fn(),
      mapRef: { current: null },
      onMapReady: jest.fn(),
      onInitialViewReady: jest.fn(),
      savedMapViewRef: { current: null },
      hasInitializedRef: { current: false },
      lastModeRef: { current: null },
      lastAutoFitKeyRef: { current: null },
      leafletBaseLayerRef: { current: null },
      leafletOverlayLayersRef: { current: new Map() },
      leafletControlRef: { current: null },
      useMap: jest.fn(() => map),
      useMapEvents: jest.fn(() => null),
      initialResultsSettled: true,
    };
    const travelData = [
      { id: 1, coord: '53.9,27.5667', address: 'A' },
      { id: 2, coord: '53.91,27.58', address: 'B' },
    ];
    return { map, pointBounds, props, travelData };
  };

  it('does not tighten to page 1 when the server total is larger than the loaded set', async () => {
    const { map, pointBounds, props, travelData } = setup();
    await render(<MapLogicComponent {...props} travelData={travelData} travelsTotal={576} />);
    await act(async () => {});
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    // The tighten branch extends the point bounds with the centre; it must not run.
    expect(pointBounds.extend).not.toHaveBeenCalled();
  });

  it('tightens to the points when they are the whole result set', async () => {
    const { map, pointBounds, props, travelData } = setup();
    await render(<MapLogicComponent {...props} travelData={travelData} travelsTotal={2} />);
    await act(async () => {});
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(pointBounds.extend).toHaveBeenCalled();
  });

  it('does not tighten to placeholder points while the active query is unsettled (null total)', async () => {
    // A radius change after the startup latch: travelData/total still belong to the
    // previous radius. Tightening to them would keep the old small area on screen.
    const { map, pointBounds, props, travelData } = setup();
    await render(<MapLogicComponent {...props} travelData={travelData} travelsTotal={null} />);
    await act(async () => {});
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(pointBounds.extend).not.toHaveBeenCalled();
  });

  it('treats an omitted total as complete (legacy callers)', async () => {
    const { pointBounds, props, travelData } = setup();
    await render(<MapLogicComponent {...props} travelData={travelData} />);
    await act(async () => {});
    expect(pointBounds.extend).toHaveBeenCalled();
  });
});
