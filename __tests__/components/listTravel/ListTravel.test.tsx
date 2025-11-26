import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ListTravel from '@/components/listTravel/ListTravel';

// Mock AuthContext, чтобы не требовать реальный AuthProvider
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

// Mock dependencies
jest.mock('@/components/listTravel/RecommendationsTabs', () => ({
  __esModule: true,
  default: () => null,
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

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <ListTravel />
      </QueryClientProvider>
    );

  it('renders the search input', async () => {
    renderComponent();
    expect(await screen.findByPlaceholderText(/Найти путешествие/)).toBeTruthy();
  });

  it('renders an empty state message when there are no items', async () => {
    renderComponent();
    expect(await screen.findByText(/Пока нет путешествий/i)).toBeTruthy();
  });
});
