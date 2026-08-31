import { apiClient, ApiError } from '@/api/client';
import {
  fetchQuestsList,
  fetchQuestsPreview,
  fetchQuestByQuestId,
  fetchOrCreateProgress,
  createProgress,
  updateProgress,
  deleteProgress,
  fetchAllProgress,
  fetchQuestReviews,
} from '@/api/quests';

jest.mock('@/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    data?: any;
    constructor(status: number, message: string, data?: any) {
      super(message);
      this.status = status;
      this.data = data;
      this.name = 'ApiError';
    }
  },
}));

const mockedGet = apiClient.get as jest.MockedFunction<typeof apiClient.get>;
const mockedPost = apiClient.post as jest.MockedFunction<typeof apiClient.post>;
const mockedPatch = apiClient.patch as jest.MockedFunction<typeof apiClient.patch>;
const mockedDelete = apiClient.delete as jest.MockedFunction<typeof apiClient.delete>;

/** Даёт отработать уже поставленным в очередь промисам, ничего не резолвя за них. */
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

const MOCK_PROGRESS = {
  id: 42,
  quest: 1,
  user: 10,
  current_index: 2,
  unlocked_index: 3,
  answers: { 'step-1': 'дракон' },
  attempts: { 'step-1': 1 },
  hints: {},
  show_map: true,
  completed: false,
  completed_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('api/quests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchQuestsList', () => {
    it('calls GET /quests/ with the maximum page size', async () => {
      mockedGet.mockResolvedValueOnce([]);
      const result = await fetchQuestsList();
      expect(mockedGet).toHaveBeenCalledWith('/quests/?page_size=100');
      expect(result).toEqual([]);
    });

    // Каталог из 139 квестов при дефолтных 20 записях уходил семью
    // последовательными запросами на каждый экран со списком.
    it('keeps the page size while following the next page', async () => {
      mockedGet
        .mockResolvedValueOnce({
          results: [{ id: 1, quest_id: 'krakow-dragon' }],
          next: 'https://metravel.by/api/quests/?page=2&page_size=100',
        })
        .mockResolvedValueOnce({ results: [{ id: 2, quest_id: 'pakocim-voices' }], next: null });

      const result = await fetchQuestsList();

      expect(mockedGet).toHaveBeenCalledTimes(2);
      expect(mockedGet).toHaveBeenNthCalledWith(1, '/quests/?page_size=100');
      expect(mockedGet).toHaveBeenNthCalledWith(2, '/quests/?page_size=100&page=2');
      expect(result.map((quest) => quest.quest_id)).toEqual(['krakow-dragon', 'pakocim-voices']);
    });

    // #1659: номер следующей страницы известен только из ответа предыдущей,
    // поэтому одного `count` мало — на каталоге ровно в две страницы вторая
    // всё равно уходила бы после первой. Просим её сразу.
    it('asks the second catalog page without waiting for the first', async () => {
      const pending: Array<(value: unknown) => void> = [];
      mockedGet
        // Именно `Once`: `jest.clearAllMocks()` чистит вызовы, но не реализацию,
        // и постоянный `mockImplementation` утёк бы в следующие тесты файла.
        .mockImplementationOnce(() => new Promise<any>((resolve) => { pending.push(resolve); }))
        .mockImplementationOnce(() => new Promise<any>((resolve) => { pending.push(resolve); }));

      const promise = fetchQuestsList();
      await flushMicrotasks();

      // Ни один ответ ещё не пришёл, а вторая страница уже запрошена.
      expect(mockedGet).toHaveBeenCalledTimes(2);
      expect(mockedGet).toHaveBeenNthCalledWith(1, '/quests/?page_size=100');
      expect(mockedGet).toHaveBeenNthCalledWith(2, '/quests/?page_size=100&page=2');

      pending[1]({ results: [{ id: 2, quest_id: 'pakocim-voices' }], count: 2, next: null });
      pending[0]({
        results: [{ id: 1, quest_id: 'krakow-dragon' }],
        count: 2,
        next: 'https://metravel.by/api/quests/?page=2&page_size=100',
      });

      const result = await promise;
      expect(mockedGet).toHaveBeenCalledTimes(2);
      expect(result.map((quest) => quest.quest_id)).toEqual(['krakow-dragon', 'pakocim-voices']);
    });

    // Каталог длиннее двух страниц: остаток тоже уходит одним заходом.
    it('reads the remaining pages in one go once the total is known', async () => {
      const pending: Array<(value: unknown) => void> = [];
      const defer = () => new Promise<any>((resolve) => { pending.push(resolve); });
      mockedGet
        .mockResolvedValueOnce({
          results: [{ id: 1, quest_id: 'a' }],
          count: 4,
          next: 'https://metravel.by/api/quests/?page=2&page_size=100',
        })
        .mockResolvedValueOnce({
          results: [{ id: 2, quest_id: 'b' }],
          next: 'https://metravel.by/api/quests/?page=3&page_size=100',
        })
        .mockImplementationOnce(defer)
        .mockImplementationOnce(defer);

      const promise = fetchQuestsList();
      await flushMicrotasks();

      // Четвёртая страница запрошена, хотя третья ещё не ответила.
      expect(mockedGet).toHaveBeenCalledTimes(4);
      expect(mockedGet).toHaveBeenNthCalledWith(4, '/quests/?page_size=100&page=4');

      // Порядок записей не зависит от порядка ответов.
      pending[1]({ results: [{ id: 4, quest_id: 'd' }], next: null });
      pending[0]({ results: [{ id: 3, quest_id: 'c' }], next: null });

      const result = await promise;
      expect(result.map((quest) => quest.quest_id)).toEqual(['a', 'b', 'c', 'd']);
    });

    // Бэкенд вправе урезать запрошенный `page_size` своим максимумом —
    // считаем страницы по фактической длине первой, иначе хвост потеряется.
    it('counts pages from the actual page length, not the requested one', async () => {
      mockedGet
        .mockResolvedValueOnce({
          results: [{ id: 1, quest_id: 'a' }, { id: 2, quest_id: 'b' }],
          count: 5,
          next: 'https://metravel.by/api/quests/?page=2&page_size=100',
        })
        .mockResolvedValueOnce({
          results: [{ id: 3, quest_id: 'c' }, { id: 4, quest_id: 'd' }],
          next: 'https://metravel.by/api/quests/?page=3&page_size=100',
        })
        .mockResolvedValueOnce({ results: [{ id: 5, quest_id: 'e' }], next: null });

      const result = await fetchQuestsList();

      expect(mockedGet).toHaveBeenCalledTimes(3);
      expect(result.map((quest) => quest.quest_id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    // Размер выборки разошёлся с тем, что бэкенд реально отдаёт: третья
    // страница видна только по ссылке `next`, её и дочитываем.
    it('reads the tail sequentially when the reported total is too small', async () => {
      mockedGet
        .mockResolvedValueOnce({
          results: [{ id: 1, quest_id: 'a' }],
          count: 2,
          next: 'https://metravel.by/api/quests/?page=2&page_size=100',
        })
        .mockResolvedValueOnce({
          results: [{ id: 2, quest_id: 'b' }],
          next: 'https://metravel.by/api/quests/?page=3&page_size=100',
        })
        .mockResolvedValueOnce({ results: [{ id: 3, quest_id: 'c' }], next: null });

      const result = await fetchQuestsList();

      expect(mockedGet).toHaveBeenCalledTimes(3);
      expect(mockedGet).toHaveBeenNthCalledWith(3, '/quests/?page_size=100&page=3');
      expect(result.map((quest) => quest.quest_id)).toEqual(['a', 'b', 'c']);
    });

    // Каталог усох до одной страницы: у DRF несуществующая страница — 404,
    // и упреждающий запрос не имеет права уронить весь каталог.
    it('survives the speculative page when the catalog fits a single one', async () => {
      mockedGet
        .mockResolvedValueOnce({ results: [{ id: 1, quest_id: 'krakow-dragon' }], count: 1, next: null })
        .mockRejectedValueOnce(new ApiError(404, 'Invalid page'));

      const result = await fetchQuestsList();

      expect(mockedGet).toHaveBeenCalledTimes(2);
      expect(result.map((quest) => quest.quest_id)).toEqual(['krakow-dragon']);
    });
  });

  describe('fetchQuestsPreview', () => {
    // Промо-блок главной показывает две карточки — весь каталог ему не нужен.
    it('asks for exactly the requested slice in a single request', async () => {
      mockedGet.mockResolvedValueOnce({
        results: [
          { id: 1, quest_id: 'krakow-dragon' },
          { id: 2, quest_id: 'pakocim-voices' },
        ],
        next: 'https://metravel.by/api/quests/?page=2&page_size=2',
      });

      const result = await fetchQuestsPreview(2);

      expect(mockedGet).toHaveBeenCalledTimes(1);
      expect(mockedGet).toHaveBeenCalledWith('/quests/?page_size=2', undefined, undefined);
      expect(result.map((quest) => quest.quest_id)).toEqual(['krakow-dragon', 'pakocim-voices']);
    });

    it('never returns more than the requested limit', async () => {
      mockedGet.mockResolvedValueOnce([
        { id: 1, quest_id: 'krakow-dragon' },
        { id: 2, quest_id: 'pakocim-voices' },
        { id: 3, quest_id: 'minsk-cmok' },
      ]);

      const result = await fetchQuestsPreview(2);

      expect(result).toHaveLength(2);
    });

    it('fills rating and completion defaults like the full list does', async () => {
      mockedGet.mockResolvedValueOnce({ results: [{ id: 1, quest_id: 'krakow-dragon' }], next: null });

      const [quest] = await fetchQuestsPreview(1);

      expect(quest).toMatchObject({
        rating_avg: null,
        rating_count: 0,
        completions_count: 0,
        is_completed_by_me: false,
        first_completer: null,
      });
    });
  });

  describe('fetchQuestByQuestId', () => {
    it('calls GET /quests/by-quest-id/{questId}/', async () => {
      const bundle = { id: 1, quest_id: 'krakow-dragon', title: 'Test' };
      mockedGet.mockResolvedValueOnce(bundle);
      const result = await fetchQuestByQuestId('krakow-dragon');
      expect(mockedGet).toHaveBeenCalledWith('/quests/by-quest-id/krakow-dragon/', 30000);
      expect(result).toEqual(bundle);
    });

    it('retries a transient gateway failure once', async () => {
      const bundle = { id: 1, quest_id: 'krakow-dragon', title: 'Test' };
      mockedGet
        .mockRejectedValueOnce(new (ApiError as any)(502, 'Ошибка запроса: HTTP 502'))
        .mockResolvedValueOnce(bundle);

      await expect(fetchQuestByQuestId('krakow-dragon')).resolves.toEqual(bundle);

      expect(mockedGet).toHaveBeenCalledTimes(2);
      expect(mockedGet).toHaveBeenNthCalledWith(1, '/quests/by-quest-id/krakow-dragon/', 30000);
      expect(mockedGet).toHaveBeenNthCalledWith(2, '/quests/by-quest-id/krakow-dragon/', 30000);
    });

    it('does not retry a permanent not-found response', async () => {
      mockedGet.mockRejectedValueOnce(new (ApiError as any)(404, 'Квест не найден'));

      await expect(fetchQuestByQuestId('missing-quest')).rejects.toThrow('Квест не найден');

      expect(mockedGet).toHaveBeenCalledTimes(1);
      expect(mockedGet).toHaveBeenCalledWith('/quests/by-quest-id/missing-quest/', 30000);
    });

    // #1185: попав на битую ссылку /quests/undefined/undefined, экран отдавал
    // сюда строку "undefined", и запрос уходил на /api/quests/by-quest-id/undefined/.
    it.each(['undefined', 'null', '', '   '])(
      'does not hit the network for an unusable quest id (%p)',
      async (questId) => {
        await expect(fetchQuestByQuestId(questId as string)).rejects.toThrow(/quest id is missing or invalid/);
        expect(mockedGet).not.toHaveBeenCalled();
      },
    );
  });

  describe('fetchAllProgress', () => {
    it('calls GET /quest-progress/', async () => {
      mockedGet.mockResolvedValueOnce([MOCK_PROGRESS]);
      const result = await fetchAllProgress();
      expect(mockedGet).toHaveBeenCalledWith('/quest-progress/');
      expect(result).toEqual([MOCK_PROGRESS]);
    });
  });

  describe('fetchOrCreateProgress', () => {
    it('returns existing progress on successful GET', async () => {
      mockedGet.mockResolvedValueOnce(MOCK_PROGRESS);

      const result = await fetchOrCreateProgress('krakow-dragon');

      expect(mockedGet).toHaveBeenCalledWith('/quest-progress/quest/krakow-dragon/');
      expect(mockedPost).not.toHaveBeenCalled();
      expect(result).toEqual(MOCK_PROGRESS);
    });

    it('creates progress via POST when GET returns 404', async () => {
      const error404 = new (ApiError as any)(404, 'Not found');
      mockedGet
        .mockRejectedValueOnce(error404) // GET progress → 404
        .mockResolvedValueOnce({ id: 5 }); // GET quest bundle → numeric id

      const newProgress = { ...MOCK_PROGRESS, id: 99, current_index: 0 };
      mockedPost.mockResolvedValueOnce(newProgress);

      const result = await fetchOrCreateProgress('krakow-dragon');

      // Should have called GET for progress, then GET for quest, then POST
      expect(mockedGet).toHaveBeenCalledTimes(2);
      expect(mockedGet).toHaveBeenNthCalledWith(1, '/quest-progress/quest/krakow-dragon/');
      expect(mockedGet).toHaveBeenNthCalledWith(2, '/quests/by-quest-id/krakow-dragon/');
      expect(mockedPost).toHaveBeenCalledWith('/quest-progress/', { quest: 5 });
      expect(result).toEqual(newProgress);
    });

    it('re-throws non-404 errors from GET', async () => {
      const error500 = new (ApiError as any)(500, 'Server error');
      mockedGet.mockRejectedValueOnce(error500);

      await expect(fetchOrCreateProgress('krakow-dragon')).rejects.toThrow('Server error');
      expect(mockedPost).not.toHaveBeenCalled();
    });

    it('propagates error if quest fetch fails during 404 recovery', async () => {
      const error404 = new (ApiError as any)(404, 'Not found');
      const questError = new (ApiError as any)(404, 'Quest not found');
      mockedGet
        .mockRejectedValueOnce(error404) // GET progress → 404
        .mockRejectedValueOnce(questError); // GET quest → also 404

      await expect(fetchOrCreateProgress('nonexistent')).rejects.toThrow('Quest not found');
    });

    it('propagates error if POST create fails during 404 recovery', async () => {
      const error404 = new (ApiError as any)(404, 'Not found');
      mockedGet
        .mockRejectedValueOnce(error404) // GET progress → 404
        .mockResolvedValueOnce({ id: 5 }); // GET quest → ok

      const postError = new (ApiError as any)(400, 'Bad request');
      mockedPost.mockRejectedValueOnce(postError);

      await expect(fetchOrCreateProgress('krakow-dragon')).rejects.toThrow('Bad request');
    });

    // #1185: тот же битый сегмент маршрута попадал и в прогресс — прод видел
    // GET /api/quest-progress/quest/undefined/.
    it('does not hit the network for an unusable quest id', async () => {
      await expect(fetchOrCreateProgress('undefined')).rejects.toThrow(/quest id is missing or invalid/);
      expect(mockedGet).not.toHaveBeenCalled();
      expect(mockedPost).not.toHaveBeenCalled();
    });
  });

  describe('createProgress', () => {
    it('calls POST /quest-progress/', async () => {
      mockedPost.mockResolvedValueOnce(MOCK_PROGRESS);
      const result = await createProgress({ quest: 1 });
      expect(mockedPost).toHaveBeenCalledWith('/quest-progress/', { quest: 1 });
      expect(result).toEqual(MOCK_PROGRESS);
    });
  });

  describe('updateProgress', () => {
    it('calls PATCH /quest-progress/{id}/', async () => {
      const updated = { ...MOCK_PROGRESS, current_index: 5 };
      mockedPatch.mockResolvedValueOnce(updated);
      const result = await updateProgress(42, { current_index: 5 });
      expect(mockedPatch).toHaveBeenCalledWith('/quest-progress/42/', { current_index: 5 });
      expect(result).toEqual(updated);
    });
  });

  describe('deleteProgress', () => {
    it('calls DELETE /quest-progress/{id}/', async () => {
      mockedDelete.mockResolvedValueOnce(undefined);
      await deleteProgress(42);
      expect(mockedDelete).toHaveBeenCalledWith('/quest-progress/42/');
    });
  });

  // #1486: до этой задачи при 404 подставлялся детерминированный мок с
  // выдуманными авторами, и однажды он доехал до прода. Читалка обязана
  // показывать либо настоящие отзывы, либо честное пусто.
  describe('fetchQuestReviews', () => {
    it('adapts the public review payload', async () => {
      mockedGet.mockResolvedValueOnce([
        {
          id: 5,
          rating: 4,
          liked: 'Сюжет',
          disliked: '',
          author_name: 'Игрок',
          author_avatar: null,
          created_at: '2026-08-01T10:00:00Z',
        },
      ]);

      const result = await fetchQuestReviews('minsk-cmok');

      expect(mockedGet).toHaveBeenCalledWith('/quests/questminsk-cmok/reviews/?page_size=100');
      expect(result).toEqual([
        {
          id: 5,
          rating: 4,
          liked: 'Сюжет',
          disliked: '',
          authorName: 'Игрок',
          authorAvatar: null,
          createdAt: '2026-08-01T10:00:00Z',
          // Бэкенд без #1576 поля `photos` не присылает — читалка обязана
          // получить пустой список, а не `undefined` (#1579).
          photos: [],
        },
      ]);
    });

    it('adapts moderated player photos and keeps their step link (#1575/#1576)', async () => {
      mockedGet.mockResolvedValueOnce([
        {
          id: 5,
          rating: 5,
          liked: '',
          disliked: '',
          author_name: null,
          author_avatar: null,
          created_at: null,
          photos: [
            { id: 11, url: 'https://cdn.example/a.jpg', step_id: 903 },
            { id: 12, url: 'https://cdn.example/b.jpg', step_id: null },
          ],
        },
      ]);

      const [review] = await fetchQuestReviews('minsk-cmok');

      expect(review.photos).toEqual([
        { id: 11, url: 'https://cdn.example/a.jpg', stepId: 903 },
        { id: 12, url: 'https://cdn.example/b.jpg', stepId: null },
      ]);
    });

    it('drops a photo without a usable url instead of rendering an empty tile', async () => {
      mockedGet.mockResolvedValueOnce([
        {
          id: 5,
          rating: 5,
          liked: '',
          disliked: '',
          author_name: null,
          author_avatar: null,
          created_at: null,
          photos: [{ id: 11, url: null }, { id: 12, url: 'https://cdn.example/b.jpg' }],
        },
      ]);

      const [review] = await fetchQuestReviews('minsk-cmok');

      expect(review.photos).toEqual([
        { id: 12, url: 'https://cdn.example/b.jpg', stepId: null },
      ]);
    });

    it('returns an empty list on 404 instead of fabricated reviews', async () => {
      mockedGet.mockRejectedValueOnce(new ApiError(404, 'Not Found'));

      await expect(fetchQuestReviews('minsk-cmok')).resolves.toEqual([]);
    });

    it('returns an empty list when the quest has no reviews', async () => {
      mockedGet.mockResolvedValueOnce({ results: [], next: null });

      await expect(fetchQuestReviews('minsk-cmok')).resolves.toEqual([]);
    });

    it('re-throws a server failure instead of hiding it behind an empty list', async () => {
      mockedGet.mockRejectedValueOnce(new ApiError(500, 'Server Error'));

      await expect(fetchQuestReviews('minsk-cmok')).rejects.toBeInstanceOf(ApiError);
    });

    // Офлайн приходит как ApiError(0) (api/client.ts): falsy-ноль когда-то утёк бы
    // в ветку пустого списка, и читалка сообщила бы «Пока нет отзывов» про квест,
    // отзывы которого просто не загрузились.
    it('re-throws an offline failure instead of reporting the quest as review-free', async () => {
      mockedGet.mockRejectedValueOnce(new ApiError(0, 'offline'));

      await expect(fetchQuestReviews('minsk-cmok')).rejects.toBeInstanceOf(ApiError);
    });

    // Клиентский таймаут — обычный Error без статуса (utils/fetchWithTimeout.ts),
    // а не ApiError: зависший бэк не значит «квест без отзывов».
    it('re-throws a client timeout instead of reporting the quest as review-free', async () => {
      const timeout = new Error('Превышено время ожидания');
      timeout.name = 'TimeoutError';
      mockedGet.mockRejectedValueOnce(timeout);

      await expect(fetchQuestReviews('minsk-cmok')).rejects.toThrow('Превышено время ожидания');
    });

    // Отмена (анмаунт экрана, смена квеста) — не ошибка загрузки: показывать
    // читалке красное состояние не за что.
    it('treats a cancelled request as an empty list, not an error', async () => {
      const abort = new Error('Aborted');
      abort.name = 'AbortError';
      mockedGet.mockRejectedValueOnce(abort);

      await expect(fetchQuestReviews('minsk-cmok')).resolves.toEqual([]);
    });
  });
});
