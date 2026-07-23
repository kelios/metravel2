import type { ParsedRoutePoint, ParsedRoutePreview, RouteElevationSample } from '@/types/travelRoutes';

const EARTH_RADIUS_M = 6371000;

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

const buildElevationProfile = (linePoints: ParsedRoutePoint[]): RouteElevationSample[] => {
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

const parseGpxPointsFromElementNodes = (nodes: Element[]): ParsedRoutePoint[] => {
  const points: ParsedRoutePoint[] = [];

  for (const node of nodes) {
    const lat = Number(node.getAttribute('lat'));
    const lng = Number(node.getAttribute('lon'));
    const coord = toCoord(lat, lng);
    if (!coord) continue;

    const eleNode = getElementsByLocalName(node, 'ele')[0] ?? null;
    const elevation = normalizeElevation(eleNode?.textContent);
    points.push({ coord, elevation });
  }

  return compactConsecutivePoints(points);
};

const parseGpxPointsFromText = (
  text: string,
  pointTag: 'trkpt' | 'rtept' | 'wpt',
): ParsedRoutePoint[] => {
  const points: ParsedRoutePoint[] = [];
  const fullNodeRegex = new RegExp(
    `<${pointTag}\\b[^>]*\\blat=["']([^"']+)["'][^>]*\\blon=["']([^"']+)["'][^>]*>([\\s\\S]*?)<\\/${pointTag}>`,
    'gi',
  );

  let fullNodeMatch: RegExpExecArray | null = fullNodeRegex.exec(text);
  while (fullNodeMatch) {
    const lat = Number(fullNodeMatch[1]);
    const lng = Number(fullNodeMatch[2]);
    const coord = toCoord(lat, lng);
    if (coord) {
      const eleMatch = String(fullNodeMatch[3] ?? '').match(/<ele[^>]*>([^<]+)<\/ele>/i);
      points.push({ coord, elevation: normalizeElevation(eleMatch?.[1]) });
    }
    fullNodeMatch = fullNodeRegex.exec(text);
  }

  if (points.length === 0) {
    const selfClosingRegex = new RegExp(
      `<${pointTag}\\b[^>]*\\blat=["']([^"']+)["'][^>]*\\blon=["']([^"']+)["'][^>]*/>`,
      'gi',
    );
    let selfClosingMatch: RegExpExecArray | null = selfClosingRegex.exec(text);
    while (selfClosingMatch) {
      const lat = Number(selfClosingMatch[1]);
      const lng = Number(selfClosingMatch[2]);
      const coord = toCoord(lat, lng);
      if (coord) points.push({ coord });
      selfClosingMatch = selfClosingRegex.exec(text);
    }
  }

  return compactConsecutivePoints(points);
};

const parseGpxTracks = (text: string): ParsedRoutePoint[][] => {
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/xml');

      const trackNodes = getElementsByLocalName(doc, 'trk');
      const trackLines = trackNodes
        .map((trackNode) => parseGpxPointsFromElementNodes(getElementsByLocalName(trackNode, 'trkpt')))
        .filter((line) => line.length > 0);
      if (trackLines.length > 0) return trackLines;

      const routeNodes = getElementsByLocalName(doc, 'rte');
      const routeLines = routeNodes
        .map((routeNode) => parseGpxPointsFromElementNodes(getElementsByLocalName(routeNode, 'rtept')))
        .filter((line) => line.length > 0);
      if (routeLines.length > 0) return routeLines;

      const wptNodes = getElementsByLocalName(doc, 'wpt');
      const waypoints = parseGpxPointsFromElementNodes(wptNodes);
      if (waypoints.length > 0) return [waypoints];
    } catch {
      // fallback to regex parser
    }
  }

  const trackLines: ParsedRoutePoint[][] = [];
  const trackBlockRegex = /<trk\b[\s\S]*?<\/trk>/gi;
  let trackBlockMatch: RegExpExecArray | null = trackBlockRegex.exec(text);
  while (trackBlockMatch) {
    const line = parseGpxPointsFromText(String(trackBlockMatch[0] ?? ''), 'trkpt');
    if (line.length > 0) trackLines.push(line);
    trackBlockMatch = trackBlockRegex.exec(text);
  }
  if (trackLines.length > 0) return trackLines;

  const routeLines: ParsedRoutePoint[][] = [];
  const routeBlockRegex = /<rte\b[\s\S]*?<\/rte>/gi;
  let routeBlockMatch: RegExpExecArray | null = routeBlockRegex.exec(text);
  while (routeBlockMatch) {
    const line = parseGpxPointsFromText(String(routeBlockMatch[0] ?? ''), 'rtept');
    if (line.length > 0) routeLines.push(line);
    routeBlockMatch = routeBlockRegex.exec(text);
  }
  if (routeLines.length > 0) return routeLines;

  const genericTrackNodes = parseGpxPointsFromText(text, 'trkpt');
  if (genericTrackNodes.length > 0) return [genericTrackNodes];

  const genericRouteNodes = parseGpxPointsFromText(text, 'rtept');
  if (genericRouteNodes.length > 0) return [genericRouteNodes];

  const waypointNodes = parseGpxPointsFromText(text, 'wpt');
  if (waypointNodes.length > 0) return [waypointNodes];

  return [];
};

const parseKmlLines = (text: string): ParsedRoutePoint[][] => {
  const lines: ParsedRoutePoint[][] = [];

  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/xml');
      const coordsNodes = doc.getElementsByTagName('coordinates');
      for (let i = 0; i < coordsNodes.length; i += 1) {
        const nodeText = String(coordsNodes[i].textContent ?? '').trim();
        if (!nodeText) continue;
        const line = compactConsecutivePoints(parseKmlCoordinatesChunk(nodeText));
        if (line.length > 0) lines.push(line);
      }

      if (lines.length > 0) return lines;
    } catch {
      // fallback to regex parser
    }
  }

  const regex = /<coordinates[^>]*>([\s\S]*?)<\/coordinates>/gi;
  let match: RegExpExecArray | null = regex.exec(text);
  while (match) {
    const chunk = String(match[1] ?? '').trim();
    if (chunk) {
      const line = compactConsecutivePoints(parseKmlCoordinatesChunk(chunk));
      if (line.length > 0) lines.push(line);
    }
    match = regex.exec(text);
  }

  return lines;
};

export const parseRouteFilePreviews = (text: string, ext?: string): ParsedRoutePreview[] => {
  const normalizedExt = String(ext ?? '').trim().toLowerCase().replace(/^\./, '');

  let lineGroups: ParsedRoutePoint[][] = [];

  if (normalizedExt === 'gpx') {
    lineGroups = parseGpxTracks(text);
  } else if (normalizedExt === 'kml') {
    lineGroups = parseKmlLines(text);
  } else {
    const kmlGroups = parseKmlLines(text);
    lineGroups = kmlGroups.length > 0 ? kmlGroups : parseGpxTracks(text);
  }

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
