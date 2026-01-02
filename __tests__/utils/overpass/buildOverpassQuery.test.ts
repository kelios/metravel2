import { buildOsmCampingOverpassQL, normalizeBBox } from '@/src/utils/overpass';

describe('overpass query builder', () => {
  it('normalizes bbox and produces query with bbox values', () => {
    const bbox = normalizeBBox({ south: 55, west: 20, north: 54, east: 19 });
    expect(bbox).toEqual({ south: 54, west: 19, north: 55, east: 20 });

    const q = buildOsmCampingOverpassQL(bbox);

    expect(q).toContain('node["tourism"="camp_site"](54,19,55,20)');
    expect(q).toContain('out center tags;');
  });
});
