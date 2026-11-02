import { renderHook } from '@testing-library/react-native';
import type { MapClusterPoint, MapClustersResult } from '@/api/map';
import type { Point } from '@/components/MapPage/Map/types';

let mockClusterData: MapClustersResult | undefined;
let mockClusterError = false;
jest.mock('@/hooks/map/useMapClusters', () => ({
  useMapClusters: () => ({ data: mockClusterData, isError: mockClusterError }),
}));
jest.mock('@/hooks/map/useMapViewportSnapshot', () => ({
  useMapViewportSnapshot: () => ({ bbox: { south: 49.0, west: 19.0, north: 50.0, east: 20.0 }, zoom: 16 }),
}));
import { useServerPlaceLayerData } from '@/components/MapPage/Map/useMapRenderData';

const published: Point = { id: '14117', coord: '49.2502602,19.9347267', address: 'Гевонт (крест на вершине)' };
const coordinate: Point = { id: 'url-49.261877,19.930121', coord: '49.261877,19.930121', address: 'Тропа над Реглями, Закопане' };
const context: Point = { id: 14967, coord: '49.259,19.932', address: 'Context source' };
const serverPoint = (id: number, coord: string, address: string): MapClusterPoint => ({
  id, coord, address, lat: coord.split(',')[0], lng: coord.split(',')[1], categoryName: '',
  travelImageThumbUrl: '', imageUrl: '', urlTravel: '',
});
const args = (urlSelectedPlace: Point, travelData: Point[]) => ({
  mapInstance: {}, fallbackZoom: 16, mode: 'radius' as const, pointsOnly: false, canRenderMap: true,
  travelData, urlSelectedPlace, radiusCenter: { lat: 49.261877, lng: 19.930121 }, radiusInMeters: 50000,
  categoryFilterUnresolved: false,
});

describe('URL target survives either place data source', () => {
  beforeEach(() => { mockClusterData = undefined; mockClusterError = false; });

  it.each([published, coordinate])('adds $address in the client fallback', async target => {
    mockClusterError = true;
    const { result } = await renderHook(() => useServerPlaceLayerData(args(target, [context])));
    expect(result.current.markers).toEqual([context, target]);
  });

  it.each([published, coordinate])('retains $address alongside usable server results', async target => {
    mockClusterData = { clusters: [], markers: [serverPoint(14967, context.coord, context.address)],
      totalCount: 1, source: 'map', generatedAt: '' };
    const { result } = await renderHook(() => useServerPlaceLayerData(args(target, [])));
    expect(result.current.markers).toHaveLength(2);
    expect(result.current.markers.find(point => point.coord === target.coord)).toEqual(target);
  });

  it('deduplicates a matching published server point without dropping its article', async () => {
    mockClusterData = { clusters: [], markers: [{ ...serverPoint(87, '49.250260,19.934727', 'Giewont'),
      urlTravel: '/travels/giewont', placeId: 87, sourceCount: 2 }], totalCount: 1, source: 'map', generatedAt: '' };
    const { result } = await renderHook(() => useServerPlaceLayerData(args(published, [])));
    expect(result.current.markers).toHaveLength(1);
    expect(result.current.markers[0]).toMatchObject({ id: 87, placeId: 87, sourceCount: 2,
      coord: published.coord, address: published.address, urlTravel: '/travels/giewont' });
  });
});
