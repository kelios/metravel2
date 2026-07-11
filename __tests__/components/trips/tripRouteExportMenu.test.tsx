import { Platform } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { PlannedTrip } from '@/api/plannedTrips';
import TripRouteExportMenu, {
  buildTripRouteExportInput,
  shouldRenderTripRouteExportMenu,
} from '@/components/trips/planning/TripRouteExportMenu';

const mockSaveRouteExportFile = jest.fn();
const mockOpenExternalUrl = jest.fn();

jest.mock('@/utils/routeExport', () => {
  const actual = jest.requireActual('@/utils/routeExport');
  return {
    ...actual,
    saveRouteExportFile: (...args: unknown[]) => mockSaveRouteExportFile(...args),
  };
});

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
}));

jest.mock('@/utils/tripAnalytics', () => ({
  trackRouteExported: jest.fn(),
}));

jest.mock('@/components/ui/Button', () => {
  return function Button({
    label,
    onPress,
    disabled,
    loading,
    testID,
  }: {
    label: string;
    onPress?: () => void;
    disabled?: boolean;
    loading?: boolean;
    testID?: string;
  }) {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable
        testID={testID}
        accessibilityLabel={label}
        accessibilityState={{ disabled: Boolean(disabled || loading) }}
        disabled={disabled || loading}
        onPress={onPress}
      >
        <Text>{label}</Text>
      </Pressable>
    );
  };
});

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    danger: 'red',
    text: 'black',
    textMuted: 'gray',
    warningDark: 'darkorange',
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
  routeGeometry: null,
  routeSummary: null,
  routingState: null,
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
  beforeEach(() => {
    jest.clearAllMocks();
    mockSaveRouteExportFile.mockResolvedValue(true);
    mockOpenExternalUrl.mockResolvedValue(true);
  });

  afterEach(() => {
    setPlatformOS(originalOS);
  });

  it('keeps supported export and navigator actions visible on Android', () => {
    setPlatformOS('android');

    const { getByTestId, getByText } = render(<TripRouteExportMenu trip={trip} />);

    expect(shouldRenderTripRouteExportMenu('android')).toBe(true);
    expect(getByTestId('trip-route-export')).toBeTruthy();
    expect(getByText('Открыть в навигаторе')).toBeTruthy();
    expect(getByText('Google Maps')).toBeTruthy();
    expect(getByText('Apple Maps')).toBeTruthy();
    expect(getByText('Garmin Connect')).toBeTruthy();
    expect(getByText('Поделиться GPX')).toBeTruthy();
    expect(getByTestId('trip-route-export-native-import-hint')).toBeTruthy();
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
    expect(getByText('Скачать GPX')).toBeTruthy();
  });

  it('creates and shares a real GPX before opening Garmin import on Android', async () => {
    setPlatformOS('android');
    const { getByTestId } = render(<TripRouteExportMenu trip={trip} />);

    fireEvent.press(getByTestId('trip-route-export-garmin'));

    await waitFor(() => expect(mockSaveRouteExportFile).toHaveBeenCalledTimes(1));
    expect(mockSaveRouteExportFile.mock.calls[0][0]).toEqual(
      expect.objectContaining({ filename: expect.stringMatching(/\.gpx$/) }),
    );
    expect(mockOpenExternalUrl).toHaveBeenCalledWith(
      'https://connect.garmin.com/modern/import-data',
    );
    expect(mockSaveRouteExportFile.mock.invocationCallOrder[0]).toBeLessThan(
      mockOpenExternalUrl.mock.invocationCallOrder[0],
    );
  });

  it('does not open Komoot import when native GPX handoff fails', async () => {
    setPlatformOS('android');
    mockSaveRouteExportFile.mockResolvedValue(false);
    const { findByTestId, getByTestId } = render(<TripRouteExportMenu trip={trip} />);

    fireEvent.press(getByTestId('trip-route-export-komoot'));

    expect(await findByTestId('trip-route-export-error')).toBeTruthy();
    expect(mockOpenExternalUrl).not.toHaveBeenCalled();
  });

  it('builds GPX/KML input from routed geometry while keeping waypoints', () => {
    const routedTrip: PlannedTrip = {
      ...trip,
      routeGeometry: [
        [27.56, 53.9],
        [27.1, 53.55],
        [26.69, 53.22],
      ],
      routingState: { provider: 'ors', isOptimal: true, fallbackReason: null, warnings: [] },
    };

    const input = buildTripRouteExportInput(routedTrip);

    expect(input.track).toEqual(routedTrip.routeGeometry);
    expect(input.waypoints).toHaveLength(2);
  });

  it('labels direct fallback exports as approximate', () => {
    const directTrip: PlannedTrip = {
      ...trip,
      routingState: {
        provider: 'direct',
        isOptimal: false,
        fallbackReason: 'ors_http_404',
        warnings: [],
      },
    };

    const { getByTestId } = render(<TripRouteExportMenu trip={directTrip} />);
    const input = buildTripRouteExportInput(directTrip);

    expect(getByTestId('trip-route-export-approximate')).toBeTruthy();
    expect(input.description).toContain('приблизительный');
  });
});
