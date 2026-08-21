const mockParseRouteFilePreviews = jest.fn(() => [
  {
    linePoints: [{ coord: '52.1,23.7' }, { coord: '52.2,23.8' }],
    elevationProfile: [],
  },
]);

jest.mock('@/utils/routeFileParser', () => ({
  calculateRouteDistanceKm: jest.fn(() => 12.5),
  parseRouteFileMetadata: jest.fn(() => ({
    ok: true,
    format: 'gpx',
    namedPoints: [],
  })),
  parseRouteFilePreviews: (...args: unknown[]) => mockParseRouteFilePreviews(...args),
}));

import { prepareTripRouteImport } from '@/components/trips/planning/tripRouteImport';

describe('prepareTripRouteImport parser contract', () => {
  it('delegates geometry extraction to parseRouteFilePreviews', () => {
    const result = prepareTripRouteImport({ fileName: 'delegated.gpx', text: '<gpx />' });

    expect(mockParseRouteFilePreviews).toHaveBeenCalledWith('<gpx />', 'gpx');
    expect(result).toMatchObject({
      ok: true,
      data: {
        routes: [{ originalPointCount: 2, distanceKm: 12.5 }],
      },
    });
  });
});
