import { overpassToLines } from '@/utils/overpass';

describe('overpassToLines', () => {
  it('maps ways with geometry to line features and skips invalid elements', () => {
    const data = {
      elements: [
        {
          type: 'way',
          id: 100,
          tags: { name: 'Trail 1', route: 'hiking' },
          geometry: [
            { lat: 10, lon: 20 },
            { lat: 10.1, lon: 20.1 },
          ],
        },
        {
          type: 'way',
          id: 101,
          tags: { route: 'bicycle' },
          geometry: [{ lat: 10, lon: 20 }],
        },
        {
          type: 'node',
          id: 1,
          tags: { name: 'not a line' },
          lat: 1,
          lon: 2,
        },
      ],
    };

    const lines = overpassToLines(data);
    expect(lines).toHaveLength(1);
    expect(lines[0].id).toBe('way/100');
    expect(lines[0].title).toBe('Trail 1');
    expect(lines[0].coords).toEqual([
      { lat: 10, lng: 20 },
      { lat: 10.1, lng: 20.1 },
    ]);
    expect(lines[0].osmUrl).toBe('https://www.openstreetmap.org/way/100');
  });
});
