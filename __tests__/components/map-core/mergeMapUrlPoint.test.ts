import { mergeMapUrlPoint } from '@/components/map-core/mergeMapUrlPoint';
import type { Point } from '@/components/map-core/types';

const target: Point = { id: 'url-49.261877,19.930121', coord: '49.261877,19.930121', address: 'Тропа над Реглями, Закопане' };

describe('explicit map URL point', () => {
  it('does not substitute the contextual source point for the precise physical target', () => {
    const context = { id: 14967, coord: '49.259,19.932', address: 'Context photo location', urlTravel: '/travels/context' };
    const points = mergeMapUrlPoint([context], target);
    expect(points).toEqual([context, target]);
    expect(points[1]).not.toHaveProperty('placeId');
    expect(points[1].id).not.toBe(14967);
    expect(points[1]).not.toHaveProperty('urlTravel');
  });

  it('uses one pin for a published point already represented by the server, retaining its source actions', () => {
    const existing = { id: 87, placeId: 87, coord: '49.250260,19.934727', address: 'Giewont', sourceCount: 2,
      urlTravel: '/travels/giewont', travelImageThumbUrl: 'https://example.test/giewont.webp' };
    const published = { id: '14117', coord: '49.2502602,19.9347267', address: 'Гевонт (крест на вершине)' };
    expect(mergeMapUrlPoint([existing], published)).toEqual([{ ...existing, coord: published.coord, address: published.address }]);
  });

  it('does not merge by an accidental identical id at a different coordinate', () => {
    const existing = { id: target.id, coord: '50.0,20.0', address: 'Another place' };
    expect(mergeMapUrlPoint([existing], target)).toEqual([existing, target]);
  });

  it('preserves the dataset identity without a new valid or changed URL target', () => {
    const points = [target];
    expect(mergeMapUrlPoint(points, null)).toBe(points);
    expect(mergeMapUrlPoint(points, { ...target, coord: 'invalid' })).toBe(points);
    expect(mergeMapUrlPoint(points, target)).toBe(points);
  });
});
