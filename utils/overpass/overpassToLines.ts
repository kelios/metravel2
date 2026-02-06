export type OSMLineCoord = {
  lat: number;
  lng: number;
};

export type OSMLineFeature = {
  id: string;
  title: string;
  tags: Record<string, string>;
  coords: OSMLineCoord[];
  osmUrl?: string;
};

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

const elementToLine = (el: OverpassElement): OSMLineFeature | null => {
  if (el.type !== 'way') return null;
  if (!Array.isArray(el.geometry) || el.geometry.length < 2) return null;

  const tags = el.tags || {};
  const name =
    tags['name:ru'] ||
    tags.name ||
    tags['name:en'] ||
    tags['name:pl'] ||
    '';

  const title = name || tags.route || 'Маршрут';

  const coords = el.geometry
    .filter((g) => Number.isFinite(g?.lat) && Number.isFinite(g?.lon))
    .map((g) => ({ lat: g.lat, lng: g.lon }));

  if (coords.length < 2) return null;

  return {
    id: `way/${el.id}`,
    title,
    tags,
    coords,
    osmUrl: `https://www.openstreetmap.org/way/${el.id}`,
  };
};

export const overpassToLines = (data: unknown): OSMLineFeature[] => {
  const resp = data as OverpassResponse;
  const elements = Array.isArray(resp?.elements) ? resp.elements : [];

  const seen = new Set<string>();
  const out: OSMLineFeature[] = [];

  for (const el of elements) {
    if (!el?.type) continue;
    if (!Number.isFinite(el.id)) continue;

    const line = elementToLine(el);
    if (!line) continue;
    if (seen.has(line.id)) continue;
    seen.add(line.id);
    out.push(line);
  }

  return out;
};
