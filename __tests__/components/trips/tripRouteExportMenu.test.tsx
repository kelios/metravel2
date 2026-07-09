import { Platform } from 'react-native';
import { render } from '@testing-library/react-native';

import type { PlannedTrip } from '@/api/plannedTrips';
import TripRouteExportMenu, {
  shouldRenderTripRouteExportMenu,
} from '@/components/trips/planning/TripRouteExportMenu';

jest.mock('@/components/ui/Button', () => {
  return function Button({
    label,
    testID,
  }: {
    label: string;
    testID?: string;
  }) {
    const { Text, View } = require('react-native');
    return (
      <View testID={testID} accessibilityLabel={label}>
        <Text>{label}</Text>
      </View>
    );
  };
});

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    text: 'black',
    textMuted: 'gray',
  }),
}));

const originalOS = Platform.OS;

const setPlatformOS = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    get: () => os,
  });
};

const trip: PlannedTrip = {
  id: 853,
  slug: '853',
  title: 'Маршрут Android',
  description: '',
  startDate: '2026-07-11',
  startTime: '08:00',
  transport: 'car',
  visibility: 'public',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 1, name: 'Организатор', avatarUrl: null },
  route: [
    { id: '1', type: 'place', name: 'Старт', coordinates: [27.56, 53.9] },
    { id: '2', type: 'place', name: 'Финиш', coordinates: [27.6, 53.91] },
  ],
  routeSummary: null,
  participants: [],
  coverUrl: null,
  region: 'Минск',
  publishedToCommunity: false,
  report: null,
  isOwner: true,
  myRsvp: 'going',
  createdAt: '2026-07-01T10:00:00.000Z',
};

describe('TripRouteExportMenu', () => {
  afterEach(() => {
    setPlatformOS(originalOS);
  });

  it('does not render the broken navigator block on Android own-route constructor', () => {
    setPlatformOS('android');

    const { queryByTestId, queryByText } = render(<TripRouteExportMenu trip={trip} />);

    expect(shouldRenderTripRouteExportMenu('android')).toBe(false);
    expect(queryByTestId('trip-route-export')).toBeNull();
    expect(queryByText('Открыть в навигаторе')).toBeNull();
    expect(queryByText('Google Maps')).toBeNull();
    expect(queryByText('Apple Maps')).toBeNull();
    expect(queryByText('Garmin Connect')).toBeNull();
  });

  it('keeps the route export menu available outside Android', () => {
    setPlatformOS('web');

    const { getByTestId, getByText } = render(<TripRouteExportMenu trip={trip} />);

    expect(shouldRenderTripRouteExportMenu('web')).toBe(true);
    expect(shouldRenderTripRouteExportMenu('ios')).toBe(true);
    expect(getByTestId('trip-route-export')).toBeTruthy();
    expect(getByText('Открыть в навигаторе')).toBeTruthy();
    expect(getByText('Google Maps')).toBeTruthy();
    expect(getByText('Apple Maps')).toBeTruthy();
    expect(getByText('Garmin Connect')).toBeTruthy();
  });
});
