export type BBox = {
  south: number;
  west: number;
  north: number;
  east: number;
};

export type OsmPoiCategory =
  | 'Достопримечательности'
  | 'Культура'
  | 'Видовые места'
  | 'Развлечения'
  | 'Религия'
  | 'История';

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

export const buildOsmPoiOverpassQL = (bbox: BBox, categories?: OsmPoiCategory[]) => {
  const b = normalizeBBox(bbox);

  const enabled = Array.isArray(categories)
    ? categories.filter(Boolean)
    : null;

  const parts: string[] = [];

  // tourism categories
  const tourismKinds: string[] = [];
  if (!enabled || enabled.includes('Достопримечательности')) tourismKinds.push('attraction');
  if (!enabled || enabled.includes('Культура')) tourismKinds.push('museum');
  if (!enabled || enabled.includes('Видовые места')) tourismKinds.push('viewpoint');
  if (!enabled || enabled.includes('Развлечения')) tourismKinds.push('zoo', 'theme_park');

  if (tourismKinds.length) {
    const re = `^(${tourismKinds.join('|')})$`;
    parts.push(
      `  node["tourism"~"${re}"](${b.south},${b.west},${b.north},${b.east});\n` +
        `  way["tourism"~"${re}"](${b.south},${b.west},${b.north},${b.east});`
    );
  }

  // historic category
  if (!enabled || enabled.includes('История')) {
    const re = '^(castle|manor|fort|ruins|archaeological_site|monument|memorial)$';
    parts.push(
      `  node["historic"~"${re}"](${b.south},${b.west},${b.north},${b.east});\n` +
        `  way["historic"~"${re}"](${b.south},${b.west},${b.north},${b.east});`
    );
  }

  // religion category
  if (!enabled || enabled.includes('Религия')) {
    parts.push(
      `  node["amenity"="place_of_worship"](${b.south},${b.west},${b.north},${b.east});\n` +
        `  way["amenity"="place_of_worship"](${b.south},${b.west},${b.north},${b.east});`
    );
  }

  return `[out:json][timeout:25];
(
${parts.join('\n\n')}
);
out center tags;`;
};

export const buildOsmRoutesOverpassQL = (bbox: BBox) => {
  const b = normalizeBBox(bbox);

  return `[out:json][timeout:25];
(
  relation["type"="route"]["route"~"^(hiking|bicycle)$"](${b.south},${b.west},${b.north},${b.east});
);
(._;>;);
out geom tags;`;
};
