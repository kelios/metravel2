import type { ParsedRoutePoint, ParsedRoutePreview, RouteElevationSample } from '@/types/travelRoutes';
import { DOMParser as SafeXmlDomParser } from '@xmldom/xmldom';

const EARTH_RADIUS_M = 6371000;

export type RouteFileFormat = 'gpx' | 'kml';

export interface NamedRouteFilePoint {
  coord: string;
  name: string;
}

export interface ParsedRouteFileGeometry {
  hasIndependentPoints: boolean;
  points: NamedRouteFilePoint[];
  lines: ParsedRoutePoint[][];
}

export type RouteFileMetadataResult =
  | {
      ok: true;
      format: RouteFileFormat;
      hasIndependentPoints: boolean;
      namedPoints: NamedRouteFilePoint[];
    }
  | {
      ok: false;
      reason: 'unsupported' | 'damaged';
    };

type ParsedRouteFileDocumentResult =
  | {
      ok: true;
      format: RouteFileFormat;
      document: Document;
    }
  | {
      ok: false;
      reason: 'unsupported' | 'damaged';
    };

// A "teleport" leg is a jump between two consecutive line points that is far
// larger than the route's own typical step — a recording gap (stitched <trkseg>),
// or, more commonly, <wpt> POIs that the backend preview stitches into the track
// line in document order (waypoints come before <trk>, so the merged line draws
// straight connectors from the sparse POIs into the real track — the Harzer
// Hexenstieg GPX shows a straight "triangle" plus a 52 km connector). Counting
// such legs inflates distance/elevation and paints phantom straight lines.
//
// The threshold is median-aware instead of a fixed cap: a leg is a teleport when
// it exceeds both an absolute floor AND a large multiple of the median leg. This
// self-calibrates — for a dense track (median ~metres) even a few-km jump is a
// teleport, while a genuinely sparse planned route (median ~km) keeps its legs
// because none of them is an outlier relative to the rest.
const MIN_TELEPORT_METERS = 3000;
const TELEPORT_MEDIAN_FACTOR = 12;

const toCoord = (lat: number, lng: number): string | null => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return `${lat},${lng}`;
};

const normalizeElevation = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const parseCoordPair = (coord: string): { lat: number; lng: number } | null => {
  const [latStr, lngStr] = String(coord).split(',');
  const lat = Number(latStr);
  const lng = Number(lngStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

const distanceMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
};

const medianOf = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// Distance (in metres) above which a leg between two consecutive line points is
// treated as a teleport rather than travelled distance. See MIN_TELEPORT_METERS.
const teleportThresholdMeters = (linePoints: ParsedRoutePoint[]): number => {
  const legs: number[] = [];
  let prevCoord = parseCoordPair(linePoints[0]?.coord ?? '');
  for (let i = 1; i < linePoints.length; i += 1) {
    const currentCoord = parseCoordPair(linePoints[i].coord);
    if (currentCoord && prevCoord) {
      legs.push(distanceMeters(prevCoord, currentCoord));
    }
    if (currentCoord) prevCoord = currentCoord;
  }
  if (legs.length === 0) return MIN_TELEPORT_METERS;
  return Math.max(MIN_TELEPORT_METERS, TELEPORT_MEDIAN_FACTOR * medianOf(legs));
};

export const calculateRouteDistanceKm = (linePoints: ParsedRoutePoint[]): number => {
  if (!Array.isArray(linePoints) || linePoints.length < 2) return 0;

  const teleportMeters = teleportThresholdMeters(linePoints);
  let totalDistanceM = 0;
  let prevCoord = parseCoordPair(linePoints[0].coord);

  for (let i = 1; i < linePoints.length; i += 1) {
    const currentCoord = parseCoordPair(linePoints[i].coord);
    if (currentCoord && prevCoord) {
      const legMeters = distanceMeters(prevCoord, currentCoord);
      if (legMeters <= teleportMeters) {
        totalDistanceM += legMeters;
      }
    }
    prevCoord = currentCoord;
  }

  return totalDistanceM / 1000;
};

// Split a line into contiguous segments, breaking wherever a teleport leg sits.
// Waypoints stitched into a track become one-point fragments (each isolated by a
// teleport on both sides) and can be dropped by callers that keep only real legs.
export const splitRouteLineSegments = (linePoints: ParsedRoutePoint[]): ParsedRoutePoint[][] => {
  if (!Array.isArray(linePoints) || linePoints.length === 0) return [];

  const teleportMeters = teleportThresholdMeters(linePoints);
  const segments: ParsedRoutePoint[][] = [];
  let current: ParsedRoutePoint[] = [];
  let prevCoord: { lat: number; lng: number } | null = null;

  for (let i = 0; i < linePoints.length; i += 1) {
    const point = linePoints[i];
    const currentCoord = parseCoordPair(point.coord);
    if (!currentCoord) continue;
    if (prevCoord && distanceMeters(prevCoord, currentCoord) > teleportMeters) {
      if (current.length > 0) segments.push(current);
      current = [];
    }
    current.push(point);
    prevCoord = currentCoord;
  }
  if (current.length > 0) segments.push(current);

  return segments;
};

// Общий построитель профиля высот: дистанция накапливается по линии, teleport-леги
// помечаются `gapBefore`, чтобы набор/сброс не считались через разрыв. Используется
// и парсерами GPX/KML, и декодером ORS-полилинии планировщика поездок.
export const buildElevationProfile = (linePoints: ParsedRoutePoint[]): RouteElevationSample[] => {
  if (!Array.isArray(linePoints) || linePoints.length < 2) return [];

  const teleportMeters = teleportThresholdMeters(linePoints);
  let totalDistanceM = 0;
  let prevCoord = parseCoordPair(linePoints[0].coord);
  const profile: RouteElevationSample[] = [];
  let pendingGap = false;

  for (let i = 0; i < linePoints.length; i += 1) {
    const current = linePoints[i];
    const currentCoord = parseCoordPair(current.coord);
    if (currentCoord && prevCoord) {
      const legMeters = distanceMeters(prevCoord, currentCoord);
      if (legMeters <= teleportMeters) {
        totalDistanceM += legMeters;
      } else {
        pendingGap = true;
      }
    }
    prevCoord = currentCoord;

    if (Number.isFinite(current.elevation as number)) {
      profile.push({
        distanceKm: totalDistanceM / 1000,
        elevationM: Number(current.elevation),
        ...(pendingGap ? { gapBefore: true } : {}),
      });
      pendingGap = false;
    }
  }

  if (profile.length < 2) return [];
  return profile;
};

const parseKmlCoordinatesChunk = (raw: string): ParsedRoutePoint[] => {
  return raw
    .trim()
    .split(/\s+/)
    .map((part) => {
      const [lngStr, latStr, eleStr] = part.split(',');
      const lng = Number(lngStr);
      const lat = Number(latStr);
      const coord = toCoord(lat, lng);
      const elevation = normalizeElevation(eleStr);
      if (!coord) return null;
      return Number.isFinite(elevation as number) ? { coord, elevation } : { coord };
    })
    .filter((item): item is ParsedRoutePoint => Boolean(item));
};

const compactConsecutivePoints = (items: ParsedRoutePoint[]): ParsedRoutePoint[] => {
  const out: ParsedRoutePoint[] = [];

  for (const item of items) {
    const key = item.coord.trim();
    if (!key) continue;

    const elevation = normalizeElevation(item.elevation);
    const last = out[out.length - 1];
    if (last && last.coord === key) {
      if (!Number.isFinite(last.elevation as number) && Number.isFinite(elevation as number)) {
        last.elevation = elevation;
      }
      continue;
    }

    out.push(Number.isFinite(elevation as number) ? { coord: key, elevation } : { coord: key });
  }

  return out;
};

const getElementsByLocalName = (root: Document | Element, tagName: string): Element[] => {
  const direct = Array.from(root.getElementsByTagName(tagName));
  if (direct.length > 0) return direct;

  const all = root.getElementsByTagName('*');
  const out: Element[] = [];
  for (let i = 0; i < all.length; i += 1) {
    const el = all[i] as Element;
    if (String((el as any).localName ?? '').toLowerCase() === tagName.toLowerCase()) {
      out.push(el);
    }
  }
  return out;
};

const normalizedElementName = (element: Element): string =>
  String(element.localName || element.nodeName.split(':').pop() || '').toLowerCase();

const normalizeRouteFileFormat = (ext?: string): RouteFileFormat | null => {
  const normalized = String(ext ?? '').trim().toLowerCase().replace(/^\./, '');
  return normalized === 'gpx' || normalized === 'kml' ? normalized : null;
};

const coordFromGpxElement = (element: Element): string | null => {
  const latText = element.getAttribute('lat');
  const lngText = element.getAttribute('lon');
  if (latText == null || lngText == null || !latText.trim() || !lngText.trim()) {
    return null;
  }
  return toCoord(Number(latText), Number(lngText));
};

const mergeNamedRouteFilePoint = (
  points: NamedRouteFilePoint[],
  nextPoint: NamedRouteFilePoint,
): void => {
  const existing = points.find((point) => point.coord === nextPoint.coord);
  if (!existing) {
    points.push(nextPoint);
    return;
  }

  const names = new Set(
    `${existing.name}\n${nextPoint.name}`
      .split('\n')
      .map((name) => name.trim())
      .filter(Boolean),
  );
  existing.name = Array.from(names).join(' · ');
};

const extractGpxNamedPoints = (document: Document): NamedRouteFilePoint[] => {
  const points: NamedRouteFilePoint[] = [];

  for (const waypoint of getElementsByLocalName(document, 'wpt')) {
    const coord = coordFromGpxElement(waypoint);
    const name = String(getElementsByLocalName(waypoint, 'name')[0]?.textContent ?? '').trim();
    if (!coord || !name) continue;
    mergeNamedRouteFilePoint(points, { coord, name });
  }

  return points;
};

const extractKmlNamedPoints = (document: Document): NamedRouteFilePoint[] => {
  const points: NamedRouteFilePoint[] = [];

  for (const placemark of getElementsByLocalName(document, 'Placemark')) {
    const name = String(getElementsByLocalName(placemark, 'name')[0]?.textContent ?? '').trim();
    if (!name) continue;
    for (const pointElement of getElementsByLocalName(placemark, 'Point')) {
      const coordinatesText = String(
        getElementsByLocalName(pointElement, 'coordinates')[0]?.textContent ?? '',
      ).trim();
      const parsedPoint = parseKmlCoordinatesChunk(coordinatesText)[0];
      if (!parsedPoint) continue;
      mergeNamedRouteFilePoint(points, { coord: parsedPoint.coord, name });
    }
  }

  return points;
};

const hasGpxIndependentPoints = (document: Document): boolean =>
  getElementsByLocalName(document, 'wpt').some((waypoint) => Boolean(coordFromGpxElement(waypoint)));

const hasKmlIndependentPoints = (document: Document): boolean =>
  getElementsByLocalName(document, 'Point').some((pointElement) => {
    const coordinatesText = String(getElementsByLocalName(pointElement, 'coordinates')[0]?.textContent ?? '').trim();
    return Boolean(parseKmlCoordinatesChunk(coordinatesText)[0]);
  });

const parseRouteFileDocument = (text: string, ext?: string): ParsedRouteFileDocumentResult => {
  const format = normalizeRouteFileFormat(ext);
  if (!format) return { ok: false, reason: 'unsupported' };
  if (!String(text).trim() || /<\s*!(?:DOCTYPE|ENTITY)\b/i.test(text)) {
    return { ok: false, reason: 'damaged' };
  }

  const diagnostics: string[] = [];
  let document: Document;
  try {
    document = new SafeXmlDomParser({
      errorHandler: {
        warning: (message) => diagnostics.push(String(message)),
        error: (message) => diagnostics.push(String(message)),
        fatalError: (message) => diagnostics.push(String(message)),
      },
    }).parseFromString(text, 'application/xml');
  } catch {
    return { ok: false, reason: 'damaged' };
  }

  const root = document.documentElement;
  if (diagnostics.length > 0 || !root || normalizedElementName(root) !== format) {
    return { ok: false, reason: 'damaged' };
  }

  return { ok: true, format, document };
};

/**
 * Validates the bounded import XML contract and extracts only named metadata.
 * Track/route geometry intentionally remains owned by parseRouteFilePreviews.
 */
export const parseRouteFileMetadata = (text: string, ext?: string): RouteFileMetadataResult => {
  const parsed = parseRouteFileDocument(text, ext);
  if (!parsed.ok) return parsed;

  const { document, format } = parsed;

  return {
    ok: true,
    format,
    hasIndependentPoints: format === 'gpx' ? hasGpxIndependentPoints(document) : hasKmlIndependentPoints(document),
    namedPoints: format === 'gpx' ? extractGpxNamedPoints(document) : extractKmlNamedPoints(document),
  };
};

const parseGpxPointsFromElementNodes = (nodes: Element[]): ParsedRoutePoint[] => {
  const points: ParsedRoutePoint[] = [];

  for (const node of nodes) {
    const coord = coordFromGpxElement(node);
    if (!coord) continue;

    const eleNode = getElementsByLocalName(node, 'ele')[0] ?? null;
    const elevation = normalizeElevation(eleNode?.textContent);
    points.push({ coord, elevation });
  }

  return compactConsecutivePoints(points);
};

const extractGpxLines = (document: Document): ParsedRoutePoint[][] => {
  const trackLines = getElementsByLocalName(document, 'trk')
    .map((trackNode) => parseGpxPointsFromElementNodes(getElementsByLocalName(trackNode, 'trkpt')))
    .filter((line) => line.length > 0);
  if (trackLines.length > 0) return trackLines;

  return getElementsByLocalName(document, 'rte')
    .map((routeNode) => parseGpxPointsFromElementNodes(getElementsByLocalName(routeNode, 'rtept')))
    .filter((line) => line.length > 0);
};

const extractKmlLines = (document: Document): ParsedRoutePoint[][] => {
  const lines: ParsedRoutePoint[][] = [];

  for (const lineStringNode of getElementsByLocalName(document, 'LineString')) {
    for (const coordsNode of getElementsByLocalName(lineStringNode, 'coordinates')) {
      const nodeText = String(coordsNode.textContent ?? '').trim();
      if (!nodeText) continue;
      const line = compactConsecutivePoints(parseKmlCoordinatesChunk(nodeText));
      if (line.length > 0) lines.push(line);
    }
  }

  return lines;
};

export const parseRouteFileGeometry = (text: string, ext?: string): ParsedRouteFileGeometry => {
  const parsed = parseRouteFileDocument(text, ext);
  if (!parsed.ok) return { hasIndependentPoints: false, points: [], lines: [] };

  const { document, format } = parsed;

  return {
    hasIndependentPoints:
      format === 'gpx'
        ? hasGpxIndependentPoints(document)
        : hasKmlIndependentPoints(document),
    points: format === 'gpx' ? extractGpxNamedPoints(document) : extractKmlNamedPoints(document),
    lines: format === 'gpx' ? extractGpxLines(document) : extractKmlLines(document),
  };
};

export const parseRouteFilePreviews = (text: string, ext?: string): ParsedRoutePreview[] => {
  const { lines: lineGroups } = parseRouteFileGeometry(text, ext);

  return lineGroups
    .map((linePoints) => compactConsecutivePoints(linePoints))
    .filter((linePoints) => linePoints.length > 0)
    .map((linePoints) => ({
      linePoints,
      elevationProfile: buildElevationProfile(linePoints),
    }));
};

export const parseRouteFilePreview = (text: string, ext?: string): ParsedRoutePreview => {
  const previews = parseRouteFilePreviews(text, ext);
  if (previews.length === 0) {
    return {
      linePoints: [],
      elevationProfile: [],
    };
  }

  if (previews.length === 1) {
    return previews[0];
  }

  const linePoints = compactConsecutivePoints(previews.flatMap((preview) => preview.linePoints));
  return {
    linePoints,
    elevationProfile: buildElevationProfile(linePoints),
  };
};

export const parseRouteFileToPoints = (text: string, ext?: string): ParsedRoutePoint[] =>
  parseRouteFilePreview(text, ext).linePoints;

// Drop teleport-isolated fragments (typically <wpt> POIs the backend preview
// stitches ahead of the real track) and rebuild the elevation profile from the
// cleaned line so distance/elevation are measured on the track alone. A preview
// with no teleport is returned untouched, so the common single-track case pays
// nothing. Line points carry elevation, so the profile is rebuilt without any
// re-download of the source file.
export const sanitizeRoutePreview = (preview: ParsedRoutePreview): ParsedRoutePreview => {
  const linePoints = Array.isArray(preview?.linePoints) ? preview.linePoints : [];
  if (linePoints.length < 2) return preview;

  const segments = splitRouteLineSegments(linePoints);
  const totalPoints = segments.reduce((sum, segment) => sum + segment.length, 0);
  // No teleport: a single segment covering every point — leave the preview as-is.
  if (segments.length <= 1 && totalPoints === linePoints.length) return preview;

  const cleaned = segments.filter((segment) => segment.length >= 2).flat();
  // Never degrade a preview to unusable; keep the original if nothing real remains.
  if (cleaned.length < 2) return preview;

  return {
    ...preview,
    linePoints: cleaned,
    elevationProfile: buildElevationProfile(cleaned),
  };
};
