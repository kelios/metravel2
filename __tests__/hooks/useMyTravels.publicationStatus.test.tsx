// #1833: вкладки «Опубл.» и «Черновики» были клиентским срезом общего списка,
// и ради полноты фильтра профиль скачивал весь каталог автора (365 маршрутов —
// ~18 запросов подряд). Срез обязан просить у сервера только свой статус и
// листаться страницами того же фильтра.

import React from 'react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { renderHook as renderQueryHook, act, waitFor } from '@testing-library/react-native';

let mockQueryOwner: string | null = 'u-1';
jest.mock('@/hooks/useQueryOwner', () => ({ useQueryOwner: () => mockQueryOwner }));
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => ({ isAuthenticated: Boolean(mockQueryOwner), userId: mockQueryOwner }) } }));

jest.mock('@/api/travelsApi', () => ({
  fetchMyTravels: jest.fn(),
  deleteTravel: jest.fn(),
  unwrapMyTravelsPayload: jest.requireActual('@/api/travelUserQueries').unwrapMyTravelsPayload,
}));

jest.mock('@/utils/toast', () => ({
  showToastMessage: jest.fn(),
}));
jest.mock('@/utils/confirmAction', () => ({ confirmAction: jest.fn() }));

import { useMyTravels } from '@/hooks/useMyTravels';
import { deleteTravel, fetchMyTravels } from '@/api/travelsApi';
import { confirmAction } from '@/utils/confirmAction';
import { DRAFT_PUBLICATION_STATUSES } from '@/utils/travelPublicationStatus';
import { dropQueryCacheForIdentityChange } from '@/api/identityQueryCache';
import { queryKeys } from '@/api/queryKeys';
import {
  installBlockedAuthorGuard,
  invalidateBlockSensitiveQueries,
  releaseAuthorBlock,
  resetBlockedAuthorStateForTests,
} from '@/api/blockSensitiveQueries';

const mockFetchMyTravels = fetchMyTravels as jest.MockedFunction<typeof fetchMyTravels>;
const mockDeleteTravel = deleteTravel as jest.MockedFunction<typeof deleteTravel>;
const mockConfirmAction = confirmAction as jest.MockedFunction<typeof confirmAction>;

const page = (ids: number[], total: number) => ({
  data: ids.map((id) => ({
    id,
    name: `Travel ${id}`,
    slug: `t-${id}`,
    url: `/travels/${id}`,
    publication_status: 'draft',
  })),
  total,
});

const renderDraftsSlice = () =>
  renderHook(() =>
    useMyTravels({
      userId: 'u-1',
      perPage: 20,
      includeDrafts: true,
      publicationStatus: DRAFT_PUBLICATION_STATUSES,
    })
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockQueryOwner = 'u-1';
});

describe('useMyTravels — серверный срез по статусу публикации', () => {
  it('первую страницу берёт одним запросом со своим where.publication_status', async () => {
    mockFetchMyTravels.mockResolvedValue(page([1, 2], 65) as any);

    const { result } = renderDraftsSlice();
    await act(async () => {
      await result.current.load();
    });

    // Ровно один запрос: ни цепочки страниц общего списка, ни счётчика черновиков —
    // разбивку вкладок считает общий список автора, а не срез.
    expect(mockFetchMyTravels).toHaveBeenCalledTimes(1);
    expect(mockFetchMyTravels).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u-1',
        page: 1,
        perPage: 20,
        publicationStatus: ['draft', 'pending_review'],
      })
    );
    expect(result.current.publicationCounts).toBeNull();
    expect(result.current.myTravels).toHaveLength(2);
    expect(result.current.hasMore).toBe(true);
  });

  it('следующую страницу листает тем же фильтром, а не общим списком', async () => {
    mockFetchMyTravels.mockResolvedValue(page([1, 2], 65) as any);

    const { result } = renderDraftsSlice();
    await act(async () => {
      await result.current.load();
    });

    mockFetchMyTravels.mockResolvedValue(page([3, 4], 65) as any);
    await act(async () => {
      await result.current.loadMore();
    });

    expect(mockFetchMyTravels).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 2,
        perPage: 20,
        publicationStatus: ['draft', 'pending_review'],
      })
    );
    await waitFor(() => expect(result.current.myTravels).toHaveLength(4));
  });

  it('инлайновый массив фильтра не пересоздаёт загрузчики на каждом рендере', () => {
    const { result, rerender } = renderHook(() =>
      useMyTravels({ userId: 'u-1', perPage: 20, publicationStatus: ['draft', 'pending_review'] })
    );
    const firstLoad = result.current.load;
    const firstLoadMore = result.current.loadMore;

    rerender({});

    // Иначе каждый рендер профиля перезапускал бы эффект загрузки вкладки.
    expect(result.current.load).toBe(firstLoad);
    expect(result.current.loadMore).toBe(firstLoadMore);
  });

  it('пустая следующая страница завершает выдачу, даже если серверный total больше', async () => {
    mockFetchMyTravels.mockResolvedValueOnce(page([1, 2], 65) as any).mockResolvedValueOnce(page([], 65) as any);
    const { result } = renderDraftsSlice();
    await act(async () => { await result.current.load(); });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasMore).toBe(true);
    });
    await act(async () => { await result.current.loadMore(); });
    expect(mockFetchMyTravels).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    expect(result.current.myTravels.map(t => t.id)).toEqual([1, 2]);
    await waitFor(() => expect(result.current.hasMore).toBe(false));
  });

  it('поздняя страница не затирает обновлённую первую страницу', async () => {
    let resolveOld!: (value: any) => void;
    const oldPage = new Promise(resolve => { resolveOld = resolve; });
    let oldSignal: AbortSignal | undefined;
    mockFetchMyTravels.mockResolvedValueOnce(page([1, 2], 4) as any)
      .mockImplementationOnce(params => { oldSignal = params.signal; return oldPage as any; })
      .mockResolvedValueOnce(page([7, 8], 2) as any);
    const { result } = renderDraftsSlice();
    await act(async () => { await result.current.load(); });
    let loadingMore!: Promise<void>;
    act(() => { loadingMore = result.current.loadMore(); });
    await waitFor(() => expect(mockFetchMyTravels).toHaveBeenCalledTimes(2));
    await act(async () => { await result.current.load(); });
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => { resolveOld(page([3, 4], 4)); await loadingMore; });
    await waitFor(() => expect(result.current.myTravels.map(t => t.id)).toEqual([7, 8]));
    expect(result.current.hasMore).toBe(false);
  });

  it('разделяет private/public и target-user без переноса предыдущих строк', async () => {
    mockFetchMyTravels.mockImplementation(async params => page([params.includeDrafts ? 11 : params.user_id === 'u-2' ? 22 : 12], 1) as any);
    const { result, rerender } = renderHook(
      ({ target, includeDrafts }: { target: string; includeDrafts: boolean }) => useMyTravels({ userId: target, perPage: 20, includeDrafts }),
      { initialProps: { target: 'u-1', includeDrafts: true } },
    );
    await act(async () => { await result.current.load(); });
    expect(result.current.myTravels.map(t => t.id)).toEqual([11]);
    rerender({ target: 'u-1', includeDrafts: false });
    expect(result.current.myTravels).toEqual([]);
    await act(async () => { await result.current.load(); });
    expect(result.current.myTravels.map(t => t.id)).toEqual([12]);
    rerender({ target: 'u-2', includeDrafts: false });
    expect(result.current.myTravels).toEqual([]);
    await act(async () => { await result.current.load(); });
    expect(result.current.myTravels.map(t => t.id)).toEqual([22]);
  });

  it('отменённый ответ A после logout/login не возвращает личные данные в B или удалённый cache A', async () => {
    let resolveA!: (value: any) => void;
    let signalA: AbortSignal | undefined;
    const lateA = new Promise(resolve => { resolveA = resolve; });
    mockFetchMyTravels.mockImplementation(params => {
      if (params.user_id === 'u-1') { signalA = params.signal; return lateA as any; }
      return Promise.resolve(page([22], 1) as any);
    });
    const { result, rerender } = renderHook(
      ({ userId }: { userId: string | null }) => useMyTravels({ userId, perPage: 20, publicationStatus: ['draft'] }),
      { initialProps: { userId: 'u-1' as string | null } },
    );
    let loadingA!: Promise<void>;
    act(() => { loadingA = result.current.load(); });
    await waitFor(() => expect(mockFetchMyTravels).toHaveBeenCalledTimes(1));
    const client = [...queryClients].at(-1)!;
    const keyA = queryKeys.authorTravels('u-1', 'u-1', { perPage: 20, includeDrafts: false, publicationStatus: ['draft'] });
    mockQueryOwner = null;
    rerender({ userId: null });
    await act(async () => { await dropQueryCacheForIdentityChange(client, () => true); });
    mockQueryOwner = 'u-2';
    rerender({ userId: 'u-2' });
    expect(result.current.myTravels).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.publicationCounts).toBeNull();
    await act(async () => { await result.current.load(); });
    await act(async () => { resolveA({ data: [{ ...page([11], 1).data[0], moderation_decision_reason: 'A private reason' }], total: 1 }); await loadingA; });
    expect(signalA?.aborted).toBe(true);
    expect(result.current.myTravels.map(t => t.id)).toEqual([22]);
    expect(JSON.stringify(result.current.myTravels)).not.toContain('A private reason');
    expect(client.getQueryData(keyA)).toBeUndefined();
  });

  it.each(['u-2', 'u-1'])('поздний rollback удаления A не меняет новую сессию %s, даже с тем же ключом', async nextOwner => {
    let freshSession = false;
    mockFetchMyTravels.mockImplementation(async () => freshSession ? page([22], 1) as any : {
      data: [{ ...page([11], 1).data[0], moderation_decision: 'rejected', moderation_decision_reason: 'A private reason', moderation_decided_at: '2026-10-20T09:00:00Z' }], total: 1,
    } as any);
    mockConfirmAction.mockResolvedValue(true);
    let rejectDelete!: (error: Error) => void;
    mockDeleteTravel.mockReturnValue(new Promise((_yes, no) => { rejectDelete = no; }) as any);
    const { result, rerender } = renderHook(
      ({ userId }: { userId: string | null }) => useMyTravels({ userId, perPage: 20, publicationStatus: ['draft'] }),
      { initialProps: { userId: 'u-1' as string | null } },
    );
    await act(async () => { await result.current.load(); });
    let removing!: Promise<boolean>;
    act(() => { removing = result.current.remove(11); });
    await waitFor(() => expect(mockDeleteTravel).toHaveBeenCalledTimes(1));
    expect(result.current.myTravels).toEqual([]);
    const client = [...queryClients].at(-1)!;
    const oldKey = queryKeys.authorTravels('u-1', 'u-1', { perPage: 20, includeDrafts: false, publicationStatus: ['draft'] });
    mockQueryOwner = null;
    rerender({ userId: null });
    await act(async () => { await dropQueryCacheForIdentityChange(client, () => true); });
    freshSession = true;
    mockQueryOwner = nextOwner;
    rerender({ userId: nextOwner });
    await act(async () => { await result.current.load(); });
    await waitFor(() => expect(result.current.myTravels.map(t => t.id)).toEqual([22]));
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await act(async () => {
        rejectDelete(Object.assign(new Error('A delete forbidden'), { status: 403 }));
        await expect(removing).resolves.toBe(false);
      });
      expect(result.current.myTravels.map(t => t.id)).toEqual([22]);
      expect(result.current.removingTravelId).toBeNull();
      expect(result.current.error).toBeNull();
      expect(JSON.stringify(result.current.myTravels)).not.toContain('A private reason');
      if (nextOwner === 'u-2') expect(client.getQueryData(oldKey)).toBeUndefined();
      else expect(JSON.stringify(client.getQueryData(oldKey))).not.toContain('A private reason');
    } finally { log.mockRestore(); }
  });
});

describe('#2669 — author-block infinite-page contract', () => {
  const authoredPage = (ids: number[], blockedIds: number[], total: number) => ({
    ...page(ids, total),
    data: page(ids, total).data.map(travel => ({
      ...travel,
      userIds: blockedIds.includes(travel.id) ? '1,2' : '1',
    })),
  });

  const install = () => {
    const client = [...queryClients].at(-1)!;
    client.setQueryData(queryKeys.myBlockedUsers('u-1'), [{ user: 2 }]);
    const uninstall = installBlockedAuthorGuard(client, { getOwner: () => 'u-1' });
    return { client, uninstall };
  };

  afterEach(() => { resetBlockedAuthorStateForTests(); });

  it('advances past a fully hidden first page and restores the same window on unblock', async () => {
    mockFetchMyTravels.mockImplementation(async params => authoredPage(
      params.page === 1 ? [1, 2] : [3, 4], [1, 2], 4,
    ) as any);
    const onTotalChange = jest.fn();
    const { result } = renderHook(() => useMyTravels({ userId: '1', perPage: 2, onTotalChange }));
    const { client, uninstall } = install();
    try {
      await act(async () => { await result.current.load(); });
      await waitFor(() => expect(result.current.myTravels.map(travel => travel.id)).toEqual([3, 4]));
      expect(mockFetchMyTravels.mock.calls.map(([params]) => params.page)).toEqual([1, 2]);
      expect(result.current.hasMore).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(onTotalChange).toHaveBeenLastCalledWith(2);

      await act(async () => {
        releaseAuthorBlock(2, false);
        client.setQueryData(queryKeys.myBlockedUsers('u-1'), []);
        invalidateBlockSensitiveQueries(client, 'unblock');
      });
      await waitFor(() => expect(result.current.myTravels.map(travel => travel.id)).toEqual([1, 2, 3, 4]));
      expect(mockFetchMyTravels.mock.calls.map(([params]) => params.page)).toEqual([1, 2, 1, 2]);
      expect(result.current.hasMore).toBe(false);
      expect(onTotalChange).toHaveBeenLastCalledWith(4);
    } finally { uninstall(); }
  });

  it('subtracts hidden rows across every page without requesting a page beyond the served total', async () => {
    mockFetchMyTravels.mockImplementation(async params => authoredPage(
      params.page === 1 ? [1, 2] : params.page === 2 ? [3, 4] : [5, 6], [1, 2, 3], 6,
    ) as any);
    const onTotalChange = jest.fn();
    const { result } = renderHook(() => useMyTravels({ userId: '1', perPage: 2, onTotalChange }));
    const { uninstall } = install();
    try {
      await act(async () => { await result.current.load(); });
      await waitFor(() => expect(result.current.myTravels.map(travel => travel.id)).toEqual([4]));
      expect(result.current.hasMore).toBe(true);
      await act(async () => { await result.current.loadMore(); });
      await waitFor(() => expect(result.current.myTravels.map(travel => travel.id)).toEqual([4, 5, 6]));
      expect(onTotalChange).toHaveBeenLastCalledWith(3);
      expect(result.current.hasMore).toBe(false);
      await act(async () => { await result.current.loadMore(); });
      expect(mockFetchMyTravels.mock.calls.map(([params]) => params.page)).toEqual([1, 2, 3]);
    } finally { uninstall(); }
  });

  it('stops at a genuinely empty server page after hidden rows rather than looping or staying busy', async () => {
    mockFetchMyTravels.mockImplementation(async params => authoredPage(
      params.page === 1 ? [1, 2] : [], [1, 2], 10,
    ) as any);
    const onTotalChange = jest.fn();
    const { result } = renderHook(() => useMyTravels({ userId: '1', perPage: 2, onTotalChange }));
    const { uninstall } = install();
    try {
      await act(async () => { await result.current.load(); });
      await waitFor(() => expect(mockFetchMyTravels.mock.calls.map(([params]) => params.page)).toEqual([1, 2]));
      await waitFor(() => expect(result.current.isLoadingMore).toBe(false));
      expect(result.current.myTravels).toEqual([]);
      expect(result.current.hasMore).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(onTotalChange).toHaveBeenLastCalledWith(0);
      await act(async () => { await result.current.loadMore(); });
      expect(mockFetchMyTravels).toHaveBeenCalledTimes(2);
    } finally { uninstall(); }
  });

  it('exposes an automatic next-page failure as retryable error when the guard hid every shown row', async () => {
    let failNextPage = true;
    mockFetchMyTravels.mockImplementation(async params => {
      if (params.page === 2 && failNextPage) throw Object.assign(new Error('Automatic author page 503'), { status: 503 });
      return authoredPage(params.page === 1 ? [1, 2] : [3, 4], [1, 2], 4) as any;
    });
    const onTotalChange = jest.fn();
    const { result } = renderHook(() => useMyTravels({ userId: '1', perPage: 2, onTotalChange }));
    const { uninstall } = install();
    try {
      await act(async () => { await result.current.load(); });
      await waitFor(() => expect(result.current.error).toContain('Automatic author page 503'));
      expect(result.current.myTravels).toEqual([]);
      expect(result.current.hasMore).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(onTotalChange).toHaveBeenLastCalledWith(null);
      failNextPage = false;
      await act(async () => { await result.current.load(); });
      await waitFor(() => expect(result.current.myTravels.map(travel => travel.id)).toEqual([3, 4]));
      expect(result.current.error).toBeNull();
      expect(result.current.hasMore).toBe(false);
      expect(onTotalChange).toHaveBeenLastCalledWith(2);
      expect(mockFetchMyTravels.mock.calls.map(([params]) => params.page)).toEqual([1, 2, 1, 2]);
    } finally { uninstall(); }
  });

  it('shows offline retry while automatic advance is paused and resumes its same page on reconnect', async () => {
    mockFetchMyTravels.mockImplementation(async params => {
      if (params.page === 1) onlineManager.setOnline(false);
      return authoredPage(params.page === 1 ? [1, 2] : [3, 4], [1, 2], 4) as any;
    });
    const onTotalChange = jest.fn();
    const { result } = renderHook(() => useMyTravels({ userId: '1', perPage: 2, onTotalChange }));
    const { uninstall } = install();
    try {
      await act(async () => { await result.current.load(); });
      await waitFor(() => expect(result.current.error).not.toBeNull());
      expect(result.current.myTravels).toEqual([]);
      expect(result.current.hasMore).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(onTotalChange).toHaveBeenLastCalledWith(null);
      expect(mockFetchMyTravels.mock.calls.map(([params]) => params.page)).toEqual([1]);
      act(() => { onlineManager.setOnline(true); });
      await waitFor(() => expect(result.current.myTravels.map(travel => travel.id)).toEqual([3, 4]));
      expect(result.current.error).toBeNull();
      expect(onTotalChange).toHaveBeenLastCalledWith(2);
      expect(mockFetchMyTravels.mock.calls.map(([params]) => params.page)).toEqual([1, 2]);
    } finally { uninstall(); onlineManager.setOnline(true); }
  });
});


// Isolated real QueryClient: cache lifecycle is part of the hook contract.
const queryClients = new Set<QueryClient>();
const renderHook: typeof renderQueryHook = (callback, options) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: 300_000 } },
  });
  queryClients.add(client);
  const wrapper = ({ children }: React.PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderQueryHook(callback, { ...options, wrapper });
};
afterEach(() => {
  for (const client of queryClients) client.clear();
  queryClients.clear();
});
