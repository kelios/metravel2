import type { ParsedRoutePoint, ParsedRoutePreview, RouteElevationSample } from '@/types/travelRoutes';

const EARTH_RADIUS_M = 6371000;

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

export const calculateRouteDistanceKm = (linePoints: ParsedRoutePoint[]): number => {
  if (!Array.isArray(linePoints) || linePoints.length < 2) return 0;

  let totalDistanceM = 0;
  let prevCoord = parseCoordPair(linePoints[0].coord);

  for (let i = 1; i < linePoints.length; i += 1) {
    const currentCoord = parseCoordPair(linePoints[i].coord);
    if (currentCoord && prevCoord) {
      totalDistanceM += distanceMeters(prevCoord, currentCoord);
    }
    prevCoord = currentCoord;
  }

  return totalDistanceM / 1000;
};

const buildElevationProfile = (linePoints: ParsedRoutePoint[]): RouteElevationSample[] => {
  if (!Array.isArray(linePoints) || linePoints.length < 2) return [];

  let totalDistanceM = 0;
  let prevCoord = parseCoordPair(linePoints[0].coord);
  const profile: RouteElevationSample[] = [];

  for (let i = 0; i < linePoints.length; i += 1) {
    const current = linePoints[i];
    const currentCoord = parseCoordPair(current.coord);
    if (currentCoord && prevCoord) {
      totalDistanceM += distanceMeters(prevCoord, currentCoord);
    }
    prevCoord = currentCoord;

    if (Number.isFinite(current.elevation as number)) {
      profile.push({
        distanceKm: totalDistanceM / 1000,
        elevationM: Number(current.elevation),
      });
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
