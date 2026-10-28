// Вкладки «Опубл.» и «Черновики» показывали разбивку ПЕРВОЙ СТРАНИЦЫ: при 365
// маршрутах в профиле стояло 15 и 5 — ровно perPage=20, потому что статусы
// считались по загруженным элементам. Разбивку берём с сервера.

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook as renderQueryHook, act, waitFor } from '@testing-library/react-native';

jest.mock('@/hooks/useQueryOwner', () => ({ useQueryOwner: () => 'u-1' }));
jest.mock('@/stores/authStore', () => ({ useAuthStore: { getState: () => ({ isAuthenticated: Boolean('u-1'), userId: 'u-1' }) } }));

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
import { queryKeys } from '@/api/queryKeys';
import { invalidateTravelCollections } from '@/utils/travelQueryInvalidation';
import { installBlockedAuthorGuard, resetBlockedAuthorStateForTests } from '@/api/blockSensitiveQueries';

const mockFetchMyTravels = fetchMyTravels as jest.MockedFunction<typeof fetchMyTravels>;
const mockDeleteTravel = deleteTravel as jest.MockedFunction<typeof deleteTravel>;
const mockConfirmAction = confirmAction as jest.MockedFunction<typeof confirmAction>;

const isDraftCountRequest = (params: Parameters<typeof fetchMyTravels>[0]) =>
  Array.isArray(params.publicationStatus) && params.publicationStatus.length > 0;

const page = (ids: number[], total: number, publicationStatus = 'published') => ({
  data: ids.map((id) => ({
    id,
    name: `Travel ${id}`,
    slug: `t-${id}`,
    url: `/travels/${id}`,
    publication_status: publicationStatus,
  })),
  total,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useMyTravels — разбивка опубликованных и черновиков', () => {
  it('берёт черновики из ответа сервера, а не из загруженной страницы', async () => {
    mockFetchMyTravels.mockImplementation(async (params: any) =>
      (isDraftCountRequest(params) ? page([1], 120, 'draft') : page([1, 2], 365)) as any
    );

    const { result } = await renderHook(() =>
      useMyTravels({ userId: 'u-1', perPage: 20, includeDrafts: true })
    );
    await act(async () => {
      await result.current.load();
    });

    expect(result.current.publicationCounts).toEqual({ published: 245, drafts: 120 });
    expect(result.current.myTravels).toHaveLength(2);
  });

  // #1871: `publicationCounts === null` значило одновременно «ещё не загружено»
  // и «счётчик упал», и сбой прятал бейдж вместо «—».
  it('помечает разбивку недоступной, когда запрос за счётчиком черновиков упал', async () => {
    mockFetchMyTravels.mockImplementation(async (params: any) => {
      if (isDraftCountRequest(params)) throw new Error('500 Internal Server Error');
      return page([1, 2], 365) as any;
    });

    const { result } = await renderHook(() =>
      useMyTravels({ userId: 'u-1', perPage: 20, includeDrafts: true })
    );
    await act(async () => {
      await result.current.load();
    });

    expect(result.current.publicationCounts).toBeNull();
    expect(result.current.publicationCountsUnavailable).toBe(true);
    // Сам список сбой счётчика не ломает.
    expect(result.current.myTravels).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it('на успешной разбивке недоступной её не помечает', async () => {
    mockFetchMyTravels.mockImplementation(async (params: any) =>
      (isDraftCountRequest(params) ? page([1], 120, 'draft') : page([1, 2], 365)) as any
    );

    const { result } = await renderHook(() =>
      useMyTravels({ userId: 'u-1', perPage: 20, includeDrafts: true })
    );
    await act(async () => {
      await result.current.load();
    });

    expect(result.current.publicationCountsUnavailable).toBe(false);
  });

  it('просит у API только счётчик черновиковых статусов, а не их список', async () => {
    mockFetchMyTravels.mockImplementation(async (params: any) =>
      (isDraftCountRequest(params) ? page([1], 7, 'draft') : page([1, 2], 40)) as any
    );

    const { result } = await renderHook(() =>
      useMyTravels({ userId: 'u-1', perPage: 20, includeDrafts: true })
    );
    await act(async () => {
      await result.current.load();
    });

    expect(mockFetchMyTravels).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u-1',
        page: 1,
        perPage: 1,
        includeDrafts: true,
        publicationStatus: ['draft', 'pending_review'],
      })
    );
  });

  it('на публичном профиле (без черновиков) второй запрос не уходит', async () => {
    mockFetchMyTravels.mockResolvedValue(page([1, 2], 40) as any);

    const { result } = await renderHook(() => useMyTravels({ userId: 'u-1', perPage: 20 }));
    await act(async () => {
      await result.current.load();
    });

    expect(mockFetchMyTravels).toHaveBeenCalledTimes(1);
    expect(result.current.publicationCounts).toBeNull();
  });

  it('сбой счётчика не ломает список — вкладки просто остаются без цифры', async () => {
    mockFetchMyTravels.mockImplementation(async (params: any) => {
      if (isDraftCountRequest(params)) throw new Error('500 Internal Server Error');
      return page([1, 2], 365) as any;
    });

    const { result } = await renderHook(() =>
      useMyTravels({ userId: 'u-1', perPage: 20, includeDrafts: true })
    );
    await act(async () => {
      await result.current.load();
    });

    expect(result.current.publicationCounts).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.myTravels).toHaveLength(2);
  });

  it.each([0, 1000])('ограничивает серверный счётчик черновиков общим количеством (%s)', async drafts => {
    mockFetchMyTravels.mockImplementation(async params =>
      (isDraftCountRequest(params) ? page([1], drafts, 'draft') : page([1, 2], 40)) as any
    );
    const { result } = await renderHook(() => useMyTravels({ userId: 'u-1', perPage: 20, includeDrafts: true }));
    await act(async () => { await result.current.load(); });
    expect(result.current.publicationCounts).toEqual({ published: drafts === 0 ? 40 : 0, drafts: drafts === 0 ? 0 : 40 });
  });

  it('подгрузка сохраняет серверную сводку и не запрашивает разбивку заново', async () => {
    mockFetchMyTravels.mockImplementation(async params => {
      if (isDraftCountRequest(params)) return page([1], 1, 'draft') as any;
      return {
        ...page(params.page === 1 ? [1, 2] : params.page === 2 ? [2, 3] : [4], 4),
        engagementSummary: { favoritesCount: 50, wishlistCount: 20, visitedCount: 10, plannedCount: 5 },
      } as any;
    });
    const { result } = await renderHook(() => useMyTravels({ userId: 'u-1', perPage: 2, includeDrafts: true }));
    await act(async () => { await result.current.load(); });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasMore).toBe(true);
    });
    await act(async () => { await result.current.loadMore(); });
    expect(mockFetchMyTravels).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    await waitFor(() => expect(result.current.myTravels.map(t => t.id)).toEqual([1, 2, 3]));
    expect(result.current.engagementSummary).toEqual({ favoritesCount: 50, wishlistCount: 20, visitedCount: 10, plannedCount: 5 });
    expect(result.current.publicationCounts).toEqual({ published: 3, drafts: 1 });
    expect(result.current.hasMore).toBe(true);
    await act(async () => { await result.current.loadMore(); });
    await waitFor(() => expect(result.current.myTravels.map(t => t.id)).toEqual([1, 2, 3, 4]));
    expect(result.current.hasMore).toBe(false);
    expect(mockFetchMyTravels.mock.calls.filter(([params]) => isDraftCountRequest(params))).toHaveLength(1);
  });

  it.each(['cancel', '403', '404', 'success'] as const)('удаление %s сохраняет правильные строки и серверную разбивку', async outcome => {
    let deleted = false;
    mockFetchMyTravels.mockImplementation(async params => {
      if (isDraftCountRequest(params)) return page(deleted ? [] : [1], deleted ? 0 : 1, 'draft') as any;
      return {
        data: [
          ...(!deleted ? [{ id: 1, name: 'Draft', slug: 'draft', publication_status: 'draft', favoritesCount: 3 }] : []),
          { id: 2, name: 'Published', slug: 'published', publication_status: 'published', favoritesCount: 7 },
        ], total: deleted ? 1 : 2,
        engagementSummary: { favoritesCount: deleted ? 7 : 10, wishlistCount: 0, visitedCount: 0, plannedCount: 0 },
      } as any;
    });
    const { result } = await renderHook(() => useMyTravels({ userId: 'u-1', perPage: 20, includeDrafts: true }));
    await act(async () => { await result.current.load(); });
    await waitFor(() => expect(result.current.publicationCounts).toEqual({ published: 1, drafts: 1 }));
    mockConfirmAction.mockResolvedValue(outcome !== 'cancel');
    let resolveDelete!: () => void;
    let rejectDelete!: (error: Error) => void;
    const pending = new Promise<void>((yes, no) => { resolveDelete = yes; rejectDelete = no; });
    mockDeleteTravel.mockReturnValue(pending as any);
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      let removing!: Promise<boolean>;
      await act(() => { removing = result.current.remove(1); });
      if (outcome === 'cancel') {
        await act(async () => { await expect(removing).resolves.toBe(false); });
        expect(mockDeleteTravel).not.toHaveBeenCalled();
        expect(result.current.myTravels.map(t => t.id)).toEqual([1, 2]);
        expect(result.current.publicationCounts).toEqual({ published: 1, drafts: 1 });
        return;
      }
      await waitFor(() => expect(result.current.myTravels.map(t => t.id)).toEqual([2]));
      expect(result.current.publicationCounts).toEqual({ published: 1, drafts: 0 });
      expect(result.current.engagementSummary?.favoritesCount).toBe(7);
      // Duplicate taps may confirm again, but must not dispatch a second DELETE.
      await act(async () => { await expect(result.current.remove(1)).resolves.toBe(false); });
      expect(mockDeleteTravel).toHaveBeenCalledTimes(1);
      await act(async () => {
        if (outcome === '403') rejectDelete(Object.assign(new Error('Forbidden'), { status: 403 }));
        else {
          deleted = true;
          if (outcome === '404') rejectDelete(Object.assign(new Error('Not found'), { status: 404 }));
          else resolveDelete();
        }
        await expect(removing).resolves.toBe(outcome !== '403');
      });
      expect(result.current.myTravels.map(t => t.id)).toEqual(outcome === '403' ? [1, 2] : [2]);
      expect(result.current.publicationCounts).toEqual({ published: 1, drafts: outcome === '403' ? 1 : 0 });
      expect(result.current.engagementSummary?.favoritesCount).toBe(outcome === '403' ? 10 : 7);
    } finally { log.mockRestore(); }
  });

  it('не возвращает старый отказ после DELETE503, если новый GET подтвердил те же оптимистичные данные', async () => {
    let serverConfirmsGone = false;
    const privateReason = 'Private rejected route must stay gone';
    mockFetchMyTravels.mockImplementation(async params => {
      if (isDraftCountRequest(params)) return page(serverConfirmsGone ? [] : [1], serverConfirmsGone ? 0 : 1, 'draft') as any;
      return {
        data: [
          ...(!serverConfirmsGone ? [{
            id: 1, name: 'Rejected draft', slug: 'rejected-draft', publication_status: 'draft',
            moderation_decision: 'rejected', moderation_decision_reason: privateReason,
            moderation_decided_at: '2026-10-20T09:00:00Z', favoritesCount: 3,
          }] : []),
          { id: 2, name: 'Published', slug: 'published', publication_status: 'published', favoritesCount: 7 },
        ], total: serverConfirmsGone ? 1 : 2,
        engagementSummary: { favoritesCount: serverConfirmsGone ? 7 : 10, wishlistCount: 0, visitedCount: 0, plannedCount: 0 },
      } as any;
    });
    const onTotalChange = jest.fn();
    const { result } = await renderHook(() => useMyTravels({ userId: 'u-1', perPage: 20, includeDrafts: true, onTotalChange }));
    await act(async () => { await result.current.load(); });
    await waitFor(() => expect(result.current.myTravels.map(t => t.id)).toEqual([1, 2]));
    expect(result.current.publicationCounts).toEqual({ published: 1, drafts: 1 });
    mockConfirmAction.mockResolvedValue(true);
    let rejectDelete!: (error: Error) => void;
    const pendingDelete = new Promise<void>((_yes, no) => { rejectDelete = no; });
    mockDeleteTravel.mockReturnValue(pendingDelete as any);
    let removing!: Promise<boolean>;
    await act(() => { removing = result.current.remove(1); });
    await waitFor(() => expect(mockDeleteTravel).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.myTravels.map(t => t.id)).toEqual([2]));
    expect(result.current.publicationCounts).toEqual({ published: 1, drafts: 0 });
    expect(result.current.engagementSummary?.favoritesCount).toBe(7);

    const client = [...queryClients].at(-1)!;
    const key = queryKeys.authorTravels('u-1', 'u-1', { perPage: 20, includeDrafts: true });
    const originQuery = client.getQueryCache().find({ queryKey: key, exact: true })!;
    const optimisticData = client.getQueryData(key);
    const optimisticUpdateCount = originQuery.state.dataUpdateCount;
    serverConfirmsGone = true;
    // A real successful refetch returns a semantically identical page. TanStack
    // retains its reference through structural sharing, while confirmation advances.
    await act(async () => { await invalidateTravelCollections(client, 'u-1'); });
    expect(client.getQueryCache().find({ queryKey: key, exact: true })).toBe(originQuery);
    expect(client.getQueryData(key)).toBe(optimisticData);
    expect(originQuery.state.dataUpdateCount).toBeGreaterThan(optimisticUpdateCount);
    expect(result.current.error).toBeNull();

    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await act(async () => {
        rejectDelete(Object.assign(new Error('Intentional delete 503'), { status: 503 }));
        await expect(removing).resolves.toBe(false);
      });
      // An error may be reported, but a newer server-confirmed disappearance wins.
      expect(result.current.myTravels.map(t => t.id)).toEqual([2]);
      expect(result.current.publicationCounts).toEqual({ published: 1, drafts: 0 });
      expect(result.current.engagementSummary?.favoritesCount).toBe(7);
      expect(onTotalChange).toHaveBeenLastCalledWith(1);
      expect(result.current.removingTravelId).toBeNull();
      expect(client.getQueryData(key)).toBe(optimisticData);
      expect(JSON.stringify(client.getQueryData(key))).not.toContain(privateReason);
      expect(mockDeleteTravel).toHaveBeenCalledTimes(1);
    } finally { log.mockRestore(); }
  });
});

describe('#2669 — author-block publication counts', () => {
  afterEach(() => { resetBlockedAuthorStateForTests(); });

  const coauthoredRows = () => [
    { id: 1, publication_status: 'published', userIds: '1' },
    { id: 2, publication_status: 'draft', userIds: '1' },
    { id: 3, publication_status: 'draft', userIds: '1,2' },
    { id: 4, publication_status: 'pending_review', userIds: '1,2' },
    { id: 5, publication_status: 'draft', userIds: '1' },
    { id: 6, publication_status: 'approved', userIds: '1' },
  ].map(row => ({ ...row, name: `Travel ${row.id}`, slug: `t-${row.id}` }));

  it.each([
    { perPage: 6, draftProbe: 4 }, { perPage: 2, draftProbe: 4 },
    { perPage: 6, draftProbe: 2 }, { perPage: 2, draftProbe: 2 },
  ])('keeps complete visible counts with stale list/current probe (perPage=$perPage, probe=$draftProbe)', async ({ perPage, draftProbe }) => {
    const all = coauthoredRows();
    mockFetchMyTravels.mockImplementation(async params => {
      if (isDraftCountRequest(params)) return { data: [all[1]], total: draftProbe } as any;
      const start = ((params.page ?? 1) - 1) * perPage;
      return { data: all.slice(start, start + perPage), total: 6,
        engagementSummary: { favoritesCount: 21, wishlistCount: 0, visitedCount: 0, plannedCount: 0 } } as any;
    });
    const onTotalChange = jest.fn();
    const { result } = await renderHook(() => useMyTravels({ userId: '1', perPage, includeDrafts: true, onTotalChange }));
    const client = [...queryClients].at(-1)!;
    client.setQueryData(queryKeys.myBlockedUsers('u-1'), [{ user: 2 }]);
    const uninstall = installBlockedAuthorGuard(client, { getOwner: () => 'u-1' });
    try {
      await act(async () => { await result.current.load(); });
      if (perPage === 2) {
        // Unloaded rows still belong to the server count, not the first page.
        expect(result.current.publicationCounts).toEqual({ published: 6 - draftProbe, drafts: draftProbe });
        await act(async () => { await result.current.loadMore(); });
      }
      await waitFor(() => expect(result.current.myTravels.map(travel => travel.id)).toEqual([1, 2, 5, 6]));
      expect(result.current.publicationCounts).toEqual({ published: 2, drafts: 2 });
      expect(result.current.publicationCountsUnavailable).toBe(false);
      expect(result.current.engagementSummary).toBeNull();
      expect(onTotalChange).toHaveBeenLastCalledWith(4);
      expect(result.current.hasMore).toBe(false);
      expect(mockFetchMyTravels.mock.calls.filter(([params]) => isDraftCountRequest(params))).toHaveLength(1);
      expect(mockFetchMyTravels.mock.calls.filter(([params]) => !isDraftCountRequest(params)).map(([params]) => params.page))
        .toEqual(perPage === 6 ? [1] : [1, 2, 3]);
    } finally { uninstall(); }
  });

  it('keeps incomplete stripped counts unavailable until authoritative refresh, without downloading every page', async () => {
    let serverUsesCurrentBlockPolicy = false;
    const all = [
      { id: 1, publication_status: 'published', userIds: '1' },
      { id: 2, publication_status: 'draft', userIds: '1,2' },
      { id: 3, publication_status: 'draft', userIds: '1,2' },
      { id: 4, publication_status: 'pending_review', userIds: '1' },
      { id: 5, publication_status: 'draft', userIds: '1' },
      { id: 6, publication_status: 'published', userIds: '1' },
    ].map(row => ({ ...row, name: `Travel ${row.id}`, slug: `t-${row.id}` }));
    mockFetchMyTravels.mockImplementation(async params => {
      // The count probe already uses the current policy; the list is stale.
      if (isDraftCountRequest(params)) return { data: [all[3]], total: 2 } as any;
      const selected = serverUsesCurrentBlockPolicy ? all.filter(row => row.userIds === '1') : all;
      const start = ((params.page ?? 1) - 1) * 2;
      return { data: selected.slice(start, start + 2), total: selected.length,
        engagementSummary: { favoritesCount: serverUsesCurrentBlockPolicy ? 14 : 21, wishlistCount: 0, visitedCount: 0, plannedCount: 0 } } as any;
    });
    const onTotalChange = jest.fn();
    const { result } = await renderHook(() => useMyTravels({ userId: '1', perPage: 2, includeDrafts: true, onTotalChange }));
    const client = [...queryClients].at(-1)!;
    client.setQueryData(queryKeys.myBlockedUsers('u-1'), [{ user: 2 }]);
    const uninstall = installBlockedAuthorGuard(client, { getOwner: () => 'u-1' });
    try {
      await act(async () => { await result.current.load(); });
      await waitFor(() => expect(result.current.myTravels.map(travel => travel.id)).toEqual([1]));
      expect(result.current.error).toBeNull();
      expect(result.current.hasMore).toBe(true);
      expect(result.current.publicationCounts).toBeNull();
      expect(result.current.publicationCountsUnavailable).toBe(true);
      expect(result.current.engagementSummary).toBeNull();
      expect(onTotalChange).toHaveBeenLastCalledWith(null);
      expect(mockFetchMyTravels.mock.calls.filter(([params]) => !isDraftCountRequest(params))).toHaveLength(1);

      serverUsesCurrentBlockPolicy = true;
      await act(async () => { await result.current.load(); });
      await waitFor(() => expect(result.current.myTravels.map(travel => travel.id)).toEqual([1, 4]));
      expect(result.current.publicationCounts).toEqual({ published: 2, drafts: 2 });
      expect(result.current.publicationCountsUnavailable).toBe(false);
      expect(result.current.engagementSummary?.favoritesCount).toBe(14);
      expect(onTotalChange).toHaveBeenLastCalledWith(4);
      expect(result.current.hasMore).toBe(true);
      expect(mockFetchMyTravels.mock.calls.filter(([params]) => !isDraftCountRequest(params)).map(([params]) => params.page)).toEqual([1, 1]);
    } finally { uninstall(); }
  });

  it.each(['403', 'success'] as const)('keeps per-page served metadata during optimistic DELETE %s after client stripping', async outcome => {
    let deleted = false;
    const all = coauthoredRows();
    mockFetchMyTravels.mockImplementation(async params => {
      if (isDraftCountRequest(params)) return { data: [all[1]], total: deleted ? 1 : 4 } as any;
      const selected = deleted ? all.filter(row => row.id !== 2 && row.userIds === '1') : all;
      const start = ((params.page ?? 1) - 1) * 2;
      return { data: selected.slice(start, start + 2), total: selected.length } as any;
    });
    const { result } = await renderHook(() => useMyTravels({ userId: '1', perPage: 2, includeDrafts: true }));
    const client = [...queryClients].at(-1)!;
    client.setQueryData(queryKeys.myBlockedUsers('u-1'), [{ user: 2 }]);
    const uninstall = installBlockedAuthorGuard(client, { getOwner: () => 'u-1' });
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await act(async () => { await result.current.load(); });
      await act(async () => { await result.current.loadMore(); });
      await waitFor(() => expect(result.current.myTravels.map(travel => travel.id)).toEqual([1, 2, 5, 6]));
      mockConfirmAction.mockResolvedValue(true);
      let resolveDelete!: () => void;
      let rejectDelete!: (error: Error) => void;
      mockDeleteTravel.mockReturnValue(new Promise<void>((yes, no) => { resolveDelete = yes; rejectDelete = no; }) as any);
      let removing!: Promise<boolean>;
      await act(() => { removing = result.current.remove(2); });
      await waitFor(() => expect(mockDeleteTravel).toHaveBeenCalledTimes(1));
      const key = queryKeys.authorTravels('u-1', '1', { perPage: 2, includeDrafts: true });
      const optimistic = client.getQueryData<{ pages: Array<{ total: number; draftsCount: number | null }> }>(key)!;
      expect(optimistic.pages.map(value => value.total)).toEqual([5, 3, 5]);
      expect(optimistic.pages[0].draftsCount).toBe(3);
      expect(result.current.publicationCounts).toEqual({ published: 2, drafts: 1 });
      await act(async () => {
        if (outcome === '403') rejectDelete(Object.assign(new Error('Forbidden'), { status: 403 }));
        else { deleted = true; resolveDelete(); }
        await expect(removing).resolves.toBe(outcome === 'success');
      });
      expect(result.current.myTravels.map(travel => travel.id)).toEqual(outcome === '403' ? [1, 2, 5, 6] : [1, 5]);
      expect(result.current.publicationCounts).toEqual({ published: 2, drafts: outcome === '403' ? 2 : 1 });
      if (outcome === '403') {
        expect(client.getQueryData<{ pages: Array<{ total: number }> }>(key)?.pages.map(value => value.total)).toEqual([6, 4, 6]);
      }
    } finally { uninstall(); log.mockRestore(); }
  });
});


// Isolated real QueryClient: cache lifecycle is part of the hook contract.
const queryClients = new Set<QueryClient>();
const renderHook: typeof renderQueryHook = async (callback, options) => {
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
