import { Platform } from 'react-native';
import { render } from '@testing-library/react-native';

import type { PlannedTrip } from '@/api/plannedTrips';

const mockUsePlannedTrip = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '853' }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  usePlannedTrip: (...args: unknown[]) => mockUsePlannedTrip(...args),
  useDeletePlannedTrip: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdatePlannedTrip: () => ({ mutate: jest.fn(), isPending: false }),
}));

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    background: 'white',
    border: 'gray',
    danger: 'red',
    surfaceMuted: 'whitesmoke',
    text: 'black',
    textMuted: 'gray',
    textOnDark: 'white',
    textSecondary: 'gray',
    warningDark: 'darkorange',
    warningLight: 'moccasin',
    warningSoft: 'papayawhip',
  }),
}));

jest.mock('@/components/ui/ImageCardMedia', () => {
  return function ImageCardMedia({ testID }: { testID?: string }) {
    const { View } = require('react-native');
    return <View testID={testID ?? 'image-card-media'} />;
  };
});

jest.mock('@/components/trips/planning/RouteBuilder', () => {
  return function RouteBuilder() {
    const { View } = require('react-native');
    return <View testID="route-builder" />;
  };
});

jest.mock('@/components/trips/planning/TripRouteExportMenu', () => {
  const actual = jest.requireActual('@/components/trips/planning/TripRouteExportMenu');
  return {
    __esModule: true,
    ...actual,
    default: function TripRouteExportMenu() {
      const { View } = require('react-native');
      return <View testID="trip-route-export" />;
    },
  };
});

jest.mock('@/components/trips/planning/TripParticipantsList', () => {
  return function TripParticipantsList() {
    const { View } = require('react-native');
    return <View testID="trip-participants-list" />;
  };
});

jest.mock('@/components/trips/planning/TripRsvpControl', () => {
  return function TripRsvpControl() {
    const { View } = require('react-native');
    return <View testID="trip-rsvp-control" />;
  };
});

jest.mock('@/components/trips/planning/TripInvitePanel', () => {
  return function TripInvitePanel() {
    const { View } = require('react-native');
    return <View testID="trip-invite-panel" />;
  };
});

jest.mock('@/components/trips/planning/TripSuggestPointForm', () => {
  return function TripSuggestPointForm() {
    const { View } = require('react-native');
    return <View testID="trip-suggest-point-form" />;
  };
});

jest.mock('@/components/trips/planning/TripSuggestionsPanel', () => {
  return function TripSuggestionsPanel() {
    const { View } = require('react-native');
    return <View testID="trip-suggestions-panel" />;
  };
});

jest.mock('@/components/trips/planning/TripReportForm', () => {
  return function TripReportForm() {
    const { View } = require('react-native');
    return <View testID="trip-report-form" />;
  };
});

jest.mock('@/components/trips/planning/TripRatingPanel', () => {
  return function TripRatingPanel() {
    const { View } = require('react-native');
    return <View testID="trip-rating-panel" />;
  };
});

jest.mock('@/components/trips/planning/TripAffiliateBlock', () => {
  return function TripAffiliateBlock() {
    const { View } = require('react-native');
    return <View testID="trip-affiliate-block" />;
  };
});

jest.mock('@/components/trips/communication/TripTelegramGroupCard', () => {
  return function TripTelegramGroupCard() {
    const { View } = require('react-native');
    return <View testID="trip-telegram-group-card" />;
  };
});

jest.mock('@/components/trips/chat/TripChatPanel', () => {
  return function TripChatPanel() {
    const { View } = require('react-native');
    return <View testID="trip-chat-panel" />;
  };
});

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

describe('PlannedTripScreen route export section', () => {
  beforeEach(() => {
    mockUsePlannedTrip.mockReturnValue({
      data: trip,
      isLoading: false,
      isError: false,
    });
  });

  afterEach(() => {
    setPlatformOS(originalOS);
    mockUsePlannedTrip.mockReset();
  });

  it('keeps the route export section on Android with supported actions', () => {
    setPlatformOS('android');

    const PlannedTripScreen = require('@/app/(tabs)/trips/plan/[id]').default;
    const { queryByTestId, getByTestId } = render(<PlannedTripScreen />);

    expect(getByTestId('route-builder')).toBeTruthy();
    expect(getByTestId('trip-plan-route-export-section')).toBeTruthy();
    expect(queryByTestId('trip-route-export')).toBeTruthy();
  });

  it('keeps the route export section outside Android', () => {
    setPlatformOS('web');

    const PlannedTripScreen = require('@/app/(tabs)/trips/plan/[id]').default;
    const { getByTestId } = render(<PlannedTripScreen />);

    expect(getByTestId('trip-plan-route-export-section')).toBeTruthy();
    expect(getByTestId('trip-route-export')).toBeTruthy();
  });
});
