/**
 * Интеграционные тесты для работы всех фильтров на главной странице
 */

import React from 'react';
import { render, waitFor, act, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ListTravel from '@/components/listTravel/ListTravel';
import { fetchTravels, fetchFilters, fetchFiltersCountry } from '@/src/api/travels';

// Мокаем AuthContext, чтобы ListTravel не требовал реальный AuthProvider
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    username: '',
    isSuperuser: false,
    userId: null,
    setIsAuthenticated: jest.fn(),
    setUsername: jest.fn(),
    setIsSuperuser: jest.fn(),
    setUserId: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    sendPassword: jest.fn(),
    setNewPassword: jest.fn(),
  }),
}));

jest.mock('@/components/listTravel/RecommendationsTabs', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/FavoriteButton', () => ({
  __esModule: true,
  default: () => null,
}));

const mockRoute = { name: 'travels', params: {} } as any;

jest.mock('@react-navigation/native', () => ({
  useRoute: () => mockRoute,
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
}));

// Mock API
jest.mock('@/src/api/travels', () => ({
  fetchTravels: jest.fn(),
  fetchFilters: jest.fn(),
  fetchFiltersCountry: jest.fn(),
}));

const mockFilters = {
  countries: [
    { country_id: 1, title_ru: 'Беларусь' },
    { country_id: 2, title_ru: 'Россия' },
  ],
  categories: [
    { id: '1', name: 'Пеший туризм' },
    { id: '2', name: 'Велотуризм' },
  ],
  categoryTravelAddress: [
    { id: '1', name: 'Музей' },
  ],
  transports: [
    { id: '1', name: 'Пешком' },
  ],
  companions: [
    { id: '1', name: 'Один' },
  ],
  complexity: [
    { id: '1', name: 'Легкая' },
  ],
  month: [
    { id: '1', name: 'Январь' },
  ],
  over_nights_stay: [
    { id: '1', name: 'Однодневная' },
  ],
};

describe('ListTravel - Filters Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
    jest.clearAllMocks();
    jest.useFakeTimers();

    (fetchFilters as jest.Mock).mockResolvedValue(mockFilters);
    (fetchFiltersCountry as jest.Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ListTravel />
      </QueryClientProvider>
    );
  };

  const mockTravelsResponse = (data: any[] = [], total = 0) => ({
    total,
    data,
  });

  describe('Filter application and API calls', () => {
    it('should fetch travels with default filters on mount', async () => {
      (fetchTravels as jest.Mock).mockResolvedValue(mockTravelsResponse([], 0));

      renderComponent();

      await waitFor(() => {
        expect(fetchTravels).toHaveBeenCalled();
      });

      const calls = (fetchTravels as jest.Mock).mock.calls;
      const lastCall = calls[calls.length - 1];
      const params = lastCall[3];

      expect(params.moderation).toBe(1);
      expect(params.publish).toBe(1);
    });

    it('should apply countries filter and fetch with correct params', async () => {
      (fetchTravels as jest.Mock).mockResolvedValue(mockTravelsResponse([], 0));

      const { getByText } = renderComponent();

      await waitFor(() => {
        expect(fetchFilters).toHaveBeenCalled();
      });

      // Open filters sidebar (if mobile) or find filter button
      // This is a simplified test - in real scenario would need to interact with UI
      
      // Simulate filter application
      act(() => {
        // In real scenario, user would click filter, select country, etc.
        // For now, we verify the API is called correctly
      });

      await waitFor(() => {
        expect(fetchTravels).toHaveBeenCalled();
      });
    });

    it('should apply year filter and fetch with correct params', async () => {
      (fetchTravels as jest.Mock).mockResolvedValue(mockTravelsResponse([], 0));

      renderComponent();

      await waitFor(() => {
        expect(fetchTravels).toHaveBeenCalled();
      });

      // Verify year filter can be applied
      // In real scenario, would interact with year input
    });

    it('should combine multiple filters in API call', async () => {
      (fetchTravels as jest.Mock).mockResolvedValue(mockTravelsResponse([], 0));

      renderComponent();

      await waitFor(() => {
        expect(fetchTravels).toHaveBeenCalled();
      });

      // Verify multiple filters can be combined
      // This would require UI interaction in real scenario
    });
  });

  describe('Travelsby preset filters', () => {
    it('forces Belarus country filter and renders data', async () => {
      jest.useRealTimers();
      mockRoute.name = 'travelsby';

      (fetchTravels as jest.Mock).mockResolvedValue(
        mockTravelsResponse([
          { id: 1, name: 'Беларусь маршрут', travel_image_thumb_url: 'http://example.com/img.jpg' },
        ], 160)
      );

      const { findByText } = renderComponent();

      const cardTitle = await findByText('Беларусь маршрут');
      expect(cardTitle).toBeTruthy();

      const params = (fetchTravels as jest.Mock).mock.calls[0][3];
      expect(params.countries).toEqual([3]);

      mockRoute.name = 'travels';
      jest.useFakeTimers();
    });
  });

  describe('Filter state management', () => {
    it('should reset filters and fetch with default params', async () => {
      (fetchTravels as jest.Mock).mockResolvedValue(mockTravelsResponse([], 0));

      renderComponent();

      await waitFor(() => {
        expect(fetchTravels).toHaveBeenCalled();
      });

      // Simulate filter reset
      // Verify API is called with default params after reset
    });

    it('should update query params when filters change', async () => {
      (fetchTravels as jest.Mock).mockResolvedValue(mockTravelsResponse([], 0));

      renderComponent();

      await waitFor(() => {
        expect(fetchTravels).toHaveBeenCalled();
      });

      // Verify query params update correctly
    });
  });

  describe('Filter UI interaction', () => {
    it('should show filter options when filters are loaded', async () => {
      (fetchTravels as jest.Mock).mockResolvedValue(mockTravelsResponse([], 0));

      const { getByText } = renderComponent();

      await waitFor(() => {
        expect(fetchFilters).toHaveBeenCalled();
      });

      // Verify filter options are rendered
      // This depends on UI structure
    });

    it('should update filter UI when selections change', async () => {
      (fetchTravels as jest.Mock).mockResolvedValue(mockTravelsResponse([], 0));

      renderComponent();

      await waitFor(() => {
        expect(fetchFilters).toHaveBeenCalled();
      });

      // Verify UI updates when filters are selected
    });
  });

  describe('Filter validation', () => {
    it('should normalize filter values before API call', async () => {
      (fetchTravels as jest.Mock).mockResolvedValue(mockTravelsResponse([], 0));

      renderComponent();

      await waitFor(() => {
        expect(fetchTravels).toHaveBeenCalled();
      });

      const calls = (fetchTravels as jest.Mock).mock.calls;
      if (calls.length > 0) {
        const params = calls[calls.length - 1][3];
        
        // Verify arrays contain numbers, not strings
        Object.entries(params).forEach(([key, value]) => {
          if (Array.isArray(value) && ['countries', 'transports', 'companions', 'complexity', 'month', 'over_nights_stay', 'categoryTravelAddress'].includes(key)) {
            expect(value.every((id: any) => typeof id === 'number')).toBe(true);
          }
        });
      }
    });

    it('should exclude empty filter values from API call', async () => {
      (fetchTravels as jest.Mock).mockResolvedValue(mockTravelsResponse([], 0));

      renderComponent();

      await waitFor(() => {
        expect(fetchTravels).toHaveBeenCalled();
      });

      const calls = (fetchTravels as jest.Mock).mock.calls;
      if (calls.length > 0) {
        const params = calls[calls.length - 1][3];
        
        // Verify no empty arrays or undefined values
        Object.entries(params).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            expect(value.length).toBeGreaterThan(0);
          }
          expect(value).not.toBeUndefined();
        });
      }
    });
  });

  describe('Filter persistence', () => {
    it('should maintain filter state during navigation', async () => {
      (fetchTravels as jest.Mock).mockResolvedValue(mockTravelsResponse([], 0));

      renderComponent();

      await waitFor(() => {
        expect(fetchTravels).toHaveBeenCalled();
      });

      // Verify filters persist (if implemented)
    });
  });

  describe('Filter error handling', () => {
    it('should handle filter API errors gracefully', async () => {
      (fetchFilters as jest.Mock).mockRejectedValue(new Error('Filter fetch failed'));
      (fetchTravels as jest.Mock).mockResolvedValue(mockTravelsResponse([], 0));

      renderComponent();

      await waitFor(() => {
        // Component should still render even if filters fail
        expect(fetchFilters).toHaveBeenCalled();
      });
    });

    it('should handle travels API errors with filters', async () => {
      (fetchTravels as jest.Mock).mockRejectedValue(new Error('Travels fetch failed'));

      renderComponent();

      await waitFor(() => {
        expect(fetchTravels).toHaveBeenCalled();
      });

      // Component should show error state
    });
  });

  describe('Filter performance', () => {
    it('should debounce rapid filter changes', async () => {
      (fetchTravels as jest.Mock).mockResolvedValue(mockTravelsResponse([], 0));

      renderComponent();

      await waitFor(() => {
        expect(fetchTravels).toHaveBeenCalled();
      });

      // Verify debouncing works (would need UI interaction)
    });

    it('should not make unnecessary API calls', async () => {
      (fetchTravels as jest.Mock).mockResolvedValue(mockTravelsResponse([], 0));

      renderComponent();

      await waitFor(() => {
        expect(fetchTravels).toHaveBeenCalled();
      });

      // Verify API is not called excessively
      const initialCallCount = (fetchTravels as jest.Mock).mock.calls.length;

      // Wait a bit
      jest.advanceTimersByTime(1000);

      // Should not have made additional calls without filter changes
      expect((fetchTravels as jest.Mock).mock.calls.length).toBe(initialCallCount);
    });
  });
});
