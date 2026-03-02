// utils/mapWebOverlays/geoJsonUtils.ts
// J3: GeoJSON utilities (extracted from lasyZanocujWfsOverlay.ts)

import type { BBox } from '@/utils/overpass';
import { normalizeBBox } from '@/utils/overpass';

const isFiniteNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value);

const featureIntersectsBBox = (feature: Record<string, unknown>, bbox: BBox): boolean => {
  const geometry = feature?.geometry as Record<string, unknown> | null;
  if (!geometry) return false;

  const checkCoord = (coord: unknown): boolean => {
    if (Array.isArray(coord) && typeof coord[0] === 'number' && typeof coord[1] === 'number') {
      const lng = coord[0];
      const lat = coord[1];
      return lng >= bbox.west && lng <= bbox.east && lat >= bbox.south && lat <= bbox.north;
    }
    if (Array.isArray(coord)) {
      return coord.some(checkCoord);
    }
    return false;
  };

  return checkCoord((geometry as Record<string, unknown>).coordinates);
};

export const filterGeoJsonByBBox = (geojson: Record<string, unknown>, bbox: BBox): Record<string, unknown> | null => {
  const features = geojson?.features;
  if (!Array.isArray(features)) return null;
  const filtered = features.filter((f: unknown) => featureIntersectsBBox(f as Record<string, unknown>, bbox));
  if (filtered.length === 0) return null;
  return { type: 'FeatureCollection', features: filtered };
};

export const geometryHasFiniteCoords = (geometry: unknown): boolean => {
  if (!geometry || typeof geometry !== 'object') return false;
  const geo = geometry as Record<string, unknown>;
  const { type, coordinates } = geo;
  if (!type || coordinates == null) return false;

  const isCoordPair = (coord: unknown) =>
    Array.isArray(coord) &&
    coord.length >= 2 &&
    isFiniteNumber(coord[0]) &&
    isFiniteNumber(coord[1]);

  const walk = (coords: unknown): boolean => {
    if (isCoordPair(coords)) return true;
    if (!Array.isArray(coords)) return false;
    return coords.every((c) => walk(c));
  };

  switch (type) {
    case 'Point':
      return isCoordPair(coordinates);
    case 'MultiPoint':
    case 'LineString':
    case 'MultiLineString':
    case 'Polygon':
    case 'MultiPolygon':
      return walk(coordinates);
    default:
      return false;
  }
};

export const sanitizeGeoJson = (geojson: unknown): Record<string, unknown> | null => {
  if (!geojson || typeof geojson !== 'object') return null;
  const geo = geojson as Record<string, unknown>;
  if (geo.type !== 'FeatureCollection' || !Array.isArray(geo.features)) return null;

  const features = geo.features.filter((feature: unknown) => {
    const f = feature as Record<string, unknown>;
    return geometryHasFiniteCoords(f?.geometry);
  });
  if (features.length === 0) return null;
  return { ...geo, features };
};

export const computeGeoJsonBounds = (geojson: unknown, swapAxes: boolean): BBox | null => {
  if (!geojson || typeof geojson !== 'object') return null;
  const geo = geojson as Record<string, unknown>;
  if (geo.type !== 'FeatureCollection' || !Array.isArray(geo.features)) return null;

  let south = Infinity;
  let west = Infinity;
  let north = -Infinity;
  let east = -Infinity;

  const pushPair = (pair: unknown) => {
    if (!Array.isArray(pair) || pair.length < 2) return;
    const a = Number(pair[0]);
    const b = Number(pair[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return;
    const lng = swapAxes ? b : a;
    const lat = swapAxes ? a : b;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    south = Math.min(south, lat);
    north = Math.max(north, lat);
    west = Math.min(west, lng);
    east = Math.max(east, lng);
  };

  const walk = (coords: unknown) => {
    if (!Array.isArray(coords)) return;
    if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      pushPair(coords);
      return;
    }
    for (const c of coords) walk(c);
  };

  for (const f of geo.features) {
    const feature = f as Record<string, unknown>;
    const g = feature?.geometry as Record<string, unknown> | null;
    if (!g || g.coordinates == null) continue;
    walk(g.coordinates);
  }

  if (!Number.isFinite(south) || !Number.isFinite(west) || !Number.isFinite(north) || !Number.isFinite(east)) return null;
  return normalizeBBox({ south, west, north, east });
};

export const bboxesOverlap = (a: BBox, b: BBox) => {
  if (!a || !b) return false;
  return !(a.east < b.west || a.west > b.east || a.north < b.south || a.south > b.north);
};

export const swapGeoJsonAxes = (geojson: Record<string, unknown>): Record<string, unknown> => {
  if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) return geojson;

  const swapCoords = (coords: unknown): unknown => {
    if (!Array.isArray(coords)) return coords;
    if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      return [coords[1], coords[0]];
    }
    return coords.map((c) => swapCoords(c));
  };

  return {
    ...geojson,
    features: geojson.features.map((f: unknown) => {
      const feature = f as Record<string, unknown>;
      const g = feature?.geometry as Record<string, unknown> | null;
      if (!g || g.coordinates == null) return f;
      return { ...feature, geometry: { ...g, coordinates: swapCoords(g.coordinates) } };
    }),
  };
};

