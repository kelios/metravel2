import { fireEvent, render, waitFor } from '@testing-library/react-native';

import type { PlannedTrip } from '@/api/plannedTrips';
import type { UserProfileDto } from '@/api/user';
import TripInvitePanel, { getTripInviteSubscriberName } from '@/components/trips/planning/TripInvitePanel';

const mockSubscribers: UserProfileDto[] = [];
const mockMutate = jest.fn();
const mockOpenExternalUrl = jest.fn((_url?: unknown) => Promise.resolve(true));
const mockShareTripPlan = jest.fn((_trip?: unknown) => Promise.resolve('shared'));

jest.mock('@/hooks/useSubscriptionsData', () => ({
  useSubscriptionsData: () => ({
    subscribers: mockSubscribers,
    subscribersLoading: false,
  }),
}));

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  useInviteParticipants: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
}));

jest.mock('@/utils/shareTripPlan', () => ({
  shareTripPlan: (...args: unknown[]) => mockShareTripPlan(...args),
}));

jest.mock('@/components/ui/Button', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');

  return function MockButton({
    label,
    onPress,
    disabled,
    testID,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    testID?: string;
  }) {
    return (
      <Pressable onPress={onPress} disabled={disabled} testID={testID}>
        <Text>{label}</Text>
      </Pressable>
    );
  };
});

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    border: '#ddd',
    error: '#d00',
    primary: '#0a7',
    primaryText: '#064',
    primaryDark: '#064',
    success: '#080',
    surface: '#fff',
    surfaceMuted: '#eef',
    text: '#111',
    textMuted: '#666',
    textSecondary: '#333',
  }),
}));

const makeProfile = (overrides: Partial<UserProfileDto> & Record<string, unknown>): UserProfileDto => ({
  id: 1,
  user: 101,
  first_name: '',
  last_name: '',
  youtube: '',
  instagram: '',
  twitter: '',
  vk: '',
  email_notify_comments: false,
  email_notify_messages: false,
  avatar: null,
  ...overrides,
});

const trip: PlannedTrip = {
  id: 42,
  slug: 'long-weekend',
  title: 'Long weekend',
  description: '',
  startDate: '2026-07-20',
  startTime: null,
  transport: 'car',
  visibility: 'followers',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 101, name: 'Owner', avatarUrl: null },
  route: [],
  routeGeometry: null,
  routeSummary: null,
  routingState: null,
  participants: [],
  coverUrl: null,
  region: '',
  publishedToCommunity: false,
  report: null,
  isOwner: true,
  myRsvp: null,
  createdAt: '2026-07-09T00:00:00Z',
};

describe('TripInvitePanel', () => {
  beforeEach(() => {
    mockSubscribers.splice(0, mockSubscribers.length);
    mockMutate.mockClear();
    mockOpenExternalUrl.mockClear();
    mockShareTripPlan.mockClear();
    mockShareTripPlan.mockResolvedValue('shared');
  });

  it('derives invite display names without destructive two-letter truncation', () => {
    expect(getTripInviteSubscriberName(makeProfile({
      first_name: 'Александра',
      last_name: 'Путешественница-Длиннофамильная',
    }))).toBe('Александра Путешественница-Длиннофамильная');

    expect(getTripInviteSubscriberName(makeProfile({
      id: 2,
      user: 202,
      first_name: '',
      last_name: '',
      username: 'trail_friend',
    }))).toBe('trail_friend');

    expect(getTripInviteSubscriberName(makeProfile({
      id: 3,
      user: 303,
      first_name: '',
      last_name: '',
    }))).toBe('Пользователь #303');
  });

  it('shows selected invitee names and supports select/cancel/reselect', () => {
    const longName = 'Александра Путешественница-Длиннофамильная';
    mockSubscribers.push(
      makeProfile({
        id: 1,
        user: 101,
        first_name: 'Александра',
        last_name: 'Путешественница-Длиннофамильная',
      }),
      makeProfile({
        id: 2,
        user: 202,
        first_name: '',
        last_name: '',
        username: 'trail_friend',
      }),
    );

    const { getByTestId, getByText, queryByTestId } = render(<TripInvitePanel trip={trip} />);

    expect(getByText(longName)).toBeTruthy();
    expect(getByText('trail_friend')).toBeTruthy();

    fireEvent.press(getByTestId('trip-invite-subscriber-101'));
    expect(getByTestId('trip-invite-selected-names').props.children.join('')).toContain(longName);

    fireEvent.press(getByTestId('trip-invite-subscriber-101'));
    expect(queryByTestId('trip-invite-selected-names')).toBeNull();

    fireEvent.press(getByTestId('trip-invite-subscriber-202'));
    expect(getByTestId('trip-invite-selected-names').props.children.join('')).toContain('trail_friend');
  });

  it('opens generic system share and remains repeat-safe after cancellation', async () => {
    mockShareTripPlan.mockResolvedValue('dismissed');
    const { getByTestId, queryByText } = render(<TripInvitePanel trip={trip} />);

    fireEvent.press(getByTestId('trip-invite-share-system'));
    await waitFor(() => expect(mockShareTripPlan).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(getByTestId('trip-invite-share-system').props.disabled).toBe(false),
    );

    fireEvent.press(getByTestId('trip-invite-share-system'));
    await waitFor(() => expect(mockShareTripPlan).toHaveBeenCalledTimes(2));

    expect(mockShareTripPlan).toHaveBeenNthCalledWith(1, trip);
    expect(queryByText('Не удалось открыть меню «Поделиться». Попробуйте ещё раз.')).toBeNull();
  });

  it('keeps Telegram share on the centralized external-link helper', async () => {
    const { getByTestId } = render(<TripInvitePanel trip={trip} />);

    fireEvent.press(getByTestId('trip-invite-share'));

    await waitFor(() => expect(mockOpenExternalUrl).toHaveBeenCalledTimes(1));
    const telegramUrl = new URL(mockOpenExternalUrl.mock.calls[0][0] as string);
    expect(telegramUrl.origin).toBe('https://t.me');
    expect(telegramUrl.searchParams.get('url')).toBe('https://metravel.by/trips/plan/42');
  });
});
