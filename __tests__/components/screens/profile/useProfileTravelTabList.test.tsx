// #1833: открытие вкладки «Опубл.»/«Черновики» стоило ~18 запросов — профиль
// скачивал весь каталог автора страницами. Вкладка обязана обходиться одним
// запросом своего среза, а повторное открытие — нулём.

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook as renderQueryHook, waitFor } from '@testing-library/react-native';

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

jest.mock('@/utils/confirmAction', () => ({
  confirmAction: jest.fn(),
}));

import { deleteTravel, fetchMyTravels } from '@/api/travelsApi';
import { useProfileTravelTabList } from '@/components/screens/profile/useProfileTravelTabList';
import type { UseMyTravelsResult } from '@/hooks/useMyTravels';
import { confirmAction } from '@/utils/confirmAction';
import { invalidateTravelCollections } from '@/utils/travelQueryInvalidation';

const mockFetchMyTravels = fetchMyTravels as jest.MockedFunction<typeof fetchMyTravels>;
const mockDeleteTravel = deleteTravel as jest.MockedFunction<typeof deleteTravel>;
const mockConfirmAction = confirmAction as jest.MockedFunction<typeof confirmAction>;

const page = (ids: number[], total: number, publicationStatus: string) => ({
  data: ids.map((id) => ({
    id,
    name: `Travel ${id}`,
    slug: `t-${id}`,
    url: `/travels/${id}`,
    publication_status: publicationStatus,
  })),
  total,
});

const createAllTravels = (overrides: Partial<UseMyTravelsResult> = {}): UseMyTravelsResult => ({
  myTravels: [{ id: 1, name: 'Общий список' } as any],
  engagementSummary: null,
  publicationCounts: null,
  publicationCountsUnavailable: false,
  isLoading: false,
  isLoadingMore: false,
  removingTravelId: null,
  hasMore: true,
  error: null,
  load: jest.fn(async () => {}),
  loadMore: jest.fn(async () => {}),
  remove: jest.fn(async () => true),
  ...overrides,
});

const renderTabList = async (activeTab: string, allTravels: UseMyTravelsResult, onAfterRemove = jest.fn()) =>
  renderHook(
    ({ tab }: { tab: string }) =>
      useProfileTravelTabList({
        activeTab: tab as any,
        userId: 'u-1',
        perPage: 20,
        allTravels,
        onAfterRemove,
      }),
    { initialProps: { tab: activeTab } }
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchMyTravels.mockImplementation(async (params: any) =>
    page([params.page * 10], 65, params.publicationStatus?.[0] === 'draft' ? 'draft' : 'published') as any
  );
});

describe('useProfileTravelTabList', () => {
  it('на вкладке «Маршруты» отдаёт общий список автора и ничего не запрашивает', async () => {
    const allTravels = createAllTravels();

    const { result } = await renderTabList('travels', allTravels);

    expect(result.current.isFiltered).toBe(false);
    expect(result.current.travels).toBe(allTravels.myTravels);
    expect(mockFetchMyTravels).not.toHaveBeenCalled();
  });

  it('открытие «Черновиков» стоит одного запроса со своим фильтром', async () => {
    const allTravels = createAllTravels();

    const { result } = await renderTabList('draftTravels', allTravels);
    await act(async () => {});

    expect(mockFetchMyTravels).toHaveBeenCalledTimes(1);
    expect(mockFetchMyTravels).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 20, publicationStatus: ['draft', 'pending_review'] })
    );
    expect(result.current.isFiltered).toBe(true);
    expect(result.current.travels.map((travel) => travel.id)).toEqual([10]);
    // Общий список остаётся нетронутым: его страницы вкладке-срезу не нужны.
    expect(allTravels.load).not.toHaveBeenCalled();
    expect(allTravels.loadMore).not.toHaveBeenCalled();
  });

  it('возврат на уже открытую вкладку не повторяет запрос', async () => {
    const allTravels = createAllTravels();

    const { rerender } = await renderTabList('draftTravels', allTravels);
    await act(async () => {});
    expect(mockFetchMyTravels).toHaveBeenCalledTimes(1);

    await rerender({ tab: 'travels' });
    await act(async () => {});
    await rerender({ tab: 'draftTravels' });
    await act(async () => {});

    expect(mockFetchMyTravels).toHaveBeenCalledTimes(1);
  });

  it('каждый статус читает свой срез отдельным запросом', async () => {
    const allTravels = createAllTravels();

    const { rerender } = await renderTabList('draftTravels', allTravels);
    await act(async () => {});
    await rerender({ tab: 'publishedTravels' });
    await act(async () => {});

    expect(mockFetchMyTravels).toHaveBeenCalledTimes(2);
    expect(mockFetchMyTravels).toHaveBeenLastCalledWith(
      expect.objectContaining({ publicationStatus: ['approved', 'published'] })
    );
  });

  it('после удаления в срезе перечитывает общий список — в нём счётчики профиля', async () => {
    const allTravels = createAllTravels();
    const onAfterRemove = jest.fn();
    mockConfirmAction.mockResolvedValue(true);
    mockDeleteTravel.mockResolvedValue(undefined as any);

    const { result } = await renderTabList('draftTravels', allTravels, onAfterRemove);
    await act(async () => {});

    await act(async () => {
      await result.current.remove(10);
    });

    expect(mockDeleteTravel).toHaveBeenCalledWith(10);
    expect(onAfterRemove).toHaveBeenCalledTimes(1);
    // Удаление на вкладке общего списка общий список и перечитывает — второй раз незачем.
    expect(allTravels.remove).not.toHaveBeenCalled();
  });

  it('отменённое удаление общий список не трогает', async () => {
    const allTravels = createAllTravels();
    const onAfterRemove = jest.fn();
    mockConfirmAction.mockResolvedValue(false);

    const { result } = await renderTabList('draftTravels', allTravels, onAfterRemove);
    await act(async () => {});

    await act(async () => {
      await result.current.remove(10);
    });

    expect(mockDeleteTravel).not.toHaveBeenCalled();
    expect(onAfterRemove).not.toHaveBeenCalled();
  });

  it('подтверждённая смена статуса обновляет уже посещённые вкладки до возврата на них', async () => {
    let published = false;
    mockFetchMyTravels.mockImplementation(async params => {
      const isPublished = params.publicationStatus?.includes('published');
      return page(isPublished === published ? [10] : [], isPublished === published ? 1 : 0, published ? 'published' : 'draft') as any;
    });
    const { result, rerender } = await renderTabList('draftTravels', createAllTravels());
    await waitFor(() => expect(result.current.travels.map(t => t.id)).toEqual([10]));
    await rerender({ tab: 'publishedTravels' });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.travels).toEqual([]);
    await rerender({ tab: 'travels' });
    published = true;
    await act(async () => { await invalidateTravelCollections([...queryClients].at(-1)!, 'u-1'); });
    const readsAfterInvalidation = mockFetchMyTravels.mock.calls.length;
    await rerender({ tab: 'draftTravels' });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.travels).toEqual([]);
    await rerender({ tab: 'publishedTravels' });
    await waitFor(() => expect(result.current.travels.map(t => t.id)).toEqual([10]));
    expect(result.current.travels[0].publication_status).toBe('published');
    // Returning is cache use, not a compensating reload that hides stale data.
    expect(mockFetchMyTravels).toHaveBeenCalledTimes(readsAfterInvalidation);
  });

  it('инвалидация посещённого среза не загружает ещё не открытую вкладку', async () => {
    let status = 'draft';
    mockFetchMyTravels.mockImplementation(async params => {
      const selected = params.publicationStatus?.includes(status);
      return page(selected ? [10] : [], selected ? 1 : 0, status) as any;
    });
    const { result, rerender } = await renderTabList('draftTravels', createAllTravels());
    await waitFor(() => expect(result.current.travels).toHaveLength(1));
    status = 'published';
    await act(async () => { await invalidateTravelCollections([...queryClients].at(-1)!, 'u-1'); });
    expect(result.current.travels).toEqual([]);
    expect(mockFetchMyTravels.mock.calls.filter(([p]) => p.publicationStatus?.includes('published'))).toHaveLength(0);
    await rerender({ tab: 'publishedTravels' });
    await waitFor(() => expect(result.current.travels.map(t => t.id)).toEqual([10]));
    expect(result.current.travels[0].publication_status).toBe('published');
    expect(mockFetchMyTravels.mock.calls.filter(([p]) => p.publicationStatus?.includes('published'))).toHaveLength(1);
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
