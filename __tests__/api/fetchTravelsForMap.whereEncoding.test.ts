import { fetchTravelsForMap } from '@/src/api/map';

jest.mock('@/src/utils/fetchWithTimeout', () => {
  return {
    __esModule: true,
    fetchWithTimeout: jest.fn(async (_url: string) => {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => [],
      };
    }),
  };
});

describe('fetchTravelsForMap where encoding', () => {
  test('serializes lat/lng as strings inside where', async () => {
    const { fetchWithTimeout } = require('@/src/utils/fetchWithTimeout');

    await fetchTravelsForMap(
      0,
      100,
      {
        lat: 50.06789111549241,
        lng: 19.849468752317385,
        radius: 60,
        publish: 1,
        moderation: 1,
      },
      { throwOnError: true }
    );

    expect(fetchWithTimeout).toHaveBeenCalled();
    const url = String(fetchWithTimeout.mock.calls[0][0]);
    const qs = url.split('?')[1] ?? '';
    const params = new URLSearchParams(qs);
    const whereRaw = params.get('where');
    expect(whereRaw).toBeTruthy();

    const where = JSON.parse(String(whereRaw));
    expect(typeof where.lat).toBe('string');
    expect(typeof where.lng).toBe('string');
    expect(where.radius).toBe(60);
    expect(where.publish).toBe(1);
    expect(where.moderation).toBe(1);
  });
});
