import { __wfsXmlToGeoJson } from '@/src/utils/mapWebOverlays/lasyZanocujWfsOverlay';

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
