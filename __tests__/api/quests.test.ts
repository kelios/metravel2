import { apiClient, ApiError } from '@/api/client';
import {
  fetchQuestsList,
  fetchQuestByQuestId,
  fetchQuestCities,
  fetchOrCreateProgress,
  createProgress,
  updateProgress,
  deleteProgress,
  fetchAllProgress,
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
    it('calls GET /quests/', async () => {
      mockedGet.mockResolvedValueOnce([]);
      const result = await fetchQuestsList();
      expect(mockedGet).toHaveBeenCalledWith('/quests/');
      expect(result).toEqual([]);
    });
  });

  describe('fetchQuestByQuestId', () => {
    it('calls GET /quests/by-quest-id/{questId}/', async () => {
      const bundle = { id: 1, quest_id: 'krakow-dragon', title: 'Test' };
      mockedGet.mockResolvedValueOnce(bundle);
      const result = await fetchQuestByQuestId('krakow-dragon');
      expect(mockedGet).toHaveBeenCalledWith('/quests/by-quest-id/krakow-dragon/');
      expect(result).toEqual(bundle);
    });
  });

  describe('fetchQuestCities', () => {
    it('calls GET /quests/cities/', async () => {
      mockedGet.mockResolvedValueOnce([]);
      const result = await fetchQuestCities();
      expect(mockedGet).toHaveBeenCalledWith('/quests/cities/');
      expect(result).toEqual([]);
    });
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
});
