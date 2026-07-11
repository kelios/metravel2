import { fireEvent, render } from '@testing-library/react-native';

import MyTripsDashboard from '@/components/trips/MyTripsDashboard';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@expo/vector-icons/Feather', () => 'Feather');

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () =>
    new Proxy({}, { get: (_target, key) => String(key) }) as unknown as Record<string, string>,
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false }),
}));

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  useMyPlannedTrips: () => ({
    data: [{ id: 1, isOwner: true }, { id: 2, isOwner: false }],
  }),
}));

jest.mock('@/hooks/usePublicTripsApi', () => ({
  useMyTripApplications: () => ({ data: [{ id: 10 }, { id: 11 }] }),
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
  beforeEach(() => mockPush.mockClear());

  it('opens with organizer trips and switches roles without mixing their lists', () => {
    const { getByTestId, queryByTestId } = render(<MyTripsDashboard />);

    expect(getByTestId('my-trips-list-organized')).toBeTruthy();
    expect(queryByTestId('my-trips-list-participating')).toBeNull();

    fireEvent.press(getByTestId('my-trips-segment-participating'));
    expect(getByTestId('my-trips-list-participating')).toBeTruthy();
    expect(queryByTestId('my-trips-list-organized')).toBeNull();

    fireEvent.press(getByTestId('my-trips-segment-applications'));
    expect(getByTestId('my-trips-applications-list')).toBeTruthy();
    expect(queryByTestId('my-trips-updates')).toBeNull();
  });

  it('exposes explicit organize and find actions', () => {
    const { getByTestId } = render(<MyTripsDashboard />);

    fireEvent.press(getByTestId('my-trips-plan-cta'));
    fireEvent.press(getByTestId('my-trips-find-cta'));

    expect(mockPush).toHaveBeenNthCalledWith(1, '/trips/plan/create');
    expect(mockPush).toHaveBeenNthCalledWith(2, '/trips');
  });
});
