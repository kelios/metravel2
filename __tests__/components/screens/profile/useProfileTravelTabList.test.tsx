// #1833: открытие вкладки «Опубл.»/«Черновики» стоило ~18 запросов — профиль
// скачивал весь каталог автора страницами. Вкладка обязана обходиться одним
// запросом своего среза, а повторное открытие — нулём.

import { act, renderHook } from '@testing-library/react-native';

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

const renderTabList = (activeTab: string, allTravels: UseMyTravelsResult, onAfterRemove = jest.fn()) =>
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
  it('на вкладке «Маршруты» отдаёт общий список автора и ничего не запрашивает', () => {
    const allTravels = createAllTravels();

    const { result } = renderTabList('travels', allTravels);

    expect(result.current.isFiltered).toBe(false);
    expect(result.current.travels).toBe(allTravels.myTravels);
    expect(mockFetchMyTravels).not.toHaveBeenCalled();
  });

  it('открытие «Черновиков» стоит одного запроса со своим фильтром', async () => {
    const allTravels = createAllTravels();

    const { result } = renderTabList('draftTravels', allTravels);
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

    const { rerender } = renderTabList('draftTravels', allTravels);
    await act(async () => {});
    expect(mockFetchMyTravels).toHaveBeenCalledTimes(1);

    rerender({ tab: 'travels' });
    await act(async () => {});
    rerender({ tab: 'draftTravels' });
    await act(async () => {});

    expect(mockFetchMyTravels).toHaveBeenCalledTimes(1);
  });

  it('каждый статус читает свой срез отдельным запросом', async () => {
    const allTravels = createAllTravels();

    const { rerender } = renderTabList('draftTravels', allTravels);
    await act(async () => {});
    rerender({ tab: 'publishedTravels' });
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

    const { result } = renderTabList('draftTravels', allTravels, onAfterRemove);
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

    const { result } = renderTabList('draftTravels', allTravels, onAfterRemove);
    await act(async () => {});

    await act(async () => {
      await result.current.remove(10);
    });

    expect(mockDeleteTravel).not.toHaveBeenCalled();
    expect(onAfterRemove).not.toHaveBeenCalled();
  });
});
