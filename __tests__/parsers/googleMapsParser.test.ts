import { GoogleMapsParser } from '@/src/api/parsers/googleMapsParser';
import { PointStatus } from '@/types/userPoints';

describe('Google Maps Parser', () => {
  describe('parseJSON', () => {
    it('should parse valid Google Maps JSON', () => {
      const jsonData = {
        features: [
          {
            geometry: {
              coordinates: [30.5234, 50.4501]
            },
            properties: {
              Title: 'Kyiv Central Station',
              'Location': {
                'Address': 'Vokzalna Square, 1, Kyiv',
                'Business Status': 'OPERATIONAL',
                'Country Code': 'UA'
              },
              'Google Maps URL': 'https://maps.google.com/?cid=123456'
            }
          }
        ]
      };

      const result = (GoogleMapsParser as any).parseJSON(JSON.stringify(jsonData));
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Kyiv Central Station');
      expect(result[0].latitude).toBe(50.4501);
      expect(result[0].longitude).toBe(30.5234);
      expect(result[0].color).toBeDefined();
      expect(result[0].address).toBe('Vokzalna Square, 1, Kyiv');
    });

    it('should handle missing coordinates', () => {
      const jsonData = {
        features: [
          {
            properties: {
              Title: 'Test Place'
            }
          }
        ]
      };

      const result = (GoogleMapsParser as any).parseJSON(JSON.stringify(jsonData));
      expect(result).toHaveLength(0);
    });

    it('should auto-detect categories from keywords', () => {
      const jsonData = {
        features: [
          {
            geometry: { coordinates: [30.5, 50.4] },
            properties: {
              Title: 'Best Restaurant in Town',
              'Location': { 'Address': 'Main Street 1' }
            }
          }
        ]
      };

      const result = (GoogleMapsParser as any).parseJSON(JSON.stringify(jsonData));
      expect(result[0].category).toBe('');
    });

    it('should handle invalid JSON gracefully', () => {
      expect(() => {
        (GoogleMapsParser as any).parseJSON('invalid json');
      }).toThrow();
    });
  });

  describe('parseKML', () => {
    it('should parse valid KML', () => {
      const kmlData = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <Placemark>
              <name>Test Location</name>
              <description>A test place</description>
              <Point>
                <coordinates>30.5234,50.4501,0</coordinates>
              </Point>
            </Placemark>
          </Document>
        </kml>`;

      const result = (GoogleMapsParser as any).parseKML(kmlData);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Test Location');
      expect(result[0].description).toBe('A test place');
      expect(result[0].latitude).toBe(50.4501);
      expect(result[0].longitude).toBe(30.5234);
      expect(result[0].color).toBeDefined();
    });

    it('should preserve status and color from KML ExtendedData when provided', () => {
      const kmlData = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <Placemark>
              <name>Test Location</name>
              <ExtendedData>
                <Data name="status"><value>visited</value></Data>
                <Data name="color"><value>green</value></Data>
              </ExtendedData>
              <Point>
                <coordinates>30.5234,50.4501,0</coordinates>
              </Point>
            </Placemark>
          </Document>
        </kml>`;

      const result = (GoogleMapsParser as any).parseKML(kmlData);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(PointStatus.VISITED);
      expect(result[0].color).toBe('green');
    });

    it('should handle multiple placemarks', () => {
      const kmlData = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <Placemark>
              <name>Place 1</name>
              <Point><coordinates>30.5,50.4,0</coordinates></Point>
            </Placemark>
            <Placemark>
              <name>Place 2</name>
              <Point><coordinates>31.5,51.4,0</coordinates></Point>
            </Placemark>
          </Document>
        </kml>`;

      const result = (GoogleMapsParser as any).parseKML(kmlData);
      expect(result).toHaveLength(2);
    });

    it('should skip placemarks without coordinates', () => {
      const kmlData = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <Placemark>
              <name>No Coordinates</name>
            </Placemark>
          </Document>
        </kml>`;

      const result = (GoogleMapsParser as any).parseKML(kmlData);
      expect(result).toHaveLength(0);
    });
  });
});
