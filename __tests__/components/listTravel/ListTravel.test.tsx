import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ListTravel from '@/components/listTravel/ListTravel';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  multiGet: jest.fn(() => Promise.resolve([['userId', '1'], ['isSuperuser', 'false']])),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ name: 'travels' }),
}));

jest.mock('@/src/api/travels', () => ({
  fetchTravels: jest.fn(() => Promise.resolve({ data: [], total: 0, hasMore: false })),
  fetchFilters: jest.fn(() => Promise.resolve({})),
  fetchFiltersCountry: jest.fn(() => Promise.resolve([])),
}));

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

describe('ListTravel', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('renders without crashing', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ListTravel />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('travel-list')).toBeTruthy();
    });
  });

  it('shows search bar', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ListTravel />
      </QueryClientProvider>
    );

    expect(screen.getByPlaceholderText(/найти путешествие/i)).toBeTruthy();
  });

  it('handles empty state', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ListTravel />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText(/ничего не найдено/i)).toBeTruthy();
    });
  });
});

