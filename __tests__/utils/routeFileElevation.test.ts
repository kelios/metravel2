import { addMissingRouteElevation } from '@/utils/routeFileElevation';
import { parseRouteFilePreview, calculateRouteDistanceKm } from '@/utils/routeFileParser';

// Coordinates from the reported Mullerthal KML: no third (altitude) column.
const kml = '<kml><Placemark><LineString><coordinates>6.421165551338548,49.81359681424817 6.4213452593462,49.81374392915242 6.421704675351262,49.813608929611405 6.422305490165834,49.81417488671207</coordinates></LineString></Placemark></kml>';
const originalFetch = global.fetch;
const fetchMock = jest.fn();
beforeEach(() => { global.fetch = fetchMock; fetchMock.mockReset(); });
afterAll(() => { global.fetch = originalFetch; });

it('builds a real KML profile without altering track geometry or distance; deduplicates concurrent requests', async () => {
  const preview = parseRouteFilePreview(kml, 'kml');
  expect(preview.elevationProfile).toEqual([]);
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ elevation: [165, 169, 161, 175] }) });
  const [result, duplicate] = await Promise.all([addMissingRouteElevation(preview), addMissingRouteElevation(preview)]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toContain('latitude=49.81360,49.81374,49.81361,49.81417&longitude=6.42117,6.42135,6.42170,6.42231');
  expect(result.elevationProfile.map((sample) => sample.elevationM)).toEqual([165, 169, 161, 175]);
  expect(duplicate).toEqual(result);
  expect(result.linePoints.map((point) => point.coord)).toEqual(preview.linePoints.map((point) => point.coord));
  expect(result.elevationProfile[3].distanceKm).toBeCloseTo(calculateRouteDistanceKm(preview.linePoints));
  expect(preview.linePoints.every((point) => point.elevation == null)).toBe(true);
});

it('uses recorded elevations including zero and below sea level without requests', async () => {
  const preview = { linePoints: [{ coord: '10,20', elevation: 0 }, { coord: '10.01,20', elevation: -5 }], elevationProfile: [] };
  const result = await addMissingRouteElevation(preview);
  expect(result.elevationProfile.map((sample) => sample.elevationM)).toEqual([0, -5]);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(await addMissingRouteElevation(result)).toBe(result);
});

let failureIndex = 0;
it.each([
  { ok: false, status: 429 },
  { ok: true, json: async () => ({ elevation: [null, 200] }) },
  { ok: true, json: async () => ({ elevation: [200] }) },
])('keeps missing elevations honest and allows retry after provider failure: %p', async (response) => {
  const longitude = 21 + failureIndex++;
  const preview = { linePoints: [{ coord: `11,${longitude}` }, { coord: `11.01,${longitude}` }], elevationProfile: [] };
  fetchMock.mockResolvedValueOnce(response).mockResolvedValueOnce({ ok: true, json: async () => ({ elevation: [0, 210] }) });
  expect(await addMissingRouteElevation(preview)).toBe(preview);
  expect((await addMissingRouteElevation(preview)).elevationProfile).toHaveLength(2);
});

it('caps sampling at 60 while keeping both endpoints and full track distance', async () => {
  const preview = { linePoints: Array.from({ length: 500 }, (_, i) => ({ coord: `12,${22 + i * 0.0001}` })), elevationProfile: [] };
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ elevation: Array.from({ length: 60 }, (_, i) => 100 + i) }) });
  const result = await addMissingRouteElevation(preview);
  expect(result.linePoints).toHaveLength(500);
  expect(result.elevationProfile).toHaveLength(60);
  expect(result.elevationProfile[0].distanceKm).toBe(0);
  expect(result.elevationProfile[59].distanceKm).toBeCloseTo(calculateRouteDistanceKm(preview.linePoints));
});
