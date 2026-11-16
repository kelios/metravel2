import { fireEvent, render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { trackTripPlannerForm } from '@/utils/tripPlannerAnalytics';

import MyTripsDashboard from '@/components/trips/MyTripsDashboard';

const mockPush = jest.fn();
const mockAnalytics = jest.fn();
jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: (...args: unknown[]) => mockAnalytics(...args) }));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (cb: () => void | (() => void)) => {
    const React = require('react');
    React.useEffect(() => cb(), [cb]);
  },
}));

jest.mock('@expo/vector-icons/Feather', () => 'Feather');

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () =>
    new Proxy({}, { get: (_target, key) => String(key) }) as unknown as Record<string, string>,
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false }),
  useBreakpoints: () => ({ width: 1280 }),
}));

let mockPlannedTripsState: { data?: unknown; isLoading: boolean } = {
  data: [{ id: 1, isOwner: true }, { id: 2, isOwner: false }],
  isLoading: false,
};
const mockUseTripNotifications = jest.fn();
// «Устоялся ли запрос под авторизацией» проверяет свой unit-тест; здесь — по состоянию запроса.
jest.mock('@/hooks/useAuthedQuerySettled', () => ({
  useAuthedQuerySettled: (query: { isPending?: boolean; isLoading?: boolean }) =>
    !(query.isPending ?? query.isLoading ?? false),
}));

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  useMyPlannedTrips: () => mockPlannedTripsState,
}));

jest.mock('@/hooks/usePublicTripsApi', () => ({
  useMyTripApplications: () => ({ data: [{ id: 10 }, { id: 11 }], isLoading: false }),
  useTripNotifications: () => mockUseTripNotifications(),
}));

jest.mock('@/components/trips/MyCreatedTripsList', () => {
  const { Text } = require('react-native');
  return function MockMyCreatedTripsList({ role }: { role: string }) {
    return <Text testID={`my-trips-list-${role}`}>{role}</Text>;
  };
});

jest.mock('@/components/trips/MyApplicationsList', () => {
  const { Text } = require('react-native');
  return function MockMyApplicationsList() {
    return <Text testID="my-trips-applications-list">applications</Text>;
  };
});

jest.mock('@/components/trips/TripNotificationsList', () => {
  const { Text } = require('react-native');
  return function MockTripNotificationsList() {
    return <Text testID="my-trips-notifications-list">notifications</Text>;
  };
});

describe('MyTripsDashboard', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockUseTripNotifications.mockClear();
  });

  it('opens with organizer trips and switches roles without mixing their lists', async () => {
    const { getByTestId, queryByTestId } = await render(<MyTripsDashboard />);

    expect(getByTestId('my-trips-list-organized')).toBeTruthy();
    expect(queryByTestId('my-trips-list-participating')).toBeNull();

    await fireEvent.press(getByTestId('my-trips-segment-participating'));
    expect(getByTestId('my-trips-list-participating')).toBeTruthy();
    expect(queryByTestId('my-trips-list-organized')).toBeNull();

    await fireEvent.press(getByTestId('my-trips-segment-applications'));
    expect(getByTestId('my-trips-applications-list')).toBeTruthy();
    expect(queryByTestId('my-trips-updates')).toBeNull();
  });

  it('exposes explicit organize and find actions', async () => {
    const { getByTestId } = await render(<MyTripsDashboard />);

    await fireEvent.press(getByTestId('my-trips-plan-cta'));
    await fireEvent.press(getByTestId('my-trips-find-cta'));

    expect(mockPush).toHaveBeenNthCalledWith(1, '/trips/plan/create?planner_source=navigation');
    expect(mockPush).toHaveBeenNthCalledWith(2, '/trips');
  });

  it('keeps navigation attribution while authentication restores without recording an early guest entry', async () => {
    const originalOs = Platform.OS;
    const previousAuth = useAuthStore.getState();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    useAuthStore.setState({ isAuthenticated: false, authReady: false });
    mockAnalytics.mockClear();
    try {
      const { getByTestId } = await render(<MyTripsDashboard />);
      await fireEvent.press(getByTestId('my-trips-plan-cta'));
      const href = String(mockPush.mock.calls[0][0]);
      expect(href).toBe('/trips/plan/create?planner_source=navigation');
      expect(mockAnalytics).not.toHaveBeenCalled();
      trackTripPlannerForm(href, true, true);
      expect(mockAnalytics.mock.calls.find(([name]) => name === 'trip_planner_entry')?.[1])
        .toMatchObject({ source: 'navigation', auth_state: 'authenticated', outcome: 'opened' });
    } finally {
      useAuthStore.setState(previousAuth);
      Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOs });
    }
  });

  // #2114: блок «Обновления» не стоит над скелетоном списка — монтируется под
  // устоявшимся списком; запрос уведомлений стартует сразу. Счётчики держат слот.
  it('не монтирует «Обновления» и держит слот счётчика, пока список грузится', async () => {
    const prev = mockPlannedTripsState;
    mockPlannedTripsState = { data: undefined, isLoading: true };
    try {
      const { queryByTestId, getByTestId } = await render(<MyTripsDashboard />);
      expect(queryByTestId('my-trips-updates')).toBeNull();
      expect(mockUseTripNotifications).toHaveBeenCalled();
      expect(getByTestId('my-trips-segment-organized-count-pending', { includeHiddenElements: true })).toBeTruthy();
    } finally {
      mockPlannedTripsState = prev;
    }
  });

  it('после ответа списка «Обновления» на месте, а счётчики показаны, включая ноль', async () => {
    const prev = mockPlannedTripsState;
    mockPlannedTripsState = { data: [{ id: 1, isOwner: true }], isLoading: false };
    try {
      const { getByTestId, getByText, queryByTestId } = await render(<MyTripsDashboard />);
      expect(getByTestId('my-trips-updates')).toBeTruthy();
      expect(queryByTestId('my-trips-segment-organized-count-pending', { includeHiddenElements: true })).toBeNull();
      expect(getByText('(1)')).toBeTruthy();
      expect(getByText('(0)')).toBeTruthy();
    } finally {
      mockPlannedTripsState = prev;
    }
  });
});
