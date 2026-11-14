const React = require('react');
const { render } = require('@testing-library/react-native');

const { MapLogicComponent } = require('@/components/MapPage/Map/MapLogicComponent');
const { MAP_COMPACT_MIN_FIT_ZOOM } = require('@/constants/mapDefaults');

// #3397 — the compact-pane zoom floor (#1348) rescues a wide radius CIRCLE. A
// surface without a circle (the quest catalog map) fits its own point set; with the
// floor applied to it, `/quests/map` on a phone opened at z11 on the centroid of
// all quests with none of them in the frame.
describe('MapLogicComponent point-set fit', () => {
  const originalRaf = global.requestAnimationFrame;

  beforeAll(() => {
    global.requestAnimationFrame = (cb: any) => cb(0);
  });

  afterAll(() => {
    global.requestAnimationFrame = originalRaf;
  });

  const ANCHOR = { lat: 49.37, lng: 26.28 };
  const PHONE_PANE = { x: 342, y: 696 };

  const setup = ({ fittedZoom, pane = PHONE_PANE }: { fittedZoom: number; pane?: { x: number; y: number } }) => {
    const map = {
      fitBounds: jest.fn(),
      setView: jest.fn(),
      closePopup: jest.fn(),
      getZoom: jest.fn(() => 11),
      getCenter: jest.fn(() => ANCHOR),
      getSize: jest.fn(() => pane),
      getBoundsZoom: jest.fn(() => fittedZoom),
      invalidateSize: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    };
    const paddedBounds = { getCenter: () => ({ lat: 34, lng: 33 }) };
    const bounds = {
      pad: jest.fn(() => paddedBounds),
      getSouthWest: () => ({ lat: 52.2, lng: 21 }),
      getNorthEast: () => ({ lat: 53.9, lng: 27.6 }),
      isValid: () => true,
      extend: jest.fn(),
    };
    const props = {
      mapClickHandler: () => undefined,
      mode: 'radius',
      coordinates: ANCHOR,
      userLocation: null,
      disableFitBounds: false,
      L: {
        latLng: jest.fn((lat: number, lng: number) => ({ lat, lng })),
        latLngBounds: jest.fn(() => bounds),
      },
      circleCenter: null,
      radiusInMeters: 50000,
      fitBoundsPadding: { paddingTopLeft: [24, 72], paddingBottomRight: [24, 0] },
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
      hintCenter: null,
      compactPane: true,
      travelData: [
        { id: 1, coord: '52.2297,21.0122', address: 'Warsaw quest' },
        { id: 2, coord: '53.9006,27.559', address: 'Minsk quest' },
      ],
    };
    return { map, paddedBounds, props };
  };

  it('fits the point set on a compact pane instead of flooring it to the circle zoom', async () => {
    const { map, paddedBounds, props } = setup({ fittedZoom: 6 });

    await render(<MapLogicComponent {...props} />);

    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(map.fitBounds).toHaveBeenCalledWith(paddedBounds, expect.objectContaining({ paddingTopLeft: [24, 72] }));
    expect(map.setView).not.toHaveBeenCalled();
    expect(props.onInitialViewReady).toHaveBeenCalledTimes(1);
  });

  it('floors a set wider than the pane can hold at the world-cover zoom, centred on the anchor', async () => {
    const { map, paddedBounds, props } = setup({ fittedZoom: 0 });

    await render(<MapLogicComponent {...props} />);

    // 696 px of pane need 2^2 * 256 px of world; the fit is judged with the same
    // pixel padding fitBounds would subtract.
    expect(map.getBoundsZoom).toHaveBeenCalledWith(paddedBounds, false, [48, 72]);
    expect(map.setView).toHaveBeenCalledWith(ANCHOR, 2, expect.objectContaining({ animate: false }));
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(props.onInitialViewReady).toHaveBeenCalledTimes(1);
  });

  it('applies the same world-cover floor on a wide pane', async () => {
    const { map, props } = setup({ fittedZoom: 1, pane: { x: 1048, y: 620 } });

    await render(<MapLogicComponent {...props} compactPane={false} />);

    expect(map.setView).toHaveBeenCalledWith(ANCHOR, 2, expect.anything());
  });

  it('keeps the #1348 floor for a radius circle on a compact pane', async () => {
    const { map, paddedBounds, props } = setup({ fittedZoom: 8 });

    await render(<MapLogicComponent {...props} circleCenter={ANCHOR} travelData={[]} />);

    expect(map.getBoundsZoom).toHaveBeenCalledWith(paddedBounds, false);
    expect(map.setView).toHaveBeenCalledWith({ lat: 34, lng: 33 }, MAP_COMPACT_MIN_FIT_ZOOM, expect.anything());
    expect(map.fitBounds).not.toHaveBeenCalled();
  });

  it('fits the whole circle on a wide pane', async () => {
    const { map, props } = setup({ fittedZoom: 8, pane: { x: 1048, y: 620 } });

    await render(<MapLogicComponent {...props} circleCenter={ANCHOR} travelData={[]} compactPane={false} />);

    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(map.setView).not.toHaveBeenCalled();
  });
});
