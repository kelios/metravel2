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
      return coord ? { coord, elevation } : null;
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

const parseGpx = (text: string): ParsedRoutePoint[] => {
  const points: ParsedRoutePoint[] = [];

  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/xml');
      const lineNodes = doc.querySelectorAll('trkpt, rtept');
      const fallbackNodes = lineNodes.length > 0 ? lineNodes : doc.querySelectorAll('wpt');

      for (let i = 0; i < fallbackNodes.length; i++) {
        const node = fallbackNodes[i] as any;
        const lat = Number(node.getAttribute('lat'));
        const lng = Number(node.getAttribute('lon'));
        const coord = toCoord(lat, lng);
        if (!coord) continue;
        const eleNode = typeof node.querySelector === 'function' ? node.querySelector('ele') : null;
        const elevation = normalizeElevation(eleNode?.textContent);
        points.push({ coord, elevation });
      }

      if (points.length > 0) return compactConsecutivePoints(points);
    } catch {
      // fallback to regex parser
    }
  }

  const regex =
    /<(trkpt|rtept)\b[^>]*\blat=["']([^"']+)["'][^>]*\blon=["']([^"']+)["'][^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null = regex.exec(text);
  let usedTrackNodes = false;
  while (match) {
    usedTrackNodes = true;
    const lat = Number(match[2]);
    const lng = Number(match[3]);
    const coord = toCoord(lat, lng);
    if (coord) {
      const eleMatch = String(match[4] ?? '').match(/<ele[^>]*>([^<]+)<\/ele>/i);
      points.push({ coord, elevation: normalizeElevation(eleMatch?.[1]) });
    }
    match = regex.exec(text);
  }

  if (!usedTrackNodes) {
    const wptRegex =
      /<wpt\b[^>]*\blat=["']([^"']+)["'][^>]*\blon=["']([^"']+)["'][^>]*>([\s\S]*?)<\/wpt>/gi;
    let wptMatch: RegExpExecArray | null = wptRegex.exec(text);
    while (wptMatch) {
      const lat = Number(wptMatch[1]);
      const lng = Number(wptMatch[2]);
      const coord = toCoord(lat, lng);
      if (coord) {
        const eleMatch = String(wptMatch[3] ?? '').match(/<ele[^>]*>([^<]+)<\/ele>/i);
        points.push({ coord, elevation: normalizeElevation(eleMatch?.[1]) });
      }
      wptMatch = wptRegex.exec(text);
    }
  }

  return compactConsecutivePoints(points);
};

const parseKml = (text: string): ParsedRoutePoint[] => {
  const points: ParsedRoutePoint[] = [];

  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/xml');
      const coordsNodes = doc.getElementsByTagName('coordinates');
      for (let i = 0; i < coordsNodes.length; i++) {
        const nodeText = String(coordsNodes[i].textContent ?? '').trim();
        if (!nodeText) continue;
        points.push(...parseKmlCoordinatesChunk(nodeText));
      }

      if (points.length > 0) return compactConsecutivePoints(points);
    } catch {
      // fallback to regex parser
    }
  }

  const regex = /<coordinates[^>]*>([\s\S]*?)<\/coordinates>/gi;
  let match: RegExpExecArray | null = regex.exec(text);
  while (match) {
    const chunk = String(match[1] ?? '').trim();
    if (chunk) {
      points.push(...parseKmlCoordinatesChunk(chunk));
    }
    match = regex.exec(text);
  }

  return compactConsecutivePoints(points);
};

export const parseRouteFilePreview = (text: string, ext?: string): ParsedRoutePreview => {
  const normalizedExt = String(ext ?? '').trim().toLowerCase().replace(/^\./, '');

  let linePoints: ParsedRoutePoint[] = [];

  if (normalizedExt === 'gpx') {
    linePoints = parseGpx(text);
  } else if (normalizedExt === 'kml') {
    linePoints = parseKml(text);
  } else {
    const kmlPoints = parseKml(text);
    linePoints = kmlPoints.length > 0 ? kmlPoints : parseGpx(text);
  }

  return {
    linePoints,
    elevationProfile: buildElevationProfile(linePoints),
  };
};

export const parseRouteFileToPoints = (text: string, ext?: string): ParsedRoutePoint[] =>
  parseRouteFilePreview(text, ext).linePoints;
