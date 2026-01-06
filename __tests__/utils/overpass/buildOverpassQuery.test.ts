import {
  buildOsmCampingOverpassQL,
  buildOsmPoiOverpassQL,
  buildOsmRoutesOverpassQL,
  normalizeBBox,
} from '@/src/utils/overpass';

describe('overpass query builder', () => {
  it('normalizes bbox and produces query with bbox values', () => {
    const bbox = normalizeBBox({ south: 55, west: 20, north: 54, east: 19 });
    expect(bbox).toEqual({ south: 54, west: 19, north: 55, east: 20 });

    const q = buildOsmCampingOverpassQL(bbox);

    expect(q).toContain('node["tourism"="camp_site"](54,19,55,20)');
    expect(q).toContain('out center tags;');
  });

  it('builds POI query containing common tourism/historic filters', () => {
    const bbox = normalizeBBox({ south: 10, west: 20, north: 11, east: 21 });
    const q = buildOsmPoiOverpassQL(bbox);

    expect(q).toContain('node["tourism"~"^(attraction|museum|viewpoint|zoo|theme_park)$"](10,20,11,21)');
    expect(q).toContain('node["historic"~"^(castle|manor|fort|ruins|archaeological_site|monument|memorial)$"](10,20,11,21)');
    expect(q).toContain('out center tags;');
  });

  it('builds routes query requesting hiking/bicycle relations with geometry', () => {
    const bbox = normalizeBBox({ south: -1, west: -2, north: 1, east: 2 });
    const q = buildOsmRoutesOverpassQL(bbox);

    expect(q).toContain('relation["type"="route"]["route"~"^(hiking|bicycle)$"](-1,-2,1,2)');
    expect(q).toContain('out geom tags;');
  });
});
