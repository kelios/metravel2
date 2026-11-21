import { fireEvent, render } from '@testing-library/react-native';
import { Platform } from 'react-native';

const mockPush = jest.fn();
const mockAnalytics = jest.fn();
let mockSearchParams: Record<string, string> = { title: 'prefill' };
const mockBuildTripPlanPrefill = jest.fn(() => ({ title: 'prefill' }));
let mockAuthState = { authReady: true, isAuthenticated: false };

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => require('react').useEffect(cb, [cb]),
  useLocalSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));
jest.mock('@/utils/analytics', () => ({ sendAnalyticsEvent: (...args: unknown[]) => mockAnalytics(...args) }));
jest.mock('@/utils/consent', () => ({ readConsent: () => ({ analytics: true }) }));
jest.mock('@/components/trips/TripsPageSeo', () => () => null);

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

// Подменяется только построитель предзаполнения: `utils/tripPlanDraftIntake` берёт из этого же
// модуля `firstParam`, `clip` и константы (#3431, В1), поэтому остальные экспорты — настоящие.
jest.mock('@/utils/tripPlanLinks', () => ({
  ...jest.requireActual('@/utils/tripPlanLinks'),
  buildTripPlanPrefill: (...args: unknown[]) => mockBuildTripPlanPrefill(...args),
}));

jest.mock('@/components/trips/planning/TripCreateForm', () => {
  return function TripCreateForm({ initialValues }: { initialValues?: { title?: string } }) {
    const { Text } = require('react-native');
    return <Text testID="trip-create-form">Trip form: {initialValues?.title}</Text>;
  };
});

describe('CreateTripScreen auth gate', () => {
  const originalOs = Platform.OS;
  beforeEach(() => {
    mockPush.mockClear();
    mockAnalytics.mockClear();
    mockSearchParams = { title: 'prefill' };
    window.sessionStorage.clear();
    mockBuildTripPlanPrefill.mockClear();
    mockAuthState = { authReady: true, isAuthenticated: false };
  });
  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOs });
  });

  it('blocks direct trip creation route for guests', async () => {
    const CreateTripScreen = require('@/app/(tabs)/trips/plan/create').default;
    const { getByTestId, queryByTestId } = await render(<CreateTripScreen />);

    expect(getByTestId('trip-create-auth-gate')).toBeTruthy();
    expect(queryByTestId('trip-create-form')).toBeNull();

    await fireEvent.press(getByTestId('trip-create-login-link'));
    // #2898: на устройстве без входа гостевое действие открывает регистрацию.
    expect(mockPush).toHaveBeenCalledWith('/registration?redirect=%2Ftrips%2Fplan%2Fcreate%3Ftitle%3Dprefill&intent=plan-trip');
  });

  it('renders trip creation form for authenticated users', async () => {
    mockAuthState = { authReady: true, isAuthenticated: true };

    const CreateTripScreen = require('@/app/(tabs)/trips/plan/create').default;
    const { getByTestId, queryByTestId } = await render(<CreateTripScreen />);

    expect(queryByTestId('trip-create-auth-gate')).toBeNull();
    expect(getByTestId('trip-create-form')).toBeTruthy();
  });

  it('does not render form before auth state is ready', async () => {
    mockAuthState = { authReady: false, isAuthenticated: false };

    const CreateTripScreen = require('@/app/(tabs)/trips/plan/create').default;
    const { getByTestId, queryByTestId } = await render(<CreateTripScreen />);

    expect(getByTestId('trip-create-auth-loading')).toBeTruthy();
    expect(queryByTestId('trip-create-form')).toBeNull();
  });

  it.each(['direct', 'expired'])('reuses a local %s journey after guest login without writing identifiers to the URL', async (entry) => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    mockSearchParams = { title: `prefill-${entry}` };
    const href = `/trips/plan/create?title=prefill-${entry}`;
    if (entry === 'expired') {
      const { beginTripPlannerEntry } = require('@/utils/tripPlannerAnalytics');
      const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
      beginTripPlannerEntry(href, false);
      now.mockReturnValue(1000 + 31 * 60 * 1000);
      mockAnalytics.mockClear();
    }
    const CreateTripScreen = require('@/app/(tabs)/trips/plan/create').default;
    const first = await render(<CreateTripScreen />);
    await fireEvent.press(first.getByTestId('trip-create-login-link'));
    expect(new URLSearchParams(String(mockPush.mock.calls[0][0]).split('?')[1]).get('redirect')).toBe(href);
    expect(mockSearchParams).toEqual({ title: `prefill-${entry}` });
    await first.unmount();
    mockAuthState = { authReady: true, isAuthenticated: true };
    await render(<CreateTripScreen />);
    expect(mockAnalytics.mock.calls.filter(([name]) => name === 'trip_planner_entry')).toHaveLength(1);
    expect(mockAnalytics.mock.calls.filter(([name]) => name === 'trip_planner_form_view').map(([, params]) => [params.auth_state, params.outcome]))
      .toEqual([['guest', 'auth_required'], ['guest', 'ready']]);
  });
});
