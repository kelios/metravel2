import {
  ROUTE_NAVIGATORS,
  buildNavigatorUrl,
  extractRouteStops,
} from '@/utils/routeExport';

describe('routeExport navigator', () => {
  const waypoints = [
    { name: 'Start', coordinates: [27.56, 53.9] as [number, number] },
    { name: 'Mid', coordinates: [27.6, 53.95] as [number, number] },
    { name: 'End', coordinates: [27.7, 54.0] as [number, number] },
  ];

  describe('extractRouteStops', () => {
    it('prefers waypoints in order', () => {
      expect(extractRouteStops({ waypoints })).toEqual([
        [27.56, 53.9],
        [27.6, 53.95],
        [27.7, 54.0],
      ]);
    });

    it('falls back to track endpoints', () => {
      const stops = extractRouteStops({
        track: [
          [27.5, 53.9],
          [27.6, 53.95],
          [27.7, 54.0],
        ],
      });
      expect(stops).toEqual([
        [27.5, 53.9],
        [27.7, 54.0],
      ]);
    });

    it('returns empty for a route without coordinates', () => {
      expect(extractRouteStops({})).toEqual([]);
    });
  });

  describe('buildNavigatorUrl (google)', () => {
    it('encodes origin, destination and intermediate waypoints as lat,lng', () => {
      const url = buildNavigatorUrl('google', { waypoints });
      expect(url).toContain('origin=53.9%2C27.56');
      expect(url).toContain('destination=54%2C27.7');
      // pipe-joined intermediate waypoints, URL-encoded
      expect(url).toContain('waypoints=53.95%2C27.6');
      expect(url).toContain('travelmode=driving');
    });

    it('maps cycling to the bicycling travel mode', () => {
      const url = buildNavigatorUrl('google', { waypoints }, { mode: 'cycling' });
      expect(url).toContain('travelmode=bicycling');
    });

    it('uses only a destination for a single stop', () => {
      const url = buildNavigatorUrl('google', { waypoints: [waypoints[0]] });
      expect(url).toContain('destination=53.9%2C27.56');
      expect(url).not.toContain('origin=');
    });

    it('caps intermediate waypoints at 9', () => {
      const many = Array.from({ length: 15 }, (_, i) => ({
        coordinates: [27 + i * 0.01, 53 + i * 0.01] as [number, number],
      }));
      const url = buildNavigatorUrl('google', { waypoints: many })!;
      const wp = new URL(url).searchParams.get('waypoints')!;
      expect(wp.split('|')).toHaveLength(9);
    });
  });

  describe('buildNavigatorUrl (apple)', () => {
    it('builds a single origin to destination leg', () => {
      const url = buildNavigatorUrl('apple', { waypoints });
      expect(url).toContain('saddr=53.9%2C27.56');
      expect(url).toContain('daddr=54%2C27.7');
      expect(url).toContain('dirflg=d');
    });

    it('maps walking to the w direction flag', () => {
      const url = buildNavigatorUrl('apple', { waypoints }, { mode: 'walking' });
      expect(url).toContain('dirflg=w');
    });
  });

  describe('buildNavigatorUrl (yandex / osmand, #2902)', () => {
    it('joins all stops into a Yandex rtext route with the mode flag', () => {
      expect(buildNavigatorUrl('yandex', { waypoints }, { mode: 'walking' })).toBe(
        'https://yandex.ru/maps/?rtext=53.9,27.56~53.95,27.6~54,27.7&rtt=pd',
      );
      expect(buildNavigatorUrl('yandex', { waypoints: [waypoints[0]] })).toBe(
        'https://yandex.ru/maps/?rtext=~53.9,27.56&rtt=auto',
      );
    });

    it('builds the OsmAnd navigate URL the app itself generates', () => {
      expect(buildNavigatorUrl('osmand', { waypoints }, { mode: 'cycling' })).toBe(
        'https://osmand.net/map/navigate/?start=53.9,27.56&end=54,27.7&via=53.95,27.6&profile=bicycle#10/53.9/27.56',
      );
      expect(buildNavigatorUrl('osmand', { waypoints: [waypoints[0]] })).toBe(
        'https://osmand.net/map/navigate/?end=53.9,27.56&profile=car#10/53.9/27.56',
      );
    });

    it('keeps the trip export menu providers unchanged', () => {
      expect(ROUTE_NAVIGATORS.map((n) => n.id)).toEqual(['google', 'apple', 'garmin', 'komoot']);
    });
  });

  it('returns null for GPX-import providers and empty routes', () => {
    expect(buildNavigatorUrl('garmin', { waypoints })).toBeNull();
    expect(buildNavigatorUrl('komoot', { waypoints })).toBeNull();
    expect(buildNavigatorUrl('google', {})).toBeNull();
  });

  it('describes GPX-import providers with an upload URL', () => {
    const garmin = ROUTE_NAVIGATORS.find((n) => n.id === 'garmin')!;
    expect(garmin.kind).toBe('gpx');
    expect(garmin.importUrl).toMatch(/^https:\/\//);
  });
});
