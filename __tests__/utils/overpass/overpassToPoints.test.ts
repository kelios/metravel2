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
});
