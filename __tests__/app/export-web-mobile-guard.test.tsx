import { render } from '@testing-library/react-native';
import { mockUseRouter, resetExpoRouterMocks } from '../helpers/expoRouterMock';
import { createQueryWrapper } from '../helpers/testQueryClient';
import {
  mockFetchMyTravels,
  mockUnwrapMyTravelsPayload,
  resetTravelsApiMocks,
} from '../helpers/mockTravelsApi';
import { createAuthValue } from '../helpers/mockContextValues';
// Явно грузим web-вариант экрана: jest по RN-пресету резолвит export.native.tsx,
// а гейт «PDF только на десктопе» живёт в web-файле export.tsx.
import ExportScreen from '@/app/(tabs)/export.tsx';
import { useAuth } from '@/context/AuthContext';
import { useIsFocused } from 'expo-router';

jest.mock('@/context/AuthContext');

let mockResponsive = { isMobile: false, isHydrated: true };
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockResponsive,
}));

jest.mock('expo-router', () => ({
  usePathname: () => '/export',
  useRouter: mockUseRouter,
  useIsFocused: jest.fn(),
}));

jest.mock('@/utils/analytics', () => ({
  sendAnalyticsEvent: jest.fn(),
}));

jest.mock('@/components/seo/LazyInstantSEO', () => {
  return () => null;
});

jest.mock('@/components/listTravel/ListTravelBase', () => {
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
  Feather: ({ name, ...props }: { name: string; [key: string]: unknown }) => {
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

describe('ExportScreen (web) — PDF-экспорт скрыт в мобильной версии сайта', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetExpoRouterMocks();
    resetTravelsApiMocks();
    mockUseIsFocused.mockReturnValue(true);
    mockResponsive = { isMobile: false, isHydrated: true };
  });

  it('на мобильном показывает заглушку «только на компьютере» вместо контролов', () => {
    const { Wrapper } = createQueryWrapper();
    mockResponsive = { isMobile: true, isHydrated: true };
    mockUseAuth.mockReturnValue(createAuthValue({ isAuthenticated: true, userId: '123' }));

    const { getByText, queryByTestId } = render(<ExportScreen />, { wrapper: Wrapper });

    expect(getByText(/PDF.*книга доступна только на компьютере/)).toBeTruthy();
    // Контролы экспорта (список путешествий) на мобильном не монтируются.
    expect(queryByTestId('list-travel')).toBeNull();
  });

  it('на десктопе показывает контролы экспорта (без изменений)', async () => {
    const { Wrapper } = createQueryWrapper();
    mockResponsive = { isMobile: false, isHydrated: true };
    mockUseAuth.mockReturnValue(createAuthValue({ isAuthenticated: true, userId: '123' }));
    // Ошибка count-запроса → shouldShowEmptyState=false → рендерятся контролы списка.
    mockFetchMyTravels.mockRejectedValueOnce(new Error('boom'));

    // ListTravelBase на web грузится через lazy() → ждём резолва Suspense.
    const { findByTestId, queryByText } = render(<ExportScreen />, { wrapper: Wrapper });

    expect(await findByTestId('list-travel')).toBeTruthy();
    expect(queryByText(/PDF.*книга доступна только на компьютере/)).toBeNull();
  });

  it('до гидрации не показывает заглушку (нет desktop-мигания)', () => {
    const { Wrapper } = createQueryWrapper();
    mockResponsive = { isMobile: true, isHydrated: false };
    mockUseAuth.mockReturnValue(createAuthValue({ isAuthenticated: false, userId: null }));

    const { queryByText, getByText } = render(<ExportScreen />, { wrapper: Wrapper });

    expect(queryByText(/PDF.*книга доступна только на компьютере/)).toBeNull();
    expect(getByText(/Войдите.*PDF.*книгу/)).toBeTruthy();
  });
});
