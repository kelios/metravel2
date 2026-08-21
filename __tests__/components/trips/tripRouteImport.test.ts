import type { RoutePoint } from '@/api/plannedTripsTypes';
import type { ParsedRoutePreview } from '@/types/travelRoutes';
import {
  buildImportedRouteDraft,
  createTripRouteImportFailure,
  prepareTripRouteImport,
  simplifyRouteImportPreview,
  TRIP_ROUTE_IMPORT_DRAFT_MAX_POINTS,
  TRIP_ROUTE_IMPORT_MAX_BYTES,
  TRIP_ROUTE_IMPORT_PREVIEW_MAX_POINTS,
} from '@/components/trips/planning/tripRouteImport';
import {
  EMPTY_GPX,
  GPX_MULTIPLE_ROUTES,
  GPX_SINGLE_WITH_WAYPOINTS,
  KML_WITH_NAMED_POINTS,
  MALFORMED_GPX,
  UNSAFE_GPX,
} from '@/__tests__/fixtures/tripRouteImportFixtures';

const preview = (coords: string[]): ParsedRoutePreview => ({
  linePoints: coords.map((coord) => ({ coord })),
  elevationProfile: [],
});

const routePoint = (
  id: string,
  coordinates: [number, number],
  name = id,
): RoutePoint => ({
  id,
  type: 'custom',
  name,
  description: null,
  coordinates,
  placeId: null,
});

describe('prepareTripRouteImport', () => {
  it('returns route statistics, bounded display geometry, and named waypoints', () => {
    const result = prepareTripRouteImport({
      fileName: 'route.GPX',
      text: GPX_SINGLE_WITH_WAYPOINTS,
      sizeBytes: GPX_SINGLE_WITH_WAYPOINTS.length,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.format).toBe('gpx');
    expect(result.data.routes).toHaveLength(1);
    expect(result.data.routes[0].originalPointCount).toBe(3);
    expect(result.data.routes[0].distanceKm).toBeGreaterThan(0);
    expect(result.data.routes[0].displayLinePoints).toHaveLength(3);
    expect(result.data.namedWaypoints.map((point) => point.name)).toEqual([
      'Start camp',
      'Viewpoint',
    ]);
  });

  it('keeps separate selection data for every usable parsed route', () => {
    const result = prepareTripRouteImport({
      fileName: 'multi.gpx',
      text: GPX_MULTIPLE_ROUTES,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.routes).toHaveLength(2);
    expect(result.data.routes.map((route) => route.originalPointCount)).toEqual([2, 2]);
    expect(result.data.routes[1].preview.linePoints[0].coord).toBe('53.1,24.7');
  });

  it('supports KML line geometry and Point metadata without treating Points as routes', () => {
    const result = prepareTripRouteImport({ fileName: 'route.kml', text: KML_WITH_NAMED_POINTS });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.routes).toHaveLength(1);
    expect(result.data.routes[0].originalPointCount).toBe(3);
    expect(result.data.namedWaypoints).toEqual([
      { coord: '52.2,23.8', name: 'Finish' },
      { coord: '52.15,23.75', name: 'Lunch' },
    ]);
  });

  it.each([
    ['unsupported', prepareTripRouteImport({ fileName: 'route.geojson', text: '{}' })],
    [
      'tooLarge',
      prepareTripRouteImport({
        fileName: 'route.gpx',
        text: GPX_SINGLE_WITH_WAYPOINTS,
        sizeBytes: TRIP_ROUTE_IMPORT_MAX_BYTES + 1,
      }),
    ],
    ['damaged', prepareTripRouteImport({ fileName: 'route.gpx', text: MALFORMED_GPX })],
    ['damaged', prepareTripRouteImport({ fileName: 'route.gpx', text: UNSAFE_GPX })],
    ['empty', prepareTripRouteImport({ fileName: 'route.gpx', text: EMPTY_GPX })],
    ['read', createTripRouteImportFailure('read')],
  ])('maps failures to the %s code without parser details', (code, result) => {
    expect(result).toEqual({ ok: false, error: { code } });
  });

  it('rechecks UTF-8 text size when picker metadata is absent', () => {
    const result = prepareTripRouteImport({
      fileName: 'route.gpx',
      text: ' '.repeat(TRIP_ROUTE_IMPORT_MAX_BYTES + 1),
    });

    expect(result).toEqual({ ok: false, error: { code: 'tooLarge' } });
  });
});

describe('simplifyRouteImportPreview', () => {
  it('caps a large display line while preserving exact endpoints and input data', () => {
    const points = Array.from({ length: 3001 }, (_, index) => ({
      coord: `${50 + Math.sin(index / 20) * 0.05},${20 + index * 0.001}`,
    }));
    const snapshot = JSON.stringify(points);

    const simplified = simplifyRouteImportPreview(points);

    expect(simplified.length).toBeLessThanOrEqual(TRIP_ROUTE_IMPORT_PREVIEW_MAX_POINTS);
    expect(simplified[0].coord).toBe(points[0].coord);
    expect(simplified[simplified.length - 1].coord).toBe(points[points.length - 1].coord);
    expect(JSON.stringify(points)).toBe(snapshot);
  });
});

describe('buildImportedRouteDraft', () => {
  it('simplifies to 50 points with exact endpoints and does not mutate inputs', () => {
    const parsedRoute = preview(
      Array.from({ length: 121 }, (_, index) =>
        `${50 + Math.sin(index / 3) * 0.01},${20 + index * 0.005}`,
      ),
    );
    const existingRoute = [routePoint('old', [1, 1])];
    const parsedSnapshot = JSON.stringify(parsedRoute);
    const existingSnapshot = JSON.stringify(existingRoute);

    const result = buildImportedRouteDraft({
      existingRoute,
      parsedRoute,
      namedWaypoints: [],
      mode: 'replace',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.route.length).toBeLessThanOrEqual(TRIP_ROUTE_IMPORT_DRAFT_MAX_POINTS);
    expect(result.route[0].coordinates).toEqual([20, 50]);
    expect(result.route[result.route.length - 1].coordinates).toEqual([
      20 + 120 * 0.005,
      50 + Math.sin(120 / 3) * 0.01,
    ]);
    expect(JSON.stringify(parsedRoute)).toBe(parsedSnapshot);
    expect(JSON.stringify(existingRoute)).toBe(existingSnapshot);
  });

  it('orders off-track named anchors by their closest traversal position', () => {
    const result = buildImportedRouteDraft({
      existingRoute: [],
      parsedRoute: preview(['50,20', '50,21', '50,22']),
      namedWaypoints: [
        { coord: '50.01,21.8', name: 'Late' },
        { coord: '49.99,20.2', name: 'Early' },
      ],
      mode: 'replace',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const names = result.route.map((point) => point.name);
    expect(names.indexOf('Early')).toBeGreaterThan(0);
    expect(names.indexOf('Late')).toBeGreaterThan(names.indexOf('Early'));
    expect(result.route.find((point) => point.name === 'Early')?.coordinates).toEqual([20.2, 49.99]);
  });

  it('merges a named waypoint onto an exact endpoint without duplicating it', () => {
    const result = buildImportedRouteDraft({
      existingRoute: [],
      parsedRoute: preview(['50,20', '50.1,20.1', '50.2,20.2']),
      namedWaypoints: [{ coord: '50,20', name: 'Named start' }],
      mode: 'replace',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.route[0]).toMatchObject({ name: 'Named start', coordinates: [20, 50] });
    expect(result.route.filter((point) => point.coordinates?.[0] === 20 && point.coordinates[1] === 50)).toHaveLength(1);
  });

  it('deduplicates an equal append join and preserves both names', () => {
    const existingRoute = [
      routePoint('before', [19, 49]),
      routePoint('join', [20, 50], 'Existing join'),
    ];
    const snapshot = JSON.stringify(existingRoute);
    const result = buildImportedRouteDraft({
      existingRoute,
      parsedRoute: preview(['50,20', '50.1,20.1', '50.2,20.2']),
      namedWaypoints: [{ coord: '50,20', name: 'Imported start' }],
      mode: 'append',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.route).toHaveLength(4);
    expect(result.route[1]).toMatchObject({
      id: 'join',
      name: 'Existing join · Imported start',
      coordinates: [20, 50],
    });
    expect(JSON.stringify(existingRoute)).toBe(snapshot);
  });

  it('uses only the remaining append capacity, accounting for the equal join', () => {
    const existingRoute = Array.from({ length: 48 }, (_, index) =>
      routePoint(`existing-${index}`, index === 47 ? [20, 50] : [10 + index * 0.01, 40]),
    );
    const result = buildImportedRouteDraft({
      existingRoute,
      parsedRoute: preview(['50,20', '50.1,20.1', '50.2,20.2']),
      namedWaypoints: [],
      mode: 'append',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.route).toHaveLength(50);
    expect(result.route.slice(0, 48).map((point) => point.id)).toEqual(
      existingRoute.map((point) => point.id),
    );
  });

  it('returns capacity when mandatory endpoints and named anchors cannot fit', () => {
    const namedWaypoints = Array.from({ length: 49 }, (_, index) => ({
      coord: `50,${20 + (index + 1) / 50}`,
      name: `Anchor ${index + 1}`,
    }));
    const result = buildImportedRouteDraft({
      existingRoute: [],
      parsedRoute: preview(['50,20', '50,21']),
      namedWaypoints,
      mode: 'replace',
    });

    expect(result).toEqual({ ok: false, error: { code: 'capacity' } });
  });
});
