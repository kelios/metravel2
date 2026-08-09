import { act, renderHook } from '@testing-library/react-native';

import { readMapViewportSnapshot, useMapViewportSnapshot } from '@/hooks/map/useMapViewportSnapshot';

describe('readMapViewportSnapshot', () => {
  it('derives bbox and zoom from a Leaflet-like map instance', () => {
    const snapshot = readMapViewportSnapshot(
      {
        getZoom: () => 8.6,
        getBounds: () => ({
          getSouth: () => 51,
          getWest: () => 23,
          getNorth: () => 56,
          getEast: () => 32,
        }),
      },
      11,
    );

    expect(snapshot).toEqual({
      bbox: { south: 51, west: 23, north: 56, east: 32 },
      zoom: 8.6,
    });
  });

  it('falls back to zoom without bbox when bounds are not available', () => {
    expect(readMapViewportSnapshot({ getZoom: () => 9 }, 11)).toEqual({
      bbox: null,
      zoom: 9,
    });
  });
});

// #1347 — the published snapshot drives the server-cluster query. Republishing it on
// every `moveend` cost a 70–320 KB request plus a full re-render of the map subtree
// for pans of a few hundred metres.
describe('useMapViewportSnapshot stickiness', () => {
  const makeMap = () => {
    const handlers = new Map<string, Array<() => void>>();
    const view = { south: 53.8, west: 27.4, north: 54.0, east: 27.8, zoom: 12 };
    return {
      view,
      instance: {
        getZoom: () => view.zoom,
        getBounds: () => ({
          getSouth: () => view.south,
          getWest: () => view.west,
          getNorth: () => view.north,
          getEast: () => view.east,
        }),
        on: (event: string, handler: () => void) => {
          handlers.set(event, [...(handlers.get(event) ?? []), handler]);
        },
        off: () => {},
      },
      fire: (event: string) => {
        for (const handler of handlers.get(event) ?? []) handler();
      },
    };
  };

  // The hook reads the viewport on rAF. The mock must stay ASYNC (queue + explicit
  // flush): invoking the callback synchronously would let the hook assign its frame
  // id AFTER the read cleared it, permanently blocking every later schedule.
  let frameQueue: FrameRequestCallback[] = [];

  const flushFrame = async () => {
    await act(async () => {
      const pending = frameQueue;
      frameQueue = [];
      for (const cb of pending) cb(0);
      await Promise.resolve();
    });
  };

  beforeEach(() => {
    frameQueue = [];
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: any) => {
      frameQueue.push(cb);
      return frameQueue.length as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('publishes a padded bbox and keeps it while the viewport stays inside', async () => {
    const map = makeMap();
    const { result } = renderHook(() => useMapViewportSnapshot(map.instance, 12, true));
    await flushFrame();

    const first = result.current;
    // 0.2 of the 0.2° lat span / 0.4° lng span.
    expect(first.bbox?.south).toBeCloseTo(53.76, 6);
    expect(first.bbox?.north).toBeCloseTo(54.04, 6);
    expect(first.bbox?.west).toBeCloseTo(27.32, 6);
    expect(first.bbox?.east).toBeCloseTo(27.88, 6);

    // Small pan: still inside the padded area → same snapshot object, no refetch.
    map.view.south += 0.02;
    map.view.north += 0.02;
    act(() => map.fire('moveend'));
    await flushFrame();
    expect(result.current).toBe(first);
  });

  it('republishes when the viewport leaves the fetched area', async () => {
    const map = makeMap();
    const { result } = renderHook(() => useMapViewportSnapshot(map.instance, 12, true));
    await flushFrame();
    const first = result.current;

    map.view.south += 0.5;
    map.view.north += 0.5;
    act(() => map.fire('moveend'));
    await flushFrame();

    expect(result.current).not.toBe(first);
    expect(result.current.bbox?.south).toBeGreaterThan(first.bbox!.south);
  });

  it('republishes when the rounded zoom changes even inside the fetched area', async () => {
    const map = makeMap();
    const { result } = renderHook(() => useMapViewportSnapshot(map.instance, 12, true));
    await flushFrame();
    const first = result.current;

    // Zooming in shrinks the viewport (still inside the padded bbox) but the server
    // clusters by zoom, so the query must follow.
    map.view.zoom = 13;
    map.view.south = 53.85;
    map.view.north = 53.95;
    act(() => map.fire('zoomend'));
    await flushFrame();

    expect(result.current).not.toBe(first);
    expect(result.current.zoom).toBe(13);
  });
});
