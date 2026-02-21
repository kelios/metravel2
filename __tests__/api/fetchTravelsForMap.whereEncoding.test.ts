import { fetchTravelsForMap } from '@/api/map';

const mockFetchWithTimeout = jest.fn();

const createResponseMock = (payload: unknown) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  text: async () => JSON.stringify(payload),
});

jest.mock('@/utils/fetchWithTimeout', () => {
  return {
    __esModule: true,
    fetchWithTimeout: (...args: any[]) => mockFetchWithTimeout(...args),
  };
});

describe('fetchTravelsForMap where encoding', () => {
  beforeEach(() => {
    mockFetchWithTimeout.mockReset();
    mockFetchWithTimeout.mockResolvedValue(createResponseMock([]));
  });

  test('serializes lat/lng as strings inside where', async () => {
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

    expect(mockFetchWithTimeout).toHaveBeenCalled();
    const url = String(mockFetchWithTimeout.mock.calls[0][0]);
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

  test('drops bare media endpoint placeholders from image fields', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(
      createResponseMock({
        data: [
          {
            id: 1,
            coord: '53.9,27.56',
            travel_image_thumb_url: '/address-image/',
          },
        ],
      })
    );

    const result = await fetchTravelsForMap(
      0,
      20,
      { lat: 53.9, lng: 27.56, radius: 60 },
      { throwOnError: true }
    );

    const first = (result as any)[0];
    expect(first).toBeTruthy();
    expect(first.travelImageThumbUrl).toBe('');
    expect(first.imageUrl).toBe('');
  });

  test('keeps valid media file URLs', async () => {
    mockFetchWithTimeout.mockResolvedValueOnce(
      createResponseMock({
        data: [
          {
            id: 2,
            coord: '53.9,27.56',
            travel_image_thumb_url: '/travel-image/123/conversions/file.webp',
          },
        ],
      })
    );

    const result = await fetchTravelsForMap(
      0,
      20,
      { lat: 53.9, lng: 27.56, radius: 60 },
      { throwOnError: true }
    );

    const first = (result as any)[0];
    expect(first).toBeTruthy();
    expect(first.travelImageThumbUrl).toContain('/travel-image/123/conversions/file.webp');
    expect(first.imageUrl).toContain('/travel-image/123/conversions/file.webp');
  });
});
