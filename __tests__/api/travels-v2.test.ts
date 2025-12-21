import { fetchTravelBySlugV2 } from '@/src/api/travels-v2';
import { apiClient } from '@/src/api/client';

jest.mock('@/src/api/client', () => {
  const actual = jest.requireActual('@/src/api/client');
  return {
    ...actual,
    apiClient: {
      get: jest.fn(),
    },
    ApiError: actual.ApiError,
  };
});

const mockedApiClientGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;

describe('src/api/travels-v2.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchTravelBySlugV2', () => {
    it('использует путь /api/travels/by-slug/{slug}/', async () => {
      mockedApiClientGet.mockResolvedValueOnce({ id: 1, slug: 'sluggy' } as any);

      await fetchTravelBySlugV2('sluggy');

      expect(mockedApiClientGet).toHaveBeenCalledWith('/api/travels/by-slug/sluggy/');
    });

    it('кодирует slug и убирает лидирующие слэши', async () => {
      mockedApiClientGet.mockResolvedValueOnce({ id: 2, slug: 'encoded' } as any);

      await fetchTravelBySlugV2('/слэш пробел');

      expect(mockedApiClientGet).toHaveBeenCalledWith('/api/travels/by-slug/%D1%81%D0%BB%D1%8D%D1%88%20%D0%BF%D1%80%D0%BE%D0%B1%D0%B5%D0%BB/');
    });
  });
});
