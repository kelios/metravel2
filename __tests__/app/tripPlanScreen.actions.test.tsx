import { act, render, fireEvent } from '@testing-library/react-native';
import { Platform } from 'react-native';

import type { PlannedTrip } from '@/api/plannedTrips';
import { useActiveScreenHeader, resetScreenHeaderForTests } from '@/components/layout/ScreenHeaderContext';

/**
 * #2101: действия экрана поездки. Телефон — правка иконкой в строке экрана и
 * «⋯» (экспорт, «Поделиться», красное «Удалить» последним, подтверждение);
 * полноширинных «Редактировать»/«Удалить» в теле нет. Desktop — кнопки с подписями.
 */

const mockUsePlannedTrip = jest.fn();
const mockUpdateTripMutate = jest.fn();
const mockDeleteMutate = jest.fn();
const mockTripsPageSeo = jest.fn(() => null);
const originalOS = Platform.OS;
let mockSearchParams: Record<string, string> = { id: '8001' };
let mockResponsive: { isMobile: boolean; isDesktop?: boolean; width?: number } = { isMobile: false };
let mockRouteBuilderDisplayState: {
  summary: PlannedTrip['routeSummary'];
  routingState: PlannedTrip['routingState'];
  routablePointCount: number;
} | null = null;

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void | (() => void)) => require('react').useEffect(cb, [cb]),
  useLocalSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  usePlannedTrip: (...args: unknown[]) => mockUsePlannedTrip(...args),
  useDeletePlannedTrip: () => ({ mutate: mockDeleteMutate, isPending: false }),
  useUpdatePlannedTrip: () => ({ mutate: mockUpdateTripMutate, isPending: false }),
  useTripRouteElevation: () => ({ data: null, isFetching: false }),
}));

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => mockResponsive,
}));

jest.mock('@/components/trips/TripsPageSeo', () => ({
  __esModule: true,
  default: (props: unknown) => mockTripsPageSeo(props),
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

jest.mock('@/components/trips/planning/RouteBuilder', () => {
  return function MockRouteBuilder({
    onDisplayStateChange,
  }: {
    onDisplayStateChange?: (state: NonNullable<typeof mockRouteBuilderDisplayState> | null) => void;
  }) {
    const { Pressable } = require('react-native');
    return (
      <Pressable
        testID="route-builder"
        onPress={() => {
          if (mockRouteBuilderDisplayState) {
            onDisplayStateChange?.(mockRouteBuilderDisplayState);
          }
        }}
      />
    );
  };
});
jest.mock('@/components/trips/planning/TripParticipantsList', () => mockStub('trip-participants-list'));
jest.mock('@/components/trips/planning/TripRsvpControl', () => mockStub('trip-rsvp-control'));
jest.mock('@/components/trips/planning/TripInvitePanel', () => mockStub('trip-invite-panel'));
jest.mock('@/components/trips/planning/TripSuggestPointForm', () => mockStub('trip-suggest-point-form'));
jest.mock('@/components/trips/planning/TripSuggestionsPanel', () => mockStub('trip-suggestions-panel'));
jest.mock('@/components/trips/planning/TripReportForm', () => mockStub('trip-report-form'));
jest.mock('@/components/trips/planning/TripRatingPanel', () => mockStub('trip-rating-panel'));
jest.mock('@/components/trips/planning/TripAffiliateBlock', () => mockStub('trip-affiliate-block'));
jest.mock('@/components/trips/planning/TripGearChecklist', () => mockStub('trip-gear-checklist'));
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
  endDate: null,
  startTime: '08:00',
  transport: 'car',
  bikeType: 'regular',
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


const PHONE = { isMobile: true, isPhone: true, isLargePhone: false, isHydrated: true, width: 390 };
const DESKTOP = { isMobile: false, isDesktop: true, isHydrated: true, width: 1280 };

const HeaderProbe = () => {
  const header = useActiveScreenHeader();
  const { Text } = require('react-native');
  return (
    <Text testID="header-probe">
      {JSON.stringify({
        title: header?.title ?? null,
        primary: header?.primaryAction?.label ?? null,
        overflow: (header?.overflow ?? []).map((o) => [o.key, o.label, Boolean(o.destructive)]),
      })}
    </Text>
  );
};

const renderScreen = () => {
  const PlannedTripScreen = require('@/app/(tabs)/trips/plan/[id]').default;
  return render(
    <>
      <HeaderProbe />
      <PlannedTripScreen />
    </>,
  );
};

const probe = (getByTestId: (id: string) => any) => JSON.parse(getByTestId('header-probe').props.children);

describe('PlannedTripScreen — действия экрана (#2101)', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => originalOS });
    mockSearchParams = { id: '8001' };
    mockResponsive = DESKTOP;
    mockUsePlannedTrip.mockReset();
    mockUpdateTripMutate.mockReset();
    mockRouteBuilderDisplayState = null;
    resetScreenHeaderForTests();
  });
  const mockTrip = (trip: PlannedTrip) =>
    mockUsePlannedTrip.mockReturnValue({ data: trip, isLoading: false, isError: false });

  it('телефон: правка — иконка в строке экрана, в теле нет кнопок «Редактировать»/«Удалить»', () => {
    mockResponsive = PHONE;
    mockTrip(makeTrip({ isOwner: true }));
    const { getByTestId, queryByTestId } = renderScreen();

    expect(queryByTestId('trip-plan-edit')).toBeNull();
    expect(queryByTestId('trip-plan-delete')).toBeNull();
    const header = probe(getByTestId);
    expect(header.title).toBe('Маршрут по Браславским озёрам');
    expect(header.primary).toBe('Редактировать поездку');
  });

  it('телефон: «⋯» — экспорт, «Поделиться», красное «Удалить поездку» последним; печать на native скрыта', () => {
    mockResponsive = PHONE;
    mockTrip(makeTrip({ isOwner: true }));
    const { getByTestId } = renderScreen();

    expect(probe(getByTestId).overflow).toEqual([
      ['export', 'Экспорт GPX / KML', false],
      ['share', 'Поделиться', false],
      ['delete', 'Удалить поездку', true],
    ]);
  });

  it('телефон на web: «Распечатать план» первым пунктом «⋯»', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'web' });
    mockResponsive = PHONE;
    mockTrip(makeTrip({ isOwner: true }));
    const { getByTestId } = renderScreen();

    expect(probe(getByTestId).overflow.map((o: unknown[]) => o[0])).toEqual(['print', 'export', 'share', 'delete']);
  });

  const openDeleteFromMenu = () => {
    let active: any = null;
    const Grab = () => { active = useActiveScreenHeader(); return null; };
    render(<Grab />);
    act(() => active.overflow.find((o: any) => o.key === 'delete').onPress());
  };

  it('телефон: «Удалить поездку» спрашивает подтверждение, «Оставить» ничего не удаляет', () => {
    mockResponsive = PHONE;
    mockTrip(makeTrip({ isOwner: true }));
    const { getByTestId, queryByTestId } = renderScreen();

    expect(queryByTestId('trip-plan-delete-confirm')).toBeNull();
    openDeleteFromMenu();
    expect(getByTestId('trip-plan-delete-confirm')).toBeTruthy();
    fireEvent.press(getByTestId('trip-plan-delete-cancel'));
    expect(mockDeleteMutate).not.toHaveBeenCalled();
  });

  it('телефон: подтверждение удаляет поездку', () => {
    mockResponsive = PHONE;
    mockTrip(makeTrip({ isOwner: true }));
    const { getByTestId } = renderScreen();

    openDeleteFromMenu();
    act(() => getByTestId('trip-plan-delete-confirm').props.onPress());
    expect(mockDeleteMutate).toHaveBeenCalledWith(8001, expect.anything());
  });

  it('телефон: у каждой вкладки подпись; «Ещё» названа по содержимому', () => {
    mockResponsive = PHONE;
    mockTrip(makeTrip({ isOwner: true, status: 'planning' }));
    const { getByTestId } = renderScreen();

    expect(getByTestId('trip-plan-tab-route')).toHaveTextContent('Маршрут', { exact: false });
    expect(getByTestId('trip-plan-tab-people')).toHaveTextContent('Люди', { exact: false });
    expect(getByTestId('trip-plan-tab-export')).toHaveTextContent('Экспорт', { exact: false });
    expect(getByTestId('trip-plan-tab-more')).toHaveTextContent('Подготовка', { exact: false });
  });

  it('завершённая поездка: вкладка называется «Отчёт»', () => {
    mockResponsive = PHONE;
    mockTrip(makeTrip({ isOwner: true, status: 'completed' }));
    const { getByTestId } = renderScreen();
    expect(getByTestId('trip-plan-tab-more')).toHaveTextContent('Отчёт', { exact: false });
  });

  it('чужая поездка: нет карандаша и «Удалить», остаются экспорт и «Поделиться»', () => {
    mockResponsive = PHONE;
    mockTrip(makeTrip({ isOwner: false }));
    const { getByTestId } = renderScreen();

    const header = probe(getByTestId);
    expect(header.primary).toBeNull();
    expect(header.overflow.map((o: unknown[]) => o[0])).toEqual(['export', 'share']);
  });

  it('desktop: кнопки с подписями на месте, заголовок в теле', () => {
    mockResponsive = DESKTOP;
    mockTrip(makeTrip({ isOwner: true }));
    const { getByTestId, getByText } = renderScreen();

    expect(getByTestId('trip-plan-edit')).toHaveTextContent('Редактировать поездку', { exact: false });
    expect(getByTestId('trip-plan-delete')).toHaveTextContent('Удалить поездку', { exact: false });
    expect(getByText('Маршрут по Браславским озёрам')).toBeTruthy();
  });
});
