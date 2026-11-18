import { listTravelRouteFiles } from '@/api/travelRoutes';
import { apiClient } from '@/api/client';
jest.mock('@/api/client', () => ({ apiClient: { get: jest.fn() } }));

it('preserves missing server altitude instead of turning null into sea level', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue([{
    id: 44, original_name: 'Mullerthal_Trail_Route_1.kml', ext: 'kml',
    preview: {
      line_points: [{ coord: '49.81,6.42', elevation: null }, { coord: '49.82,6.43', elevation: '' }],
      elevation_profile: [{ distance_km: 0, elevation_m: null }, { distance_km: 1, elevation_m: '' }],
    },
  }]);
  const [file] = await listTravelRouteFiles(761);
  expect(file.preview?.linePoints).toEqual([{ coord: '49.81,6.42' }, { coord: '49.82,6.43' }]);
  expect(file.preview?.elevationProfile).toEqual([]);
});

it('preserves real zero and negative altitude', async () => {
  (apiClient.get as jest.Mock).mockResolvedValue([{
    id: 1, original_name: 'sea.gpx', ext: 'gpx',
    preview: {
      line_points: [{ coord: '49,6', elevation: 0 }, { coord: '49.01,6', elevation: -10 }],
      elevation_profile: [{ distance_km: 0, elevation_m: 0 }, { distance_km: 1, elevation_m: -10 }],
    },
  }]);
  const [file] = await listTravelRouteFiles(1);
  expect(file.preview?.linePoints.map((p) => p.elevation)).toEqual([0, -10]);
  expect(file.preview?.elevationProfile.map((p) => p.elevationM)).toEqual([0, -10]);
});
