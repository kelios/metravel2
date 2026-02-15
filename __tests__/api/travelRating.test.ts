import { rateTravel } from '@/api/travelRating';
import { apiClient } from '@/api/client';
import { useAuthStore } from '@/stores/authStore';

jest.mock('@/api/client', () => {
  const post = jest.fn();
  const get = jest.fn();
  return {
    apiClient: {
      post,
      get,
    },
  };
});

describe('api/travelRating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ userId: null });
  });

  it('posts travel+rating without user when userId is missing', async () => {
    (apiClient.post as unknown as jest.Mock).mockResolvedValue({
      rating: 4.0,
      rating_count: 10,
      user_rating: 4,
    });

    await rateTravel({ travelId: 123, rating: 4 });

    expect(apiClient.post).toHaveBeenCalledWith('/travels/rating/', {
      travel: 123,
      rating: 4,
    });
  });

  it('posts user+travel+rating when userId is available', async () => {
    useAuthStore.setState({ userId: '77' });

    (apiClient.post as unknown as jest.Mock).mockResolvedValue({
      rating: 4.6,
      rating_count: 11,
      user_rating: 5,
    });

    await rateTravel({ travelId: 123, rating: 5 });

    expect(apiClient.post).toHaveBeenCalledWith('/travels/rating/', {
      user: 77,
      travel: 123,
      rating: 5,
    });
  });
});
