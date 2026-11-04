import { act, renderHook, waitFor } from '@testing-library/react-native';

import { apiClient } from '@/api/client';
import { queryKeys } from '@/api/queryKeys';
import { useAuth } from '@/context/AuthContext';
import { useInviteSubscribers, useSubscriptionsData } from '@/hooks/useSubscriptionsData';
import { createAuthValue } from '../helpers/mockContextValues';
import { createQueryWrapper } from '../helpers/testQueryClient';

jest.mock('@/api/client', () => ({ apiClient: { get: jest.fn() } }));
jest.mock('@/context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('@/hooks/useQueryOwner', () => ({
  useQueryOwner: () => require('@/context/AuthContext').useAuth().userId,
}));

const mockedGet = jest.mocked(apiClient.get);
const mockedUseAuth = jest.mocked(useAuth);

const auth = (id: string) => mockedUseAuth.mockReturnValue(
  createAuthValue({ isAuthenticated: true, authReady: true, userId: id }),
);
const page = (ids: number[], count = ids.length, next: string | null = null) => ({
  count,
  next,
  previous: null,
  results: ids.map((id) => ({
    user: id,
    display_name: `Author ${id}`,
    avatar_url: null,
    travels_total: 8,
    travels_preview: [{ id: 10, name: 'Published route', slug: 'published-route' }],
  })),
});

describe('compact social reads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth('1');
  });

  it('loads two explicit pages for 21 authors without any per-author reads', async () => {
    mockedGet.mockResolvedValueOnce(page(Array.from({ length: 20 }, (_, i) => i + 2), 21, '/api/user/subscriptions/?page=2'))
      .mockResolvedValueOnce(page([22], 21));
    const { result } = await renderHook(() => useSubscriptionsData({ readSubscribers: false }), {
      wrapper: createQueryWrapper().Wrapper,
    });

    await waitFor(() => expect(result.current.authors).toHaveLength(20));
    const first = result.current.authors[0];
    expect(first).toMatchObject({ profile: { user: 2 }, travels: [{ id: 10, slug: 'published-route' }], travelsTotal: 8 });
    expect(result.current.subscriptionsCount).toBe(21);
    expect(result.current.subscriptionsPage.canLoadMore).toBe(true);
    expect(mockedGet).toHaveBeenCalledTimes(1);

    await act(async () => result.current.subscriptionsPage.loadMore());
    await waitFor(() => expect(result.current.authors).toHaveLength(21));
    expect(result.current.authors[0]).toBe(first);
    expect(result.current.subscriptionsCount).toBe(21);
    expect(result.current.subscriptionsPage.canLoadMore).toBe(false);
    expect(mockedGet.mock.calls).toEqual([
      ['/user/subscriptions/?view=compact&page=1&page_size=20', undefined, { signal: expect.any(AbortSignal) }],
      ['/user/subscriptions/?view=compact&page=2&page_size=20', undefined, { signal: expect.any(AbortSignal) }],
    ]);
  });

  it('cancels the inactive tab and never publishes another viewer’s late result', async () => {
    let resolveOld!: (value: ReturnType<typeof page>) => void;
    mockedGet.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce(page([5]))
      .mockResolvedValueOnce(page([17]));
    const { rerender, result } = await renderHook((tab: 'subscriptions' | 'subscribers') => useSubscriptionsData({
      readSubscriptions: tab === 'subscriptions',
      readSubscribers: tab === 'subscribers',
    }), { initialProps: 'subscriptions', wrapper: createQueryWrapper().Wrapper });

    await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1));
    const originalSignal = mockedGet.mock.calls[0][2]?.signal;
    await rerender('subscribers');
    await waitFor(() => expect(result.current.subscribers[0]?.profile.user).toBe(5));
    expect(originalSignal?.aborted).toBe(true);

    auth('4');
    await rerender('subscribers');
    await act(async () => resolveOld(page([99])));
    await waitFor(() => expect(result.current.subscribers[0]?.profile.user).toBe(17));
    expect(result.current.authors).toHaveLength(0);
    expect(mockedGet.mock.calls.map(([url]) => url)).toEqual([
      '/user/subscriptions/?view=compact&page=1&page_size=20',
      '/user/subscribers/?view=compact&page=1&page_size=20',
      '/user/subscribers/?view=compact&page=1&page_size=20',
    ]);
  });

  it('keeps a genuine server zero through a background failure', async () => {
    mockedGet.mockResolvedValueOnce(page([])).mockRejectedValueOnce(new Error('bad response'));
    const { Wrapper, queryClient } = createQueryWrapper();
    const { result } = await renderHook(() => useSubscriptionsData({ readSubscribers: false }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.subscriptionsCount).toBe(0));
    const updatedAt = result.current.subscriptionsDataUpdatedAt;

    await act(async () => queryClient.refetchQueries({ queryKey: queryKeys.compactSocialPage('1', 'subscriptions') }));
    expect(result.current.subscriptionsCount).toBe(0);
    expect(result.current.subscriptionsDataUpdatedAt).toBe(updatedAt);
  });

  it('leaves the invitation picker on the legacy subscribers directory', async () => {
    mockedGet.mockResolvedValueOnce([{ id: 2, user: 2 }]);
    const { result } = await renderHook(() => useInviteSubscribers(true), { wrapper: createQueryWrapper().Wrapper });
    await waitFor(() => expect(result.current.subscribers).toEqual([{ id: 2, user: 2 }]));
    expect(mockedGet.mock.calls).toEqual([['/user/subscribers/']]);
  });
});
