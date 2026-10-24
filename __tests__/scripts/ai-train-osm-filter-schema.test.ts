import fs from 'fs';
import path from 'path';

import { RADIUS_OPTIONS } from '@/constants/mapConfig';
import { buildOsmPoiOverpassQL, normalizeBBox, type OsmPoiCategory } from '@/utils/overpass';

/**
 * scripts/ai-train/osm_filter_schema.json is the one schema of the map-filter
 * intent the assistant learns (#2479): its enums must stay the map's own
 * categories and radii, or the model will be trained to emit filters the map
 * cannot apply.
 */
const SCHEMA_PATH = path.join(__dirname, '..', '..', 'scripts', 'ai-train', 'osm_filter_schema.json');

type Schema = {
  properties: {
    categories: { items: { enum: string[] } };
    radius_km: { enum: number[] };
  };
};

const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8')) as Schema;
const bbox = normalizeBBox({ south: 53, west: 26, north: 54, east: 27 });

describe('ai-train osm filter schema ↔ map filters', () => {
  it('every schema category selects a non-empty, narrower part of the POI query', () => {
    const all = buildOsmPoiOverpassQL(bbox);
    for (const category of schema.properties.categories.items.enum) {
      const one = buildOsmPoiOverpassQL(bbox, [category as OsmPoiCategory]);
      expect(one).toMatch(/node\["(tourism|historic|amenity)"/);
      expect(one.length).toBeLessThan(all.length);
    }
  });

  it('the schema categories together cover the whole unfiltered POI query', () => {
    const all = buildOsmPoiOverpassQL(bbox);
    const fromSchema = buildOsmPoiOverpassQL(bbox, schema.properties.categories.items.enum as OsmPoiCategory[]);
    expect(fromSchema).toBe(all);
  });

  it('radius_km enum equals the map radius options', () => {
    expect(schema.properties.radius_km.enum).toEqual(RADIUS_OPTIONS.map((o) => Number(o.id)));
  });
});
