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
        },
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
  });
});
