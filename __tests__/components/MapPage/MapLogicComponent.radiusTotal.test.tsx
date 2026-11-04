/** @jest-environment-options {"url":"https://example.test/map"} */

const React = require('react');
const { render, act } = require('@testing-library/react-native');

const { MapLogicComponent } = require('@/components/MapPage/Map/MapLogicComponent');
const { DEFAULT_MAP_CENTER, DEFAULT_RADIUS_KM, MAP_COLLAPSED_SHEET_OFFSET } = require('@/constants/mapDefaults');
const { getMapFitBoundsPadding } = require('@/components/MapPage/Map/mapFitBoundsPadding');

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
      pad: jest.fn(() => ({ getCenter: () => ({ lat: DEFAULT_MAP_CENTER.latitude, lng: DEFAULT_MAP_CENTER.longitude }) })),
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

  it.each([0, 2])('uses the startup tile zoom with %i settled results and restores normal later fits', async (total) => {
    const { map, pointBounds, props, travelData } = setup();
    Object.assign(map, {
      getBoundsZoom: jest.fn().mockReturnValueOnce(8).mockReturnValue(12),
      project: jest.fn(() => ({ x: 10, y: 20 })),
      unproject: jest.fn(({ x, y }: { x: number; y: number }) => ({ lat: x, lng: y })),
    });
    const shell = document.createElement('div');
    shell.id = 'ssg-skeleton';
    shell.innerHTML = '<img data-ssg-map-tile data-ssg-map-startup-circle="true" src="/proxy/tiles/osm/11/1180/658.png">';
    document.body.appendChild(shell);
    const compactProps = {
      ...props,
      circleCenter: { lat: DEFAULT_MAP_CENTER.latitude, lng: DEFAULT_MAP_CENTER.longitude },
      compactPane: true,
      fitBoundsPadding: getMapFitBoundsPadding('radius', true, MAP_COLLAPSED_SHEET_OFFSET),
    };
    try {
      const view = await render(
        <MapLogicComponent {...compactProps} travelData={total ? travelData : []} radiusInMeters={DEFAULT_RADIUS_KM * 1000} travelsTotal={total} />,
      );
      expect(map.setView).toHaveBeenCalledWith({ lat: 10, lng: 92 }, 11, expect.objectContaining({ animate: false }));
      expect(map.fitBounds).not.toHaveBeenCalled();
      expect(pointBounds.extend).not.toHaveBeenCalled();
      shell.remove();

      await view.rerender(
        <MapLogicComponent {...compactProps} travelData={[...travelData]} radiusInMeters={DEFAULT_RADIUS_KM * 1000} travelsTotal={2} />,
      );
      expect(map.fitBounds).toHaveBeenCalledTimes(total ? 0 : 1);

      await view.rerender(
        <MapLogicComponent {...compactProps} travelData={travelData} radiusInMeters={25000} travelsTotal={2} />,
      );
      expect(map.fitBounds).toHaveBeenCalledTimes(total ? 1 : 2);
      expect(pointBounds.extend).toHaveBeenCalled();
    } finally {
      shell.remove();
    }
  });

  it.each(['unmarked tile', 'custom search'])('retains the normal first fit with a %s', async (scenario) => {
    const { map, pointBounds, props, travelData } = setup();
    const shell = document.createElement('div');
    shell.id = 'ssg-skeleton';
    shell.innerHTML = '<img data-ssg-map-tile src="/proxy/tiles/osm/11/1180/658.png">';
    if (scenario === 'custom search') {
      shell.querySelector('img')?.setAttribute('data-ssg-map-startup-circle', 'true');
      window.history.replaceState(null, '', '/map?categories=23');
    }
    document.body.appendChild(shell);
    try {
      await render(<MapLogicComponent
        {...props}
        circleCenter={{ lat: DEFAULT_MAP_CENTER.latitude, lng: DEFAULT_MAP_CENTER.longitude }}
        compactPane
        fitBoundsPadding={getMapFitBoundsPadding('radius', true, MAP_COLLAPSED_SHEET_OFFSET)}
        travelData={travelData}
        radiusInMeters={DEFAULT_RADIUS_KM * 1000}
        travelsTotal={2}
      />);
      expect(map.fitBounds).toHaveBeenCalledTimes(1);
      expect(pointBounds.extend).toHaveBeenCalled();
    } finally {
      window.history.replaceState(null, '', '/map');
      shell.remove();
    }
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
