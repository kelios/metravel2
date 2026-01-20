import { OSMParser } from '@/src/api/parsers/osmParser';
import { PointStatus } from '@/types/userPoints';

describe('OSM Parser', () => {
  describe('parseGeoJSON', () => {
    it('should parse valid GeoJSON', () => {
      const geoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [30.5234, 50.4501]
            },
            properties: {
              name: 'Kyiv Opera House',
              amenity: 'theatre',
              address: 'Volodymyrska Street, 50'
            }
          }
        ]
      };

      const result = (OSMParser as any).parseGeoJSON(JSON.stringify(geoJSON));
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Kyiv Opera House');
      expect(result[0].latitude).toBe(50.4501);
      expect(result[0].longitude).toBe(30.5234);
      expect(result[0].color).toBeDefined();
      expect(result[0].categoryIds).toEqual([]);
    });

    it('should preserve status and color from GeoJSON properties when provided', () => {
      const geoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [30.5, 50.4]
            },
            properties: {
              name: 'Custom',
              status: 'visited',
              color: 'red'
            }
          }
        ]
      };

      const result = (OSMParser as any).parseGeoJSON(JSON.stringify(geoJSON));
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(PointStatus.VISITED);
      expect(result[0].color).toBe('red');
    });

    it('should auto-detect restaurant category', () => {
      const geoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [30.5, 50.4]
            },
            properties: {
              name: 'Pizza Place',
              amenity: 'restaurant'
            }
          }
        ]
      };

      const result = (OSMParser as any).parseGeoJSON(JSON.stringify(geoJSON));
      expect(result[0].categoryIds).toEqual([]);
    });

    it('should handle features without Point geometry', () => {
      const geoJSON = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [[30.5, 50.4], [30.6, 50.5]]
            },
            properties: { name: 'Road' }
          }
        ]
      };

      const result = (OSMParser as any).parseGeoJSON(JSON.stringify(geoJSON));
      expect(result).toHaveLength(0);
    });

    it('should handle invalid GeoJSON', () => {
      expect(() => {
        (OSMParser as any).parseGeoJSON('not valid json');
      }).toThrow();
    });
  });

  describe('parseGPX', () => {
    it('should parse valid GPX', () => {
      const gpxData = `<?xml version="1.0" encoding="UTF-8"?>
        <gpx version="1.1">
          <wpt lat="50.4501" lon="30.5234">
            <name>Test Waypoint</name>
            <desc>A test description</desc>
          </wpt>
        </gpx>`;

      const result = (OSMParser as any).parseGPX(gpxData);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test Waypoint');
      expect(result[0].description).toBe('A test description');
      expect(result[0].latitude).toBe(50.4501);
      expect(result[0].longitude).toBe(30.5234);
      expect(result[0].color).toBeDefined();
    });

    it('should preserve status and color from GPX when provided', () => {
      const gpxData = `<?xml version="1.0" encoding="UTF-8"?>
        <gpx version="1.1">
          <wpt lat="50.4501" lon="30.5234">
            <name>Test Waypoint</name>
            <status>want_to_visit</status>
            <color>purple</color>
          </wpt>
        </gpx>`;

      const result = (OSMParser as any).parseGPX(gpxData);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(PointStatus.WANT_TO_VISIT);
      expect(result[0].color).toBe('purple');
    });

    it('should handle multiple waypoints', () => {
      const gpxData = `<?xml version="1.0" encoding="UTF-8"?>
        <gpx version="1.1">
          <wpt lat="50.4" lon="30.5">
            <name>Point 1</name>
          </wpt>
          <wpt lat="51.4" lon="31.5">
            <name>Point 2</name>
          </wpt>
        </gpx>`;

      const result = (OSMParser as any).parseGPX(gpxData);
      expect(result).toHaveLength(2);
    });

    it('should skip waypoints without coordinates', () => {
      const gpxData = `<?xml version="1.0" encoding="UTF-8"?>
        <gpx version="1.1">
          <wpt>
            <name>No Coordinates</name>
          </wpt>
        </gpx>`;

      const result = (OSMParser as any).parseGPX(gpxData);
      expect(result).toHaveLength(0);
    });

    it('should detect hotel category from tags', () => {
      const gpxData = `<?xml version="1.0" encoding="UTF-8"?>
        <gpx version="1.1">
          <wpt lat="50.4" lon="30.5">
            <name>Grand Hotel</name>
            <type>hotel</type>
          </wpt>
        </gpx>`;

      const result = (OSMParser as any).parseGPX(gpxData);
      expect(result[0].categoryIds).toEqual([]);
    });
  });
});
