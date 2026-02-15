import { rateTravel, getUserTravelRating } from '@/api/travelRating';
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

  it('getUserTravelRating calls correct endpoint with userId', async () => {
    useAuthStore.setState({ userId: '77' });

    (apiClient.get as unknown as jest.Mock).mockResolvedValue({
      id: 1,
      user: 77,
      travel: 50,
      rating: 4,
    });

    const result = await getUserTravelRating(50);

    expect(apiClient.get).toHaveBeenCalledWith('/travels/travel50/rating/users/77/');
    expect(result).toBe(4);
  });

  it('getUserTravelRating returns null when no userId', async () => {
    useAuthStore.setState({ userId: null });

    const result = await getUserTravelRating(50);

    expect(apiClient.get).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('getUserTravelRating returns null on 404', async () => {
    useAuthStore.setState({ userId: '77' });

    (apiClient.get as unknown as jest.Mock).mockRejectedValue({ status: 404 });

    const result = await getUserTravelRating(50);

    expect(result).toBeNull();
  });
});
