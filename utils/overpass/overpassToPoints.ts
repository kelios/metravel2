import type { BBox } from './buildOverpassQuery';
import { translate as i18nT } from '@/i18n'


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

  const lat = Number(loc.lat);
  const lon = Number(loc.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

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
    lat,
    lng: lon,
    title,
    tags,
    osmUrl,
  };
};

const kindToRu = (tags: Record<string, string>) => {
  const tourism = tags.tourism;
  const amenity = tags.amenity;
  const historic = tags.historic;

  if (tourism === 'camp_site') return i18nT('shared:utils.overpass.overpassToPoints.kemping_d42ccf94');
  if (tourism === 'camp_pitch') return i18nT('shared:utils.overpass.overpassToPoints.mesto_pod_palatku_476095f7');
  if (tourism === 'wilderness_hut') return i18nT('shared:utils.overpass.overpassToPoints.lesnoy_domik_a7174313');
  if (amenity === 'shelter') return i18nT('shared:utils.overpass.overpassToPoints.ukrytie_2e5866dd');
  if (tourism === 'museum') return i18nT('shared:utils.overpass.overpassToPoints.muzey_53b0357b');
  if (tourism === 'viewpoint') return i18nT('shared:utils.overpass.overpassToPoints.smotrovaya_ploschadka_079b8b75');
  if (tourism === 'attraction') return i18nT('shared:utils.overpass.overpassToPoints.dostoprimechatelnost_82ddbe51');
  if (amenity === 'place_of_worship') return i18nT('shared:utils.overpass.overpassToPoints.hram_347d0fbc');
  if (historic === 'castle') return i18nT('shared:utils.overpass.overpassToPoints.zamok_f5862887');
  if (historic === 'manor') return i18nT('shared:utils.overpass.overpassToPoints.usadba_d7bcce18');
  if (historic === 'fort') return i18nT('shared:utils.overpass.overpassToPoints.fort_8412b387');
  if (historic === 'memorial') return i18nT('shared:utils.overpass.overpassToPoints.memorial_46212ee6');
  if (historic === 'monument') return i18nT('shared:utils.overpass.overpassToPoints.pamyatnik_87e97ae4');
  if (historic === 'ruins') return i18nT('shared:utils.overpass.overpassToPoints.ruiny_7ed4495d');

  return tourism || historic || amenity || i18nT('sharedStatic:map.pointFallback');
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
