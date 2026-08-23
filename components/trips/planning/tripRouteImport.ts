import type { RoutePoint } from '@/api/plannedTripsTypes';
import { translate as i18nT } from '@/i18n';
import type { ParsedRoutePoint, ParsedRoutePreview } from '@/types/travelRoutes';
import {
  calculateRouteDistanceKm,
  parseRouteFileMetadata,
  parseRouteFilePreviews,
  type NamedRouteFilePoint,
  type RouteFileFormat,
} from '@/utils/routeFileParser';

export const TRIP_ROUTE_IMPORT_MAX_BYTES = 20 * 1024 * 1024;
export const TRIP_ROUTE_IMPORT_PREVIEW_MAX_POINTS = 2000;
export const TRIP_ROUTE_IMPORT_DRAFT_MAX_POINTS = 50;

export type TripRouteImportErrorCode =
  | 'unsupported'
  | 'tooLarge'
  | 'damaged'
  | 'empty'
  | 'capacity'
  | 'read';

export interface TripRouteImportError {
  code: TripRouteImportErrorCode;
}

export interface TripRouteImportPreview {
  preview: ParsedRoutePreview;
  displayLinePoints: ParsedRoutePoint[];
  distanceKm: number;
  originalPointCount: number;
}

export interface PreparedTripRouteImport {
  fileName: string;
  format: RouteFileFormat;
  routes: TripRouteImportPreview[];
  namedWaypoints: NamedRouteFilePoint[];
}

export type TripRouteImportResult =
  | { ok: true; data: PreparedTripRouteImport }
  | { ok: false; error: TripRouteImportError };

export interface PrepareTripRouteImportInput {
  fileName: string;
  text: string;
  sizeBytes?: number | null;
}

export type TripRouteImportMode = 'replace' | 'append';

export interface BuildImportedRouteDraftInput {
  existingRoute: RoutePoint[];
  parsedRoute: ParsedRoutePreview;
  namedWaypoints: NamedRouteFilePoint[];
  mode: TripRouteImportMode;
  maxPoints?: number;
}

export type BuildImportedRouteDraftResult =
  | { ok: true; route: RoutePoint[] }
  | { ok: false; error: { code: 'capacity' } };

interface GeoPoint {
  source: ParsedRoutePoint;
  coordinates: [number, number];
  sourceIndex: number;
}

interface OrderedDraftPoint {
  coordinates: [number, number];
  name: string;
  position: number;
}

const importFailure = (code: TripRouteImportErrorCode): TripRouteImportResult => ({
  ok: false,
  error: { code },
});

export const createTripRouteImportFailure = (
  code: TripRouteImportErrorCode,
): TripRouteImportResult => importFailure(code);

const extensionFromFileName = (fileName: string): string => {
  const match = fileName.trim().toLowerCase().match(/\.([^.]+)$/);
  return match?.[1] ?? '';
};

const utf8ByteLength = (value: string): number => {
  let length = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) {
      length += 1;
    } else if (code < 0x800) {
      length += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        length += 4;
        index += 1;
      } else {
        length += 3;
      }
    } else {
      length += 3;
    }
  }
  return length;
};

const parsedCoord = (coord: string): [number, number] | null => {
  const [latText, lngText, extra] = String(coord).split(',');
  if (extra != null) return null;
  const lat = Number(latText);
  const lng = Number(lngText);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lng, lat];
};

const cloneParsedPoint = (point: ParsedRoutePoint): ParsedRoutePoint => ({
  coord: point.coord,
  ...(Number.isFinite(point.elevation as number) ? { elevation: Number(point.elevation) } : {}),
});

const geoPoints = (points: ParsedRoutePoint[]): GeoPoint[] => {
  const output: GeoPoint[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const source = points[index];
    const coordinates = parsedCoord(source.coord);
    if (!coordinates) continue;
    const previous = output[output.length - 1];
    if (
      previous &&
      previous.coordinates[0] === coordinates[0] &&
      previous.coordinates[1] === coordinates[1]
    ) {
      continue;
    }
    output.push({ source, coordinates, sourceIndex: index });
  }
  return output;
};

const pointSegmentDistanceSquared = (
  point: [number, number],
  start: [number, number],
  end: [number, number],
): number => {
  const deltaX = end[0] - start[0];
  const deltaY = end[1] - start[1];
  if (deltaX === 0 && deltaY === 0) {
    const x = point[0] - start[0];
    const y = point[1] - start[1];
    return x * x + y * y;
  }

  const rawPosition =
    ((point[0] - start[0]) * deltaX + (point[1] - start[1]) * deltaY) /
    (deltaX * deltaX + deltaY * deltaY);
  const position = Math.max(0, Math.min(1, rawPosition));
  const x = point[0] - (start[0] + position * deltaX);
  const y = point[1] - (start[1] + position * deltaY);
  return x * x + y * y;
};

const simplifyAtTolerance = (points: GeoPoint[], toleranceSquared: number): GeoPoint[] => {
  if (points.length <= 2) return points.slice();

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const segments: Array<[number, number]> = [[0, points.length - 1]];

  while (segments.length > 0) {
    const segment = segments.pop();
    if (!segment) break;
    const [startIndex, endIndex] = segment;
    let furthestIndex = -1;
    let furthestDistance = toleranceSquared;

    for (let index = startIndex + 1; index < endIndex; index += 1) {
      const distance = pointSegmentDistanceSquared(
        points[index].coordinates,
        points[startIndex].coordinates,
        points[endIndex].coordinates,
      );
      if (distance > furthestDistance) {
        furthestDistance = distance;
        furthestIndex = index;
      }
    }

    if (furthestIndex < 0) continue;
    keep[furthestIndex] = 1;
    segments.push([startIndex, furthestIndex], [furthestIndex, endIndex]);
  }

  return points.filter((_, index) => keep[index] === 1);
};

const simplifyGeoPointsToTarget = (points: GeoPoint[], maxPoints: number): GeoPoint[] => {
  const target = Math.max(2, Math.floor(maxPoints));
  if (points.length <= target) return points.slice();

  let minLng = points[0].coordinates[0];
  let maxLng = minLng;
  let minLat = points[0].coordinates[1];
  let maxLat = minLat;
  for (const point of points) {
    minLng = Math.min(minLng, point.coordinates[0]);
    maxLng = Math.max(maxLng, point.coordinates[0]);
    minLat = Math.min(minLat, point.coordinates[1]);
    maxLat = Math.max(maxLat, point.coordinates[1]);
  }

  let lower = 0;
  let upper = (maxLng - minLng) ** 2 + (maxLat - minLat) ** 2;
  let candidate = simplifyAtTolerance(points, upper);

  for (let iteration = 0; iteration < 40; iteration += 1) {
    const tolerance = (lower + upper) / 2;
    const simplified = simplifyAtTolerance(points, tolerance);
    if (simplified.length > target) {
      lower = tolerance;
    } else {
      upper = tolerance;
      candidate = simplified;
    }
  }

  return candidate;
};

export const simplifyRouteImportPreview = (
  points: ParsedRoutePoint[],
  maxPoints = TRIP_ROUTE_IMPORT_PREVIEW_MAX_POINTS,
): ParsedRoutePoint[] => {
  const validPoints = geoPoints(points);
  if (validPoints.length <= 2) return validPoints.map(({ source }) => cloneParsedPoint(source));
  return simplifyGeoPointsToTarget(validPoints, maxPoints).map(({ source }) => cloneParsedPoint(source));
};

export const prepareTripRouteImport = (
  input: PrepareTripRouteImportInput,
): TripRouteImportResult => {
  const extension = extensionFromFileName(input.fileName);
  if (extension !== 'gpx' && extension !== 'kml') return importFailure('unsupported');
  if (
    (Number.isFinite(input.sizeBytes as number) && Number(input.sizeBytes) > TRIP_ROUTE_IMPORT_MAX_BYTES) ||
    utf8ByteLength(input.text) > TRIP_ROUTE_IMPORT_MAX_BYTES
  ) {
    return importFailure('tooLarge');
  }

  const metadata = parseRouteFileMetadata(input.text, extension);
  if (!metadata.ok) return importFailure(metadata.reason);

  try {
    const routes = parseRouteFilePreviews(input.text, metadata.format)
      .filter((preview) => geoPoints(preview.linePoints).length >= 2)
      .map((preview) => ({
        preview,
        displayLinePoints: simplifyRouteImportPreview(preview.linePoints),
        distanceKm: calculateRouteDistanceKm(preview.linePoints),
        originalPointCount: preview.linePoints.length,
      }));

    if (routes.length === 0) return importFailure('empty');
    return {
      ok: true,
      data: {
        fileName: input.fileName,
        format: metadata.format,
        routes,
        namedWaypoints: metadata.namedPoints,
      },
    };
  } catch {
    return importFailure('damaged');
  }
};

const coordinateKey = (coordinates: [number, number]): string =>
  `${Object.is(coordinates[0], -0) ? 0 : coordinates[0]},${Object.is(coordinates[1], -0) ? 0 : coordinates[1]}`;

const mergeNames = (first: string, second: string): string => {
  const names = new Set(
    `${first}\n${second}`
      .split('\n')
      .map((name) => name.trim())
      .filter(Boolean),
  );
  return Array.from(names).join(' · ');
};

const closestRoutePosition = (coordinates: [number, number], route: GeoPoint[]): number => {
  let closestPosition = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < route.length - 1; index += 1) {
    const start = route[index].coordinates;
    const end = route[index + 1].coordinates;
    const deltaX = end[0] - start[0];
    const deltaY = end[1] - start[1];
    const denominator = deltaX * deltaX + deltaY * deltaY;
    const segmentPosition =
      denominator === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((coordinates[0] - start[0]) * deltaX + (coordinates[1] - start[1]) * deltaY) /
                denominator,
            ),
          );
    const projected: [number, number] = [
      start[0] + segmentPosition * deltaX,
      start[1] + segmentPosition * deltaY,
    ];
    const distance =
      (coordinates[0] - projected[0]) ** 2 + (coordinates[1] - projected[1]) ** 2;
    if (distance < closestDistance) {
      closestDistance = distance;
      closestPosition = index + segmentPosition;
    }
  }

  return closestPosition;
};

const namedDraftPoints = (
  namedWaypoints: NamedRouteFilePoint[],
  route: GeoPoint[],
): OrderedDraftPoint[] => {
  const byCoordinate = new Map<string, OrderedDraftPoint>();

  for (const waypoint of namedWaypoints) {
    const coordinates = parsedCoord(waypoint.coord);
    const name = waypoint.name.trim();
    if (!coordinates || !name) continue;
    const key = coordinateKey(coordinates);
    const existing = byCoordinate.get(key);
    if (existing) {
      existing.name = mergeNames(existing.name, name);
      continue;
    }
    byCoordinate.set(key, {
      coordinates,
      name,
      position: closestRoutePosition(coordinates, route),
    });
  }

  return Array.from(byCoordinate.values()).sort((a, b) => a.position - b.position);
};

const importedRoutePoints = (
  track: GeoPoint[],
  namedPoints: OrderedDraftPoint[],
  budget: number,
): OrderedDraftPoint[] | null => {
  const firstKey = coordinateKey(track[0].coordinates);
  const lastKey = coordinateKey(track[track.length - 1].coordinates);
  const namedOutsideEndpoints = namedPoints.filter((point) => {
    const key = coordinateKey(point.coordinates);
    return key !== firstKey && key !== lastKey;
  }).length;
  const mandatoryCount = 2 + namedOutsideEndpoints;
  if (mandatoryCount > budget) return null;

  const simplifiedTrack = simplifyGeoPointsToTarget(track, budget - namedOutsideEndpoints);
  const ordered: OrderedDraftPoint[] = [
    ...simplifiedTrack.map((point) => ({
      coordinates: point.coordinates,
      name: '',
      position: point.sourceIndex,
    })),
    ...namedPoints,
  ].sort((a, b) => a.position - b.position || Number(Boolean(a.name)) - Number(Boolean(b.name)));

  const result: OrderedDraftPoint[] = [];
  const resultIndexByCoordinate = new Map<string, number>();
  for (const point of ordered) {
    const key = coordinateKey(point.coordinates);
    const existingIndex = resultIndexByCoordinate.get(key);
    if (existingIndex != null) {
      result[existingIndex].name = mergeNames(result[existingIndex].name, point.name);
      continue;
    }
    resultIndexByCoordinate.set(key, result.length);
    result.push({
      coordinates: [...point.coordinates] as [number, number],
      name: point.name,
      position: point.position,
    });
  }

  return result.length <= budget ? result : null;
};

const createRoutePoints = (
  points: OrderedDraftPoint[],
  reservedIds: Set<string>,
): RoutePoint[] => {
  let sequence = 1;
  return points.map((point) => {
    let id = `import-${sequence}`;
    while (reservedIds.has(id)) {
      sequence += 1;
      id = `import-${sequence}`;
    }
    reservedIds.add(id);
    sequence += 1;
    return {
      id,
      type: 'custom',
      name: point.name,
      description: null,
      coordinates: [...point.coordinates] as [number, number],
      placeId: null,
    };
  });
};

/**
 * Точки, снятые с самого трека, имён в файле не имеют, а контракт сохранения
 * требует непустой `title` у каждой custom-точки: `PUT /trips/planned/{id}/route/`
 * отвечает 400 `title is required for custom route points`, и весь импорт не
 * сохраняется. Безымянная точка получает тот же порядковый заголовок «Точка N»,
 * что и точка, поставленная кликом по карте (`RouteBuilder.handleAddPointFromMap`),
 * — ключ переиспользуется, новых строк локализации нет.
 *
 * Заполняются все типы, у которых бэкенд требует `title`: это `custom`, `rest`
 * и `overnight`. Единственное исключение — `place`: он уезжает как `travel`
 * (`pointTypeToBe`), title с него не требуется, а имя приходит из самого места,
 * поэтому подставлять туда «Точка N» значило бы переименовать чужую сущность.
 *
 * Подстановка идёт последним шагом, уже над готовым маршрутом: во-первых, номер
 * совпадает с позицией точки в списке, во-вторых, склейка режима «Добавить»
 * (`mergeNames` на общей точке стыка) успевает отработать над настоящими именами
 * и не приписывает существующей точке подставленное «Точка 1».
 */
const withFilledNames = (route: RoutePoint[]): RoutePoint[] =>
  route.map((point, index) => (
    point.type === 'place' || point.name.trim()
      ? point
      : {
        ...point,
        name: i18nT('trips:components.trips.planning.RouteBuilder.tochka_value1_58a44f4e', {
          value1: index + 1,
        }),
      }
  ));

const coordinatesEqual = (
  first: [number, number] | null,
  second: [number, number] | null,
): boolean =>
  Boolean(
    first && second && first[0] === second[0] && first[1] === second[1],
  );

export const buildImportedRouteDraft = (
  input: BuildImportedRouteDraftInput,
): BuildImportedRouteDraftResult => {
  const maxPoints = Math.max(0, Math.floor(input.maxPoints ?? TRIP_ROUTE_IMPORT_DRAFT_MAX_POINTS));
  const track = geoPoints(input.parsedRoute.linePoints);
  if (track.length < 2) return { ok: false, error: { code: 'capacity' } };

  const existingRoute = input.existingRoute.map((point) => ({
    ...point,
    coordinates: point.coordinates ? ([...point.coordinates] as [number, number]) : null,
  }));
  const appendJoinIsEqual =
    input.mode === 'append' &&
    coordinatesEqual(existingRoute[existingRoute.length - 1]?.coordinates ?? null, track[0].coordinates);
  const budget =
    input.mode === 'replace'
      ? maxPoints
      : maxPoints - existingRoute.length + (appendJoinIsEqual ? 1 : 0);
  if (budget < 2) return { ok: false, error: { code: 'capacity' } };

  const namedPoints = namedDraftPoints(input.namedWaypoints, track);
  const imported = importedRoutePoints(track, namedPoints, budget);
  if (!imported) return { ok: false, error: { code: 'capacity' } };

  const reservedIds = new Set(existingRoute.map((point) => point.id));
  const importedPoints = createRoutePoints(imported, reservedIds);
  if (input.mode === 'replace') return { ok: true, route: withFilledNames(importedPoints) };

  if (appendJoinIsEqual) {
    const existingLast = existingRoute[existingRoute.length - 1];
    const importedFirst = importedPoints[0];
    const mergedLast = {
      ...existingLast,
      name: mergeNames(existingLast.name, importedFirst.name),
    };
    return {
      ok: true,
      route: withFilledNames([
        ...existingRoute.slice(0, -1),
        mergedLast,
        ...importedPoints.slice(1),
      ]),
    };
  }

  return { ok: true, route: withFilledNames([...existingRoute, ...importedPoints]) };
};
