// #1833: вкладки «Опубл.» и «Черновики» были клиентским срезом общего списка,
// и ради полноты фильтра профиль скачивал весь каталог автора (365 маршрутов —
// ~18 запросов подряд). Срез обязан просить у сервера только свой статус и
// листаться страницами того же фильтра.

import { renderHook, act } from '@testing-library/react-native';

jest.mock('@/api/travelsApi', () => ({
  fetchMyTravels: jest.fn(),
  deleteTravel: jest.fn(),
  unwrapMyTravelsPayload: jest.requireActual('@/api/travelUserQueries').unwrapMyTravelsPayload,
}));

jest.mock('@/utils/toast', () => ({
  showToastMessage: jest.fn(),
}));

import { useMyTravels } from '@/hooks/useMyTravels';
import { fetchMyTravels } from '@/api/travelsApi';
import { DRAFT_PUBLICATION_STATUSES } from '@/utils/travelPublicationStatus';

const mockFetchMyTravels = fetchMyTravels as jest.MockedFunction<typeof fetchMyTravels>;

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
    expect(result.current.myTravels).toHaveLength(4);
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
});
