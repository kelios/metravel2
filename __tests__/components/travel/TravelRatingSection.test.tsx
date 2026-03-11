import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TravelRatingSection from '@/components/travel/TravelRatingSection';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/__tests__/helpers/testQueryClient';

const mockRateTravel = jest.fn();
const mockGetUserTravelRating = jest.fn();

jest.mock('@/api/travelRating', () => ({
  rateTravel: (...args: unknown[]) => mockRateTravel(...args),
  getUserTravelRating: (...args: unknown[]) => mockGetUserTravelRating(...args),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    authReady: true,
  }),
}));

jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({
    requireAuth: jest.fn(),
  }),
}));

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    text: '#111827',
    textMuted: '#6b7280',
    surface: '#ffffff',
    borderLight: '#e5e7eb',
    primary: '#2563eb',
    success: '#16a34a',
    warning: '#f59e0b',
  }),
}));

jest.mock('@/utils/toast', () => ({
  showToast: jest.fn(),
}));

describe('TravelRatingSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserTravelRating.mockResolvedValue(3);
    mockRateTravel.mockResolvedValue({
      rating: 4.2,
      rating_count: 5,
      user_rating: 5,
    });
  });

  it('allows changing an existing user rating', async () => {
    const queryClient = createTestQueryClient();
    const { getAllByLabelText } = render(
      <QueryClientProvider client={queryClient}>
        <TravelRatingSection
          travelId={503}
          initialRating={4}
          initialCount={5}
          initialUserRating={3}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(mockGetUserTravelRating).toHaveBeenCalledWith(503);
    });

    const fiveStarButtons = getAllByLabelText('Оценить на 5 из 5');
    fireEvent.press(fiveStarButtons[fiveStarButtons.length - 1]);

    await waitFor(() => {
      expect(mockRateTravel).toHaveBeenCalledWith({ travelId: 503, rating: 5 });
    });
  });
});
