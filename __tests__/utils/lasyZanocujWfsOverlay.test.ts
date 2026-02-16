import { __wfsXmlToGeoJson, filterGeoJsonByBBox } from '@/utils/mapWebOverlays/lasyZanocujWfsOverlay';

describe('lasyZanocujWfsOverlay', () => {
  it('parses a minimal WFS GML FeatureCollection into GeoJSON', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs" xmlns:gml="http://www.opengis.net/gml" xmlns:WFS_BDL_mapa_turystyczna="http://example.com/WFS_BDL_mapa_turystyczna">
  <gml:featureMember>
    <WFS_BDL_mapa_turystyczna:Program_Zanocuj_w_lesie>
      <WFS_BDL_mapa_turystyczna:name>Test</WFS_BDL_mapa_turystyczna:name>
      <WFS_BDL_mapa_turystyczna:Shape>
        <gml:Polygon>
          <gml:outerBoundaryIs>
            <gml:LinearRing>
              <gml:coordinates>19.0,50.0 20.0,50.0 20.0,51.0 19.0,51.0 19.0,50.0</gml:coordinates>
            </gml:LinearRing>
          </gml:outerBoundaryIs>
        </gml:Polygon>
      </WFS_BDL_mapa_turystyczna:Shape>
    </WFS_BDL_mapa_turystyczna:Program_Zanocuj_w_lesie>
  </gml:featureMember>
</wfs:FeatureCollection>`;

    const geojson = __wfsXmlToGeoJson(xml);

    if (!geojson) {
      throw new Error('Expected XML to be parsed into GeoJSON, got null');
    }

    expect(geojson.type).toBe('FeatureCollection');
    expect(Array.isArray(geojson.features)).toBe(true);
    expect(geojson.features.length).toBeGreaterThan(0);

    const f = geojson.features[0];
    expect(f.type).toBe('Feature');
    expect(f.geometry).toBeTruthy();
    expect(f.geometry.type).toBe('Polygon');
  });

  it('parses WFS GML FeatureCollection with gml:featureMembers into GeoJSON', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<wfs:FeatureCollection xmlns:wfs="http://www.opengis.net/wfs" xmlns:gml="http://www.opengis.net/gml" xmlns:WFS_BDL_mapa_turystyczna="http://example.com/WFS_BDL_mapa_turystyczna">
  <gml:featureMembers>
    <WFS_BDL_mapa_turystyczna:Program_Zanocuj_w_lesie>
      <WFS_BDL_mapa_turystyczna:name>Test 2</WFS_BDL_mapa_turystyczna:name>
      <WFS_BDL_mapa_turystyczna:Shape>
        <gml:Polygon>
          <gml:outerBoundaryIs>
            <gml:LinearRing>
              <gml:coordinates>19.0,50.0 20.0,50.0 20.0,51.0 19.0,51.0 19.0,50.0</gml:coordinates>
            </gml:LinearRing>
          </gml:outerBoundaryIs>
        </gml:Polygon>
      </WFS_BDL_mapa_turystyczna:Shape>
    </WFS_BDL_mapa_turystyczna:Program_Zanocuj_w_lesie>
  </gml:featureMembers>
</wfs:FeatureCollection>`;

    const geojson = __wfsXmlToGeoJson(xml);

    if (!geojson) {
      throw new Error('Expected XML to be parsed into GeoJSON, got null');
    }

    expect(geojson.type).toBe('FeatureCollection');
    expect(Array.isArray(geojson.features)).toBe(true);
    expect(geojson.features.length).toBeGreaterThan(0);

    const f = geojson.features[0];
    expect(f.type).toBe('Feature');
    expect(f.geometry).toBeTruthy();
    expect(f.geometry.type).toBe('Polygon');
  });
});

describe('filterGeoJsonByBBox', () => {
  const makeFeature = (lng: number, lat: number) => ({
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[[lng, lat], [lng + 0.1, lat], [lng + 0.1, lat + 0.1], [lng, lat + 0.1], [lng, lat]]],
    },
    properties: { name: `Feature at ${lng},${lat}` },
  });

  const geojson = {
    type: 'FeatureCollection',
    features: [
      makeFeature(19.0, 50.0),
      makeFeature(21.0, 52.0),
      makeFeature(15.0, 54.0),
    ],
  };

  it('returns features that intersect the bbox', () => {
    const bbox = { south: 49.5, west: 18.5, north: 50.5, east: 19.5 };
    const result = filterGeoJsonByBBox(geojson, bbox);
    expect(result).not.toBeNull();
    expect(result.features).toHaveLength(1);
    expect(result.features[0].properties.name).toBe('Feature at 19,50');
  });

  it('returns null when no features intersect', () => {
    const bbox = { south: 40.0, west: 10.0, north: 41.0, east: 11.0 };
    const result = filterGeoJsonByBBox(geojson, bbox);
    expect(result).toBeNull();
  });

  it('returns multiple features when bbox is large', () => {
    const bbox = { south: 49.0, west: 14.0, north: 55.0, east: 24.0 };
    const result = filterGeoJsonByBBox(geojson, bbox);
    expect(result).not.toBeNull();
    expect(result.features).toHaveLength(3);
  });

  it('returns null for null/undefined input', () => {
    const bbox = { south: 49.0, west: 14.0, north: 55.0, east: 24.0 };
    expect(filterGeoJsonByBBox(null, bbox)).toBeNull();
    expect(filterGeoJsonByBBox(undefined, bbox)).toBeNull();
  });
});
