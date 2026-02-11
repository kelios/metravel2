import { render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ExportScreen from '@/app/(tabs)/export';
import { useAuth } from '@/context/AuthContext';
import { useIsFocused } from '@react-navigation/native';
import { fetchMyTravels } from '@/api/travelsApi';

jest.mock('@/context/AuthContext');

jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn(),
}));

jest.mock('expo-router', () => ({
  usePathname: () => '/export',
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('@/utils/analytics', () => ({
  sendAnalyticsEvent: jest.fn(),
}));

jest.mock('@/components/seo/InstantSEO', () => {
  return () => null;
});

jest.mock('@/components/listTravel/ListTravel', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return function MockListTravel() {
    return (
      <View testID="list-travel">
        <Text>ListTravel</Text>
      </View>
    );
  };
});

jest.mock('@expo/vector-icons', () => ({
  Feather: ({ name, ...props }: any) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: `feather-${name}`, ...props });
  },
}));

jest.mock('@/api/travelsApi', () => ({
  fetchMyTravels: jest.fn(),
  unwrapMyTravelsPayload: (payload: any) => {
    if (!payload) return { items: [], total: 0 };
    if (Array.isArray(payload)) return { items: payload, total: payload.length };
    if (Array.isArray(payload?.data)) return { items: payload.data, total: payload.data.length };
    if (Array.isArray(payload?.results)) return { items: payload.results, total: Number(payload.count ?? payload.total ?? payload.results.length) || payload.results.length };
    if (Array.isArray(payload?.items)) return { items: payload.items, total: Number(payload.total ?? payload.count ?? payload.items.length) || payload.items.length };
    return { items: [], total: Number(payload?.total ?? payload?.count ?? 0) || 0 };
  },
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseIsFocused = useIsFocused as jest.MockedFunction<typeof useIsFocused>;
const mockFetchMyTravels = fetchMyTravels as jest.MockedFunction<typeof fetchMyTravels>;

const renderExport = (queryClient: QueryClient) =>
  render(
    <QueryClientProvider client={queryClient}>
      <ExportScreen />
    </QueryClientProvider>
  );

describe('ExportScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsFocused.mockReturnValue(true);
  });

  const createQueryClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

  it('shows login empty state for unauthenticated users', () => {
    const queryClient = createQueryClient();
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      userId: null,
    } as any);

    const { getByText } = renderExport(queryClient);

    expect(getByText('Войдите, чтобы собрать PDF‑книгу')).toBeTruthy();
    expect(mockFetchMyTravels).not.toHaveBeenCalled();
  });

  it('does not show empty state until userId is available', () => {
    const queryClient = createQueryClient();
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      userId: null,
    } as any);

    const { queryByText, getByText } = renderExport(queryClient);

    // Пока userId нет — показываем загрузку и не показываем empty state
    expect(getByText('Загрузка...')).toBeTruthy();
    expect(
      queryByText('Чтобы собрать PDF‑книгу, добавьте хотя бы одно путешествие')
    ).toBeNull();
    expect(mockFetchMyTravels).not.toHaveBeenCalled();
  });

  it('shows empty state when there are no travels', async () => {
    const queryClient = createQueryClient();
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      userId: '123',
    } as any);
    mockFetchMyTravels.mockResolvedValueOnce([] as any);

    const { findByText } = renderExport(queryClient);

    expect(
      await findByText('Чтобы собрать PDF‑книгу, добавьте хотя бы одно путешествие')
    ).toBeTruthy();
    expect(mockFetchMyTravels).toHaveBeenCalledWith({
      user_id: '123',
      includeDrafts: true,
      throwOnError: true,
    });
  });

  it('falls back to the list when count query fails', async () => {
    const queryClient = createQueryClient();
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      userId: '123',
    } as any);
    mockFetchMyTravels.mockRejectedValueOnce(new Error('boom'));

    const { getByTestId, queryByText } = renderExport(queryClient);

    await waitFor(() => {
      expect(getByTestId('list-travel')).toBeTruthy();
    });

    expect(
      queryByText('Чтобы собрать PDF‑книгу, добавьте хотя бы одно путешествие')
    ).toBeNull();
  });
});
