import { renderHook, act, waitFor } from '@testing-library/react-native';


// Mock the API module
const mockFetchQuestsList = jest.fn();
const mockFetchQuestByQuestId = jest.fn();
const mockFetchQuestCities = jest.fn();
const mockFetchOrCreateProgress = jest.fn();
const mockUpdateProgress = jest.fn();
const mockDeleteProgress = jest.fn();

jest.mock('@/api/quests', () => ({
  fetchQuestsList: (...args: any[]) => mockFetchQuestsList(...args),
  fetchQuestByQuestId: (...args: any[]) => mockFetchQuestByQuestId(...args),
  fetchQuestCities: (...args: any[]) => mockFetchQuestCities(...args),
  fetchOrCreateProgress: (...args: any[]) => mockFetchOrCreateProgress(...args),
  updateProgress: (...args: any[]) => mockUpdateProgress(...args),
  deleteProgress: (...args: any[]) => mockDeleteProgress(...args),
}));

// Mock adapters — pass through for simplicity
jest.mock('@/utils/questAdapters', () => ({
  adaptMeta: (m: any) => ({
    id: m.quest_id,
    title: m.title,
    points: parseInt(String(m.points), 10) || 0,
    cityId: m.city_id,
    lat: parseFloat(String(m.lat)),
    lng: parseFloat(String(m.lng)),
  }),
  adaptBundle: (b: any) => ({
    title: b.title,
    steps: [],
    finale: { text: '' },
    storageKey: b.storage_key,
    city: { name: b.city?.name, lat: 0, lng: 0 },
  }),
}));

import {
  useQuestsList,
  useQuestCities,
  useQuestBundle,
  useQuestProgressSync,
} from '@/hooks/useQuestsApi';

// ---- Fixtures ----

const API_META = {
  id: 1,
  quest_id: 'krakow-dragon',
  title: 'Тайна дракона',
  points: '7',
  city_id: 'krakow',
  city_name: 'Kraków',
  lat: '50.06',
  lng: '19.94',
  duration_min: 60,
  difficulty: 'easy',
  tags: null,
  pet_friendly: true,
  cover_url: null,
};

const API_CITY = { id: 1, name: 'Kraków', lat: '50.06', lng: '19.94' };

const API_BUNDLE = {
  id: 1,
  quest_id: 'krakow-dragon',
  title: 'Тайна дракона',
  steps: '[]',
  finale: { text: 'Поздравляем!', video_url: null, poster_url: null },
  intro: null,
  storage_key: 'quest_krakow_dragon_v1',
  city: API_CITY,
};

const API_PROGRESS = {
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

describe('useQuestsApi hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===================== useQuestsList =====================

  describe('useQuestsList', () => {
    it('loads quests from API and adapts them', async () => {
      mockFetchQuestsList.mockResolvedValueOnce([API_META]);

      const { result } = renderHook(() => useQuestsList());

      // Initially loading
      expect(result.current.loading).toBe(true);

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.quests).toHaveLength(1);
      expect(result.current.quests[0].id).toBe('krakow-dragon');
      expect(result.current.error).toBeNull();
    });

    it('sets error when API fails (no fallback)', async () => {
      mockFetchQuestsList.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useQuestsList());

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.quests).toEqual([]);
      expect(result.current.error).toBe('Network error');
    });

    it('groups quests by city', async () => {
      const meta2 = { ...API_META, quest_id: 'minsk-cmok', city_id: 'minsk' };
      mockFetchQuestsList.mockResolvedValueOnce([API_META, meta2]);

      const { result } = renderHook(() => useQuestsList());

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.cityQuestsIndex['krakow']).toHaveLength(1);
      expect(result.current.cityQuestsIndex['minsk']).toHaveLength(1);
    });
  });

  // ===================== useQuestCities =====================

  describe('useQuestCities', () => {
    it('loads cities from API', async () => {
      mockFetchQuestCities.mockResolvedValueOnce([API_CITY]);

      const { result } = renderHook(() => useQuestCities());

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.cities).toHaveLength(1);
      expect(result.current.cities[0].name).toBe('Kraków');
      expect(result.current.cities[0].lat).toBeCloseTo(50.06);
    });

    it('handles API failure gracefully (no fallback)', async () => {
      mockFetchQuestCities.mockRejectedValueOnce(new Error('fail'));

      const { result } = renderHook(() => useQuestCities());

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.cities).toEqual([]);
    });
  });

  // ===================== useQuestBundle =====================

  describe('useQuestBundle', () => {
    it('loads bundle from API', async () => {
      mockFetchQuestByQuestId.mockResolvedValueOnce(API_BUNDLE);

      const { result } = renderHook(() => useQuestBundle('krakow-dragon'));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.bundle).not.toBeNull();
      expect(result.current.bundle!.title).toBe('Тайна дракона');
      expect(result.current.error).toBeNull();
    });

    it('sets error when API fails (no fallback)', async () => {
      mockFetchQuestByQuestId.mockRejectedValueOnce(new Error('Not found'));

      const { result } = renderHook(() => useQuestBundle('nonexistent'));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.bundle).toBeNull();
      expect(result.current.error).toBe('Not found');
    });

    it('returns null bundle for undefined questId', async () => {
      const { result } = renderHook(() => useQuestBundle(undefined));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.bundle).toBeNull();
      expect(mockFetchQuestByQuestId).not.toHaveBeenCalled();
    });
  });

  // ===================== useQuestProgressSync =====================

  describe('useQuestProgressSync', () => {
    it('loads progress for authenticated user', async () => {
      mockFetchOrCreateProgress.mockResolvedValueOnce(API_PROGRESS);

      const { result } = renderHook(() =>
        useQuestProgressSync('krakow-dragon', true),
      );

      await waitFor(() => expect(result.current.progressLoading).toBe(false));

      expect(result.current.progress).toEqual(API_PROGRESS);
      expect(mockFetchOrCreateProgress).toHaveBeenCalledWith('krakow-dragon');
    });

    it('does not load progress for unauthenticated user', async () => {
      const { result } = renderHook(() =>
        useQuestProgressSync('krakow-dragon', false),
      );

      await waitFor(() => expect(result.current.progressLoading).toBe(false));

      expect(result.current.progress).toBeNull();
      expect(mockFetchOrCreateProgress).not.toHaveBeenCalled();
    });

    it('does not load progress when questId is undefined', async () => {
      const { result } = renderHook(() =>
        useQuestProgressSync(undefined, true),
      );

      await waitFor(() => expect(result.current.progressLoading).toBe(false));

      expect(result.current.progress).toBeNull();
      expect(mockFetchOrCreateProgress).not.toHaveBeenCalled();
    });

    it('handles progress load failure gracefully', async () => {
      mockFetchOrCreateProgress.mockRejectedValueOnce(new Error('Server down'));

      const { result } = renderHook(() =>
        useQuestProgressSync('krakow-dragon', true),
      );

      await waitFor(() => expect(result.current.progressLoading).toBe(false));

      // Progress stays null but no crash
      expect(result.current.progress).toBeNull();
    });

    it('saveProgress is a no-op when not authenticated', async () => {
      const { result } = renderHook(() =>
        useQuestProgressSync('krakow-dragon', false),
      );

      await waitFor(() => expect(result.current.progressLoading).toBe(false));

      act(() => {
        result.current.saveProgress({
          currentIndex: 1,
          unlockedIndex: 1,
          answers: {},
          attempts: {},
          hints: {},
          showMap: true,
        });
      });

      // Should not call updateProgress
      expect(mockUpdateProgress).not.toHaveBeenCalled();
    });

    it('resetProgress calls deleteProgress for authenticated user with progress', async () => {
      mockFetchOrCreateProgress.mockResolvedValueOnce(API_PROGRESS);
      mockDeleteProgress.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() =>
        useQuestProgressSync('krakow-dragon', true),
      );

      await waitFor(() => expect(result.current.progressLoading).toBe(false));

      await act(async () => {
        await result.current.resetProgress();
      });

      expect(mockDeleteProgress).toHaveBeenCalledWith(42);
      expect(result.current.progress).toBeNull();
    });
  });
});
