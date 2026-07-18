import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import PlaceRatingSection from '@/components/places/PlaceRatingSection';
import { createTestQueryClient } from '@/__tests__/helpers/testQueryClient';

const mockRatePlace = jest.fn();
const mockGetPlaceRating = jest.fn();
let mockIsAuthenticated = true;

jest.mock('@/api/placeRating', () => ({
  ratePlace: (...args: unknown[]) => mockRatePlace(...args),
  getPlaceRating: (...args: unknown[]) => mockGetPlaceRating(...args),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated, authReady: true }),
}));

jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ requireAuth: jest.fn() }),
}));

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    text: '#111827',
    textMuted: '#6b7280',
    surface: '#ffffff',
    borderLight: '#e5e7eb',
    borderStrong: '#d1d5db',
    primary: '#2563eb',
    brand: '#2563eb',
    success: '#16a34a',
    warning: '#f59e0b',
    warningAlpha40: 'rgba(245,158,11,0.4)',
  }),
}));

jest.mock('@/utils/toast', () => ({ showToast: jest.fn() }));

describe('PlaceRatingSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAuthenticated = true;
    mockGetPlaceRating.mockResolvedValue({ rating: 4.6, rating_count: 128, user_rating: 3 });
    mockRatePlace.mockResolvedValue({ rating: 4.7, rating_count: 129, user_rating: 5 });
  });

  it('submits the tapped rating for the place', async () => {
    const queryClient = createTestQueryClient();
    const { getAllByLabelText } = render(
      <QueryClientProvider client={queryClient}>
        <PlaceRatingSection placeId="1039" initialRating={4.6} initialCount={128} initialUserRating={3} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(mockGetPlaceRating).toHaveBeenCalledWith('1039'));

    const fiveStar = getAllByLabelText('Оценить на 5 из 5');
    fireEvent.press(fiveStar[fiveStar.length - 1]);

    await waitFor(() => {
      expect(mockRatePlace).toHaveBeenCalledWith({ placeId: '1039', rating: 5 });
    });
  });

  it('shows the login hint and does not query when the visitor cannot rate', () => {
    mockIsAuthenticated = false;
    const queryClient = createTestQueryClient();
    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <PlaceRatingSection placeId="1039" initialRating={4.6} initialCount={128} />
      </QueryClientProvider>,
    );
    expect(getByText('Войдите, чтобы оценить')).toBeTruthy();
    expect(mockGetPlaceRating).not.toHaveBeenCalled();
  });
});
