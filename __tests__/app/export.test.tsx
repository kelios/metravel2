import { render, waitFor } from '@testing-library/react-native';
import { mockUseRouter, resetExpoRouterMocks } from '../helpers/expoRouterMock';
import { createQueryWrapper } from '../helpers/testQueryClient';
import {
  mockFetchMyTravels,
  mockUnwrapMyTravelsPayload,
  resetTravelsApiMocks,
} from '../helpers/mockTravelsApi';
import ExportScreen from '@/app/(tabs)/export';
import { useAuth } from '@/context/AuthContext';
import { useIsFocused } from '@react-navigation/native';

jest.mock('@/context/AuthContext');

jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn(),
}));

jest.mock('expo-router', () => ({
  usePathname: () => '/export',
  useRouter: mockUseRouter,
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
  fetchMyTravels: mockFetchMyTravels,
  unwrapMyTravelsPayload: mockUnwrapMyTravelsPayload,
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseIsFocused = useIsFocused as jest.MockedFunction<typeof useIsFocused>;

describe('ExportScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetExpoRouterMocks();
    resetTravelsApiMocks();
    mockUseIsFocused.mockReturnValue(true);
  });

  it('shows login empty state for unauthenticated users', () => {
    const { Wrapper } = createQueryWrapper();
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      userId: null,
    } as any);

    const { getByText } = render(<ExportScreen />, { wrapper: Wrapper });

    expect(getByText('Войдите, чтобы собрать PDF‑книгу')).toBeTruthy();
    expect(mockFetchMyTravels).not.toHaveBeenCalled();
  });

  it('does not show empty state until userId is available', () => {
    const { Wrapper } = createQueryWrapper();
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      userId: null,
    } as any);

    const { queryByText, getByText } = render(<ExportScreen />, { wrapper: Wrapper });

    // Пока userId нет — показываем загрузку и не показываем empty state
    expect(getByText('Загрузка...')).toBeTruthy();
    expect(
      queryByText('Чтобы собрать PDF‑книгу, добавьте хотя бы одно путешествие')
    ).toBeNull();
    expect(mockFetchMyTravels).not.toHaveBeenCalled();
  });

  it('shows empty state when there are no travels', async () => {
    const { Wrapper } = createQueryWrapper();
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      userId: '123',
    } as any);
    mockFetchMyTravels.mockResolvedValueOnce([] as any);

    const { findByText } = render(<ExportScreen />, { wrapper: Wrapper });

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
    const { Wrapper } = createQueryWrapper();
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      userId: '123',
    } as any);
    mockFetchMyTravels.mockRejectedValueOnce(new Error('boom'));

    const { getByTestId, queryByText } = render(<ExportScreen />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(getByTestId('list-travel')).toBeTruthy();
    });

    expect(
      queryByText('Чтобы собрать PDF‑книгу, добавьте хотя бы одно путешествие')
    ).toBeNull();
  });
});
