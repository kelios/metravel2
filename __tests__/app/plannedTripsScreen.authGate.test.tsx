import { fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();
let mockAuthState = { isAuthenticated: false };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) => selector(mockAuthState),
}));

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  useMyPlannedTrips: () => ({ data: [], isLoading: false, isError: false }),
}));

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    background: 'white',
    danger: 'red',
    primaryDark: 'darkgreen',
    primaryText: 'darkgreen',
    text: 'black',
    textSecondary: 'dimgray',
  }),
}));

jest.mock('@/components/trips/planning/TripPlanCard', () => {
  return function TripPlanCard() {
    const { Text } = require('react-native');
    return <Text testID="trip-plan-card" />;
  };
});

jest.mock('@/components/trips/planning/TripPlanningEmptyState', () => {
  return function TripPlanningEmptyState() {
    const { Text } = require('react-native');
    return <Text testID="trip-planning-empty-state" />;
  };
});

describe('PlannedTripsScreen auth gate', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockAuthState = { isAuthenticated: false };
  });

  it('uses inline login link instead of large login button for guests', () => {
    const PlannedTripsScreen = require('@/app/(tabs)/trips/plan/index').default;
    const { getByTestId, queryByTestId } = render(<PlannedTripsScreen />);

    expect(getByTestId('plan-login-link')).toBeTruthy();
    expect(queryByTestId('plan-login')).toBeNull();

    fireEvent.press(getByTestId('plan-login-link'));
    expect(mockPush).toHaveBeenCalledWith('/login?redirect=%2Ftrips%2Fplan');
  });
});
