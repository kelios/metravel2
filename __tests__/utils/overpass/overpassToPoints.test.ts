import { overpassToPoints } from '@/src/utils/overpass';

describe('overpassToPoints', () => {
  it('maps nodes and ways with center to points', () => {
    const data = {
      elements: [
        { type: 'node', id: 1, lat: 52.1, lon: 21.0, tags: { tourism: 'camp_site', name: 'A' } },
        { type: 'way', id: 2, center: { lat: 52.2, lon: 21.1 }, tags: { amenity: 'shelter' } },
        { type: 'node', id: 1, lat: 52.1, lon: 21.0, tags: { tourism: 'camp_site', name: 'A' } },
      ],
    };

    const pts = overpassToPoints(data);
    expect(pts).toHaveLength(2);
    expect(pts[0].id).toBe('node/1');
    expect(pts[0].title).toBe('A');
    expect(pts[1].id).toBe('way/2');
    expect(pts[1].title).toBe('Укрытие');
  });

  it('uses readable fallback titles for POI tags when name is missing', () => {
    const data = {
      elements: [
        { type: 'node', id: 10, lat: 1, lon: 2, tags: { historic: 'castle' } },
        { type: 'node', id: 11, lat: 1, lon: 2, tags: { tourism: 'viewpoint' } },
        { type: 'node', id: 12, lat: 1, lon: 2, tags: { amenity: 'place_of_worship' } },
      ],
    };

    const pts = overpassToPoints(data);
    expect(pts).toHaveLength(3);
    expect(pts[0].title).toBe('Замок');
    expect(pts[1].title).toBe('Смотровая площадка');
    expect(pts[2].title).toBe('Храм');
  });

  it('drops elements with non-finite coordinates', () => {
    const data = {
      elements: [
        { type: 'node', id: 1, lat: 52.1, lon: 21.0, tags: { tourism: 'camp_site' } },
        { type: 'node', id: 2, lat: NaN, lon: 21.0, tags: { tourism: 'camp_site' } },
        { type: 'way', id: 3, center: { lat: 52.2, lon: NaN }, tags: { tourism: 'camp_site' } },
      ],
    };

    const pts = overpassToPoints(data);
    expect(pts).toHaveLength(1);
    expect(pts[0].id).toBe('node/1');
  });
});
