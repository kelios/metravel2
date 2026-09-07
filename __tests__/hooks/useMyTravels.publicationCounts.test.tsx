// Вкладки «Опубл.» и «Черновики» показывали разбивку ПЕРВОЙ СТРАНИЦЫ: при 365
// маршрутах в профиле стояло 15 и 5 — ровно perPage=20, потому что статусы
// считались по загруженным элементам. Разбивку берём с сервера.

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

const mockFetchMyTravels = fetchMyTravels as jest.MockedFunction<typeof fetchMyTravels>;

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

    const { result } = renderHook(() =>
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

    const { result } = renderHook(() =>
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

    const { result } = renderHook(() =>
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

    const { result } = renderHook(() =>
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

    const { result } = renderHook(() => useMyTravels({ userId: 'u-1', perPage: 20 }));
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

    const { result } = renderHook(() =>
      useMyTravels({ userId: 'u-1', perPage: 20, includeDrafts: true })
    );
    await act(async () => {
      await result.current.load();
    });

    expect(result.current.publicationCounts).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.myTravels).toHaveLength(2);
  });
});
