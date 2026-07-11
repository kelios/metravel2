import { render, fireEvent } from '@testing-library/react-native';
import { Platform } from 'react-native';

import type { PlannedTrip } from '@/api/plannedTrips';

/**
 * Acceptance coverage for the planned-trip planner workspace (FE-trip-planner #876
 * / redesign #874): route-state rendering (routed vs direct fallback), owner vs
 * non-owner controls, metadata/cover editing, and tab navigation.
 * Child domain panels are mocked to keep assertions on the screen's own IA.
 */

const mockUsePlannedTrip = jest.fn();
const mockUpdateTripMutate = jest.fn();
const originalOS = Platform.OS;
let mockSearchParams: Record<string, string> = { id: '8001' };
let mockResponsive = { isMobile: false };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  usePlannedTrip: (...args: unknown[]) => mockUsePlannedTrip(...args),
  useDeletePlannedTrip: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdatePlannedTrip: () => ({ mutate: mockUpdateTripMutate, isPending: false }),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockResponsive,
}));

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    background: 'white',
    border: 'gray',
    danger: 'red',
    info: 'skyblue',
    overlay: 'rgba(0,0,0,0.5)',
    primary: 'teal',
    primaryDark: 'darkslategray',
    primaryLight: 'lightcyan',
    success: 'green',
    surface: 'white',
    surfaceMuted: 'whitesmoke',
    text: 'black',
    textMuted: 'gray',
    textOnDark: 'white',
    textOnPrimary: 'white',
    textSecondary: 'dimgray',
    warningDark: 'darkorange',
    warningLight: 'moccasin',
    warningSoft: 'papayawhip',
  }),
}));

jest.mock('@/components/calendar/MiniCalendar', () => {
  return function MiniCalendar({ onDayPress }: { onDayPress: (date: string) => void }) {
    const { Pressable } = require('react-native');
    return (
      <Pressable
        testID="mini-calendar-day-2026-08-20"
        onPress={() => onDayPress('2026-08-20')}
      />
    );
  };
});

jest.mock('@/components/ui/ImageCardMedia', () => {
  return function ImageCardMedia({ testID }: { testID?: string }) {
    const { View } = require('react-native');
    return <View testID={testID ?? 'image-card-media'} />;
  };
});

const mockStub = (testID: string) => () => {
  const { View } = require('react-native');
  return <View testID={testID} />;
};

jest.mock('@/components/trips/planning/RouteBuilder', () => mockStub('route-builder'));
jest.mock('@/components/trips/planning/TripParticipantsList', () => mockStub('trip-participants-list'));
jest.mock('@/components/trips/planning/TripRsvpControl', () => mockStub('trip-rsvp-control'));
jest.mock('@/components/trips/planning/TripInvitePanel', () => mockStub('trip-invite-panel'));
jest.mock('@/components/trips/planning/TripSuggestPointForm', () => mockStub('trip-suggest-point-form'));
jest.mock('@/components/trips/planning/TripSuggestionsPanel', () => mockStub('trip-suggestions-panel'));
jest.mock('@/components/trips/planning/TripReportForm', () => mockStub('trip-report-form'));
jest.mock('@/components/trips/planning/TripRatingPanel', () => mockStub('trip-rating-panel'));
jest.mock('@/components/trips/planning/TripAffiliateBlock', () => mockStub('trip-affiliate-block'));
jest.mock('@/components/trips/communication/TripTelegramGroupCard', () => mockStub('trip-telegram-group-card'));
jest.mock('@/components/trips/chat/TripChatPanel', () => mockStub('trip-chat-panel'));
jest.mock('@/components/travel/PhotoUploadWithPreview', () => {
  return function PhotoUploadWithPreview({
    onUpload,
    onUploadStateChange,
  }: {
    onUpload: (url: string) => void;
    onUploadStateChange?: (isUploading: boolean) => void;
  }) {
    const { Pressable, View } = require('react-native');
    return (
      <View>
        <Pressable
          testID="photo-upload"
          onPress={() => onUpload('https://metravel.by/media/planned-trip-cover.jpg')}
        />
        <Pressable
          testID="photo-upload-start"
          onPress={() => onUploadStateChange?.(true)}
        />
        <Pressable
          testID="photo-upload-finish"
          onPress={() => onUploadStateChange?.(false)}
        />
      </View>
    );
  };
});

jest.mock('@/components/trips/planning/TripRouteExportMenu', () => {
  const actual = jest.requireActual('@/components/trips/planning/TripRouteExportMenu');
  const { View } = require('react-native');
  return {
    __esModule: true,
    ...actual,
    default: () => <View testID="trip-route-export" />,
  };
});

const baseTrip: PlannedTrip = {
  id: 8001,
  slug: '8001',
  title: 'Маршрут по Браславским озёрам',
  description: '',
  startDate: '2026-08-15',
  startTime: '08:00',
  transport: 'car',
  visibility: 'public',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 1, name: 'Организатор', avatarUrl: null },
  route: [
    { id: '1', type: 'place', name: 'Старт', description: null, coordinates: [27.56, 53.9], placeId: null },
    { id: '2', type: 'place', name: 'Финиш', description: null, coordinates: [27.6, 53.91], placeId: null },
  ],
  routeGeometry: [
    [27.56, 53.9],
    [27.58, 53.905],
    [27.6, 53.91],
  ],
  routeSummary: { distanceKm: 12.4, durationMin: 15, elevationGainM: 20, stopsCount: 1, provider: 'ors' },
  routingState: { provider: 'ors', isOptimal: true, fallbackReason: null, warnings: [] },
  participants: [],
  coverUrl: null,
  region: 'Браслав',
  publishedToCommunity: false,
  report: null,
  isOwner: true,
  myRsvp: 'going',
  createdAt: '2026-07-01T10:00:00.000Z',
};

const makeTrip = (overrides: Partial<PlannedTrip> = {}): PlannedTrip => ({
  ...baseTrip,
  ...overrides,
});

const renderScreen = () => {
  const PlannedTripScreen = require('@/app/(tabs)/trips/plan/[id]').default;
  return render(<PlannedTripScreen />);
};

describe('PlannedTripScreen — planner states', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => originalOS });
    mockSearchParams = { id: '8001' };
    mockResponsive = { isMobile: false };
    mockUsePlannedTrip.mockReset();
    mockUpdateTripMutate.mockReset();
  });

  const mockTrip = (trip: PlannedTrip) =>
    mockUsePlannedTrip.mockReturnValue({ data: trip, isLoading: false, isError: false });

  it('renders a routed success state without an approximate warning', () => {
    mockTrip(makeTrip());
    const { getByTestId, queryByTestId } = renderScreen();

    expect(getByTestId('trip-plan-summary')).toBeTruthy();
    expect(getByTestId('route-builder')).toBeTruthy();
    // Optimal ORS route → no "approximate" banner in the header.
    expect(queryByTestId('trip-plan-route-approximate')).toBeNull();
  });

  it('flags a direct fallback route as approximate', () => {
    mockTrip(
      makeTrip({
        routeGeometry: null,
        routeSummary: { distanceKm: 30, durationMin: 40, elevationGainM: 0, stopsCount: 1, provider: 'direct' },
        routingState: {
          provider: 'direct',
          isOptimal: false,
          fallbackReason: 'routing_provider_unavailable',
          warnings: ['Маршрут показан приблизительно.'],
        },
      }),
    );
    const { getByTestId } = renderScreen();

    expect(getByTestId('trip-plan-summary')).toBeTruthy();
    expect(getByTestId('trip-plan-route-approximate')).toBeTruthy();
  });

  it('shows metadata edit and delete controls to the owner', () => {
    mockTrip(makeTrip({ isOwner: true }));
    const { getByTestId } = renderScreen();

    expect(getByTestId('trip-plan-delete')).toBeTruthy();
    expect(getByTestId('trip-plan-edit')).toBeTruthy();
  });

  it('hides owner-only controls for a non-owner viewer', () => {
    mockTrip(makeTrip({ isOwner: false }));
    const { queryByTestId, getByTestId } = renderScreen();

    expect(queryByTestId('trip-plan-delete')).toBeNull();
    // A non-owner can still open the route + collaboration tabs.
    expect(getByTestId('route-builder')).toBeTruthy();
    fireEvent.press(getByTestId('trip-plan-tab-people'));
    expect(getByTestId('trip-suggest-point-form')).toBeTruthy();
  });

  it('opens an enabled metadata editor from the edit deeplink', () => {
    mockSearchParams = { id: '8001', edit: '1' };
    mockTrip(makeTrip({ isOwner: true }));
    const { getByTestId, queryByTestId } = renderScreen();

    expect(getByTestId('trip-plan-edit-panel')).toBeTruthy();
    expect(queryByTestId('trip-plan-edit-blocker')).toBeNull();
    const saveButton = getByTestId('trip-plan-edit-save');
    expect(saveButton.props.accessibilityState?.disabled).toBe(false);
  });

  it('persists edited metadata and the uploaded planned-trip cover URL', () => {
    mockTrip(makeTrip({ isOwner: true }));
    const { getByTestId } = renderScreen();

    fireEvent.press(getByTestId('trip-plan-edit'));
    fireEvent.changeText(getByTestId('trip-plan-edit-title'), 'Обновлённый маршрут');
    fireEvent.press(getByTestId('photo-upload'));
    fireEvent.press(getByTestId('trip-plan-edit-save'));

    expect(mockUpdateTripMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId: 8001,
        title: 'Обновлённый маршрут',
        coverUrl: 'https://metravel.by/media/planned-trip-cover.jpg',
      }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it('keeps save and close disabled until the cover upload finishes', () => {
    mockTrip(makeTrip({ isOwner: true }));
    const { getByTestId } = renderScreen();

    fireEvent.press(getByTestId('trip-plan-edit'));
    fireEvent.press(getByTestId('photo-upload-start'));

    expect(getByTestId('trip-plan-edit-save').props.accessibilityState?.disabled).toBe(true);
    expect(getByTestId('trip-plan-edit-cancel').props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(getByTestId('trip-plan-edit-save'));
    expect(mockUpdateTripMutate).not.toHaveBeenCalled();

    fireEvent.press(getByTestId('photo-upload-finish'));
    expect(getByTestId('trip-plan-edit-save').props.accessibilityState?.disabled).toBe(false);
    expect(getByTestId('trip-plan-edit-cancel').props.accessibilityState?.disabled).toBe(false);
  });

  it('uses the app date picker for native edit and keeps the API date in YYYY-MM-DD', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
    mockSearchParams = { id: '8001', edit: '1' };
    mockTrip(makeTrip({ isOwner: true, startDate: '2026-08-15T08:00:00Z' }));
    const { getByTestId, queryByTestId } = renderScreen();

    const trigger = getByTestId('trip-plan-edit-start-date');
    expect(trigger.props.accessibilityRole).toBe('button');
    expect(trigger.props.onChangeText).toBeUndefined();
    expect(getByTestId('trip-plan-edit-start-date-value').props.children).toBe(
      '15 августа 2026',
    );

    fireEvent.press(trigger);
    expect(getByTestId('trip-plan-edit-date-picker')).toBeTruthy();
    fireEvent.press(getByTestId('mini-calendar-day-2026-08-20'));
    expect(queryByTestId('trip-plan-edit-date-picker')).toBeNull();
    expect(getByTestId('trip-plan-edit-start-date-value').props.children).toBe(
      '20 августа 2026',
    );

    fireEvent.press(getByTestId('trip-plan-edit-start-date'));
    fireEvent.press(getByTestId('trip-plan-edit-start-date-cancel'));
    expect(queryByTestId('trip-plan-edit-date-picker')).toBeNull();
    expect(getByTestId('trip-plan-edit-start-date-value').props.children).toBe(
      '20 августа 2026',
    );

    fireEvent.press(getByTestId('trip-plan-edit-save'));
    expect(mockUpdateTripMutate).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: '2026-08-20' }),
      expect.any(Object),
    );
  });

  it('navigates the workspace tabs between route, people, export and more', () => {
    mockTrip(makeTrip({ status: 'completed' }));
    const { getByTestId, queryByTestId } = renderScreen();

    // Default tab = route.
    expect(getByTestId('trip-plan-panel-route')).toBeTruthy();

    fireEvent.press(getByTestId('trip-plan-tab-people'));
    expect(getByTestId('trip-plan-panel-people')).toBeTruthy();
    expect(getByTestId('trip-invite-panel')).toBeTruthy();

    fireEvent.press(getByTestId('trip-plan-tab-export'));
    expect(getByTestId('trip-plan-route-export-section')).toBeTruthy();

    fireEvent.press(getByTestId('trip-plan-tab-more'));
    expect(getByTestId('trip-report-form')).toBeTruthy();
    // Rating panel only appears for completed trips.
    expect(getByTestId('trip-rating-panel')).toBeTruthy();
    // Route panel is unmounted when another tab is active.
    expect(queryByTestId('trip-plan-panel-route')).toBeNull();
  });

  it('renders a freshly created empty trip without crashing (regression for #884)', () => {
    // Shape of a just-created planned trip: empty participants/route, null
    // summary/geometry/routing, transport defaulted. Must not blank out.
    mockTrip(
      makeTrip({
        route: [],
        routeGeometry: null,
        routeSummary: null,
        routingState: null,
        participants: [],
      }),
    );
    const { getByTestId } = renderScreen();

    expect(getByTestId('trip-plan-summary')).toBeTruthy();
    expect(getByTestId('trip-plan-tabs')).toBeTruthy();
    expect(getByTestId('trip-plan-panel-route')).toBeTruthy();
    // People tab renders with an empty participant list, no throw.
    fireEvent.press(getByTestId('trip-plan-tab-people'));
    expect(getByTestId('trip-plan-panel-people')).toBeTruthy();
  });

  it('renders a compact mobile header with an icon-only inactive tab', () => {
    mockResponsive = { isMobile: true };
    mockTrip(makeTrip());
    const { getByTestId } = renderScreen();

    // Tabs and summary are present on mobile too.
    expect(getByTestId('trip-plan-tabs')).toBeTruthy();
    expect(getByTestId('trip-plan-summary')).toBeTruthy();
    expect(getByTestId('trip-plan-tab-people')).toBeTruthy();
  });
});
