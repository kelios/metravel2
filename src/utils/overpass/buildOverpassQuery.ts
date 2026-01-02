export type BBox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const normalizeBBox = (bbox: BBox): BBox => {
  // Clamp to WGS84
  const south = clamp(bbox.south, -90, 90);
  const north = clamp(bbox.north, -90, 90);
  const west = clamp(bbox.west, -180, 180);
  const east = clamp(bbox.east, -180, 180);

  return {
    south: Math.min(south, north),
    west: Math.min(west, east),
    north: Math.max(south, north),
    east: Math.max(west, east),
  };
};

/**
 * "Camping/ночёвки" в терминах OSM.
 * Это не only-PL, но пригодно и для Польши.
 */
export const buildOsmCampingOverpassQL = (bbox: BBox) => {
  const b = normalizeBBox(bbox);

  return `[out:json][timeout:25];
(
  way["amenity"="shelter"](${b.south},${b.west},${b.north},${b.east});
  node["amenity"="shelter"](${b.south},${b.west},${b.north},${b.east});

  way["tourism"="wilderness_hut"](${b.south},${b.west},${b.north},${b.east});
  node["tourism"="wilderness_hut"](${b.south},${b.west},${b.north},${b.east});

  way["tourism"="camp_pitch"](${b.south},${b.west},${b.north},${b.east});
  node["tourism"="camp_pitch"](${b.south},${b.west},${b.north},${b.east});

  relation["tourism"="camp_site"](${b.south},${b.west},${b.north},${b.east});
  way["tourism"="camp_site"](${b.south},${b.west},${b.north},${b.east});
  node["tourism"="camp_site"](${b.south},${b.west},${b.north},${b.east});
);
out center tags;`;
};
