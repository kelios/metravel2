import React from 'react';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PublicUserProfileScreen from '@/app/(tabs)/user/[id]';
import { fetchTravels } from '@/api/travelListQueries';
import { queryKeys } from '@/api/queryKeys';
import type { Travel } from '@/types/types';
import { ProfileStatPills } from '@/components/profile/ProfileStatPills';
import { i18n } from '@/i18n';

let mockAuthorId = '7';
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: mockAuthorId }),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useIsFocused: () => false,
}));
jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => new Proxy({}, { get: () => '#334455' }),
}));
jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ width: 390, isPhone: true, isMobile: true }),
  useResponsiveWidth: () => 390,
}));
jest.mock('@/hooks/useHydrationReady', () => ({ useHydrationReady: () => true }));
jest.mock('@/hooks/useUserProfileCached', () => ({
  useUserProfileCached: () => ({ profile: {}, isLoading: false, fullName: `Author ${mockAuthorId}` }),
}));
jest.mock('@/context/AuthContext', () => ({ useAuth: () => ({ userId: '1' }) }));
jest.mock('@/hooks/useAchievementsApi', () => ({ useUserAchievements: () => ({}) }));
jest.mock('@/hooks/useSubscriptionsData', () => ({
  useSubscriptionsData: () => ({ subscriptions: [], subscribers: [], authors: [] }),
}));
jest.mock('@/api/travelListQueries', () => ({ fetchTravels: jest.fn() }));
jest.mock('@/utils/queryRetryPolicy', () => ({ readRetryTwice: () => false }));
jest.mock('@/api/user', () => ({ mapProfileRank: () => null }));
jest.mock('@/utils', () => ({ webTouchScrollStyle: {} }));
jest.mock('@/components/seo/LazyInstantSEO', () => () => null);
jest.mock('@/components/subscriptions/SubscriptionsTabContent', () => () => null);
jest.mock('@/components/screens/profile/PublicProfileOverviewTab', () => ({ PublicProfileOverviewTab: () => null }));
jest.mock('@/components/screens/profile/PublicProfileBlockedState', () => ({ PublicProfileBlockedState: () => null }));
jest.mock('@/components/ui/SubscribeButton', () => () => null);
jest.mock('@/components/ui/StarRating', () => () => null);
jest.mock('@/components/profile/UserSafetyMenu', () => () => null);
jest.mock('@/components/profile/ProtectedContacts', () => () => null);
jest.mock('@/components/ui/SafetyNotice', () => () => null);
jest.mock('@/components/achievements/PeerBadgeGiveButton', () => () => null);
jest.mock('@/components/ui/ImageCardMedia', () => () => null);
jest.mock('@/components/profile/CoverTopoTexture', () => ({ CoverTopoTexture: () => null }));
jest.mock('@/components/ui/UnifiedTravelCard', () => {
  const { Text } = jest.requireActual('react-native');
  return { __esModule: true, default: ({ title }: { title: string }) => <Text>{title}</Text> };
});

type TravelsResult = { data: Travel[]; total: number };
const mockFetchTravels = jest.mocked(fetchTravels);
const trip = { id: 70, name: 'Author seven route', slug: 'author-seven' } as Travel;
const loadError = 'Не удалось загрузить путешествия автора';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('public author route count readiness (#2335)', () => {
  let client: QueryClient;
  beforeEach(() => {
    mockAuthorId = '7';
    mockFetchTravels.mockReset();
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  });
  afterEach(() => client.clear());

  function screen() {
    return <QueryClientProvider client={client}><PublicUserProfileScreen /></QueryClientProvider>;
  }

  it('updates unavailable pill accessibility text when the locale changes', async () => {
    const view = render(<ProfileStatPills pills={[{ key: 'travels', label: 'Routes', value: null, icon: 'map', onPress: jest.fn() }]} />);
    expect(view.getByLabelText('Routes: количество недоступно')).toBeTruthy();
    try {
      await act(async () => { await i18n.changeLanguage('en'); });
      expect(view.getByLabelText('Routes: count unavailable')).toBeTruthy();
      expect(view.queryByLabelText('Routes: количество недоступно')).toBeNull();
    } finally {
      view.unmount();
      await act(async () => { await i18n.changeLanguage('ru'); });
    }
  });

  it('keeps a ready profile navigable while its independent routes request is pending', () => {
    mockFetchTravels.mockReturnValue(new Promise(() => {}));
    const view = render(screen());
    expect(view.getByText('Author 7')).toBeTruthy();
    expect(view.queryByLabelText('Маршруты: 0')).toBeNull();
    expect(view.getAllByLabelText('Маршруты')).toHaveLength(2);
    fireEvent.press(view.getAllByLabelText('Маршруты')[0]);
    expect(view.queryByText('У автора пока нет опубликованных путешествий')).toBeNull();
  });

  it('renders unavailable count in both real consumers after an initial error', async () => {
    mockFetchTravels.mockRejectedValue(new Error('routes failed'));
    const view = render(screen());
    await waitFor(() => expect(view.getAllByLabelText('Маршруты: количество недоступно')).toHaveLength(2));
    expect(view.getAllByText('—')).toHaveLength(2);
    expect(view.queryByLabelText('Маршруты: 0')).toBeNull();
    expect(view.getByText(loadError)).toBeTruthy();
    fireEvent.press(view.getAllByLabelText('Маршруты: количество недоступно')[0]);
  });

  it.each([0, 15])('renders confirmed total %i after success', async (total) => {
    const response = deferred<TravelsResult>();
    mockFetchTravels.mockReturnValue(response.promise);
    const view = render(screen());
    await act(async () => response.resolve({ data: total ? [trip] : [], total }));
    await waitFor(() => expect(view.getAllByLabelText(`Маршруты: ${total}`)).toHaveLength(total ? 2 : 1));
    expect(view.queryByText('—')).toBeNull();
    if (total === 0) expect(within(view.getByLabelText('Маршруты: 0')).getByText('0')).toBeTruthy();
    else expect(view.getByText(trip.name)).toBeTruthy();
    expect(mockFetchTravels).toHaveBeenCalledWith(0, 12, '', { user_id: '7', publish: 1, moderation: 1 });
  });

  it('retains confirmed same-author count and cards when a refresh fails', async () => {
    mockFetchTravels.mockResolvedValue({ data: [trip], total: 15 });
    const view = render(screen());
    await waitFor(() => expect(view.getAllByLabelText('Маршруты: 15')).toHaveLength(2));
    const refresh = deferred<TravelsResult>();
    mockFetchTravels.mockReturnValue(refresh.promise);
    act(() => { void client.invalidateQueries({ queryKey: queryKeys.userTravels('7') }); });
    expect(view.getAllByLabelText('Маршруты: 15')).toHaveLength(2);
    await act(async () => refresh.reject(new Error('refresh failed')));
    await waitFor(() => expect(view.getByText(loadError)).toBeTruthy());
    expect(view.getAllByLabelText('Маршруты: 15')).toHaveLength(2);
    expect(view.getByText(trip.name)).toBeTruthy();
  });

  it('keeps pagination placeholders for the same author and excludes them for another', async () => {
    mockFetchTravels.mockResolvedValue({ data: [trip], total: 15 });
    const view = render(screen());
    await waitFor(() => expect(view.getAllByLabelText('Маршруты: 15')).toHaveLength(2));
    const page = deferred<TravelsResult>();
    mockFetchTravels.mockReturnValue(page.promise);
    fireEvent.press(view.getByText('Показать ещё'));
    expect(view.getAllByLabelText('Маршруты: 15')).toHaveLength(2);
    expect(view.getByText(trip.name)).toBeTruthy();
    await act(async () => page.resolve({ data: [trip], total: 15 }));
    const nextAuthor = deferred<TravelsResult>();
    mockFetchTravels.mockReturnValue(nextAuthor.promise);
    mockAuthorId = '8';
    view.rerender(screen());
    expect(view.getByText('Author 8')).toBeTruthy();
    expect(view.queryAllByLabelText('Маршруты: 15')).toHaveLength(0);
    expect(view.queryByText(trip.name)).toBeNull();
    await act(async () => nextAuthor.reject(new Error('next author failed')));
    await waitFor(() => expect(view.getAllByLabelText('Маршруты: количество недоступно')).toHaveLength(2));
  });
});
