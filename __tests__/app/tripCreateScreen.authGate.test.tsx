import { fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockBuildTripPlanPrefill = jest.fn(() => ({ title: 'prefill' }));
let mockAuthState = { authReady: true, isAuthenticated: false };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ title: 'prefill' }),
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: typeof mockAuthState) => unknown) => selector(mockAuthState),
}));

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    background: 'white',
    primaryDark: 'darkgreen',
    primaryText: 'darkgreen',
    text: 'black',
    textSecondary: 'dimgray',
  }),
}));

jest.mock('@/utils/tripPlanLinks', () => ({
  buildTripPlanPrefill: (...args: unknown[]) => mockBuildTripPlanPrefill(...args),
}));

jest.mock('@/components/trips/planning/TripCreateForm', () => {
  return function TripCreateForm({ initialValues }: { initialValues?: { title?: string } }) {
    const { Text } = require('react-native');
    return <Text testID="trip-create-form">Trip form: {initialValues?.title}</Text>;
  };
});

describe('CreateTripScreen auth gate', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockBuildTripPlanPrefill.mockClear();
    mockAuthState = { authReady: true, isAuthenticated: false };
  });

  it('blocks direct trip creation route for guests', () => {
    const CreateTripScreen = require('@/app/(tabs)/trips/plan/create').default;
    const { getByTestId, queryByTestId } = render(<CreateTripScreen />);

    expect(getByTestId('trip-create-auth-gate')).toBeTruthy();
    expect(queryByTestId('trip-create-form')).toBeNull();

    fireEvent.press(getByTestId('trip-create-login-link'));
    expect(mockPush).toHaveBeenCalledWith('/login?redirect=%2Ftrips%2Fplan%2Fcreate&intent=plan-trip');
  });

  it('renders trip creation form for authenticated users', () => {
    mockAuthState = { authReady: true, isAuthenticated: true };

    const CreateTripScreen = require('@/app/(tabs)/trips/plan/create').default;
    const { getByTestId, queryByTestId } = render(<CreateTripScreen />);

    expect(queryByTestId('trip-create-auth-gate')).toBeNull();
    expect(getByTestId('trip-create-form')).toBeTruthy();
  });

  it('does not render form before auth state is ready', () => {
    mockAuthState = { authReady: false, isAuthenticated: false };

    const CreateTripScreen = require('@/app/(tabs)/trips/plan/create').default;
    const { getByTestId, queryByTestId } = render(<CreateTripScreen />);

    expect(getByTestId('trip-create-auth-loading')).toBeTruthy();
    expect(queryByTestId('trip-create-form')).toBeNull();
  });
});
