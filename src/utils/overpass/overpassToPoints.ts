import type { BBox } from './buildOverpassQuery';

export type OSMPointFeature = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  tags: Record<string, string>;
  osmUrl?: string;
};

type OverpassElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

export const elementToPoint = (el: OverpassElement): OSMPointFeature | null => {
  const tags = el.tags || {};
  const loc =
    el.type === 'node'
      ? el.lat != null && el.lon != null
        ? { lat: el.lat, lon: el.lon }
        : null
      : el.center
        ? el.center
        : null;

  if (!loc) return null;

  const name =
    tags['name:ru'] ||
    tags.name ||
    tags['name:en'] ||
    tags['name:pl'] ||
    '';

  const kindRu = kindToRu(tags);
  const title = name ? name : kindRu;

  const osmUrl = `https://www.openstreetmap.org/${el.type}/${el.id}`;

  return {
    id: `${el.type}/${el.id}`,
    lat: loc.lat,
    lng: loc.lon,
    title,
    tags,
    osmUrl,
  };
};

const kindToRu = (tags: Record<string, string>) => {
  const tourism = tags.tourism;
  const amenity = tags.amenity;

  if (tourism === 'camp_site') return 'Кемпинг';
  if (tourism === 'camp_pitch') return 'Место под палатку';
  if (tourism === 'wilderness_hut') return 'Лесной домик';
  if (amenity === 'shelter') return 'Укрытие';

  return tourism || amenity || 'Ночёвка';
};

export const overpassToPoints = (data: unknown): OSMPointFeature[] => {
  const resp = data as OverpassResponse;
  const elements = Array.isArray(resp?.elements) ? resp.elements : [];

  const seen = new Set<string>();
  const out: OSMPointFeature[] = [];

  for (const el of elements) {
    if (!el?.type) continue;
    if (!Number.isFinite(el.id)) continue;
    const p = elementToPoint(el);
    if (!p) continue;
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }

  return out;
};

export const bboxAreaKm2 = (bbox: BBox) => {
  // Rough bbox area estimate
  const latKm = 111.32;
  const avgLat = (bbox.north + bbox.south) / 2;
  const lngKm = 111.32 * Math.cos((avgLat * Math.PI) / 180);
  const h = Math.abs(bbox.north - bbox.south) * latKm;
  const w = Math.abs(bbox.east - bbox.west) * lngKm;
  return h * w;
};
