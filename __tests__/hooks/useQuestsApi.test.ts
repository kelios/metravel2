import { createElement, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Управляемый статус сети для офлайн-сценариев синхронизации прогресса.
let mockIsConnected = true;

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({
    isConnected: mockIsConnected,
    isInternetReachable: mockIsConnected,
    type: 'unknown',
  }),
}));

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
    cover: m.cover_url ?? undefined,
  }),
  adaptBundle: (b: any) => ({
    title: b.title,
    steps: [],
    finale: { text: '' },
    storageKey: b.storage_key,
    city: { name: b.city?.name, lat: 0, lng: 0 },
    coverUrl: b.cover_url ?? undefined,
  }),
  normalizeQuestCountryCode: (rawCode: unknown, lat: number, lng: number) => {
    const code = String(rawCode ?? '').trim().toUpperCase();
    if (code) return code;
    return lat >= 49 && lat <= 54.84 && lng >= 14.12 && lng <= 24.15 ? 'PL' : undefined;
  },
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

const API_CITY = { id: 1, name: 'Kraków', lat: '50.06', lng: '19.94', country_code: 'pl' };

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
    [
      mockFetchQuestsList,
      mockFetchQuestByQuestId,
      mockFetchQuestCities,
      mockFetchOrCreateProgress,
      mockUpdateProgress,
      mockDeleteProgress,
    ].forEach((mock) => mock.mockReset());

    mockIsConnected = true;

    // useQuestBundle may request the list both for a missing-cover fallback and
    // for non-blocking tag enrichment. Keep every unconfigured call thenable.
    mockFetchQuestsList.mockResolvedValue([]);
    // Отложенный прогресс переживает неудачное сохранение и дожимается флашем на
    // размонтировании — этот вызов приходит уже во время cleanup, поэтому мок
    // обязан оставаться thenable даже без явного mockResolvedValueOnce.
    mockUpdateProgress.mockResolvedValue(API_PROGRESS);
  });

  // Тесты офлайн-ретрая работают на фейковых таймерах. Догоняем оставшуюся
  // React-работу до возврата реальных таймеров, иначе запланированный рендер
  // теряется вместе с фейковым таймером и подвешивает следующий тест.
  afterEach(async () => {
    if (jest.isMockFunction(setTimeout)) {
      await act(async () => {
        jest.runOnlyPendingTimers();
        await Promise.resolve();
        await Promise.resolve();
      });
      jest.clearAllTimers();
    }
    jest.useRealTimers();
  });

  // ===================== useQuestsList =====================

  describe('useQuestsList', () => {
    let queryClient: QueryClient;
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    beforeEach(() => {
      queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
    });

    it('loads quests from API and adapts them', async () => {
      mockFetchQuestsList.mockResolvedValueOnce([API_META]);

      const { result } = renderHook(() => useQuestsList(), { wrapper });

      // Initially loading
      expect(result.current.loading).toBe(true);

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.quests).toHaveLength(1);
      expect(result.current.quests[0].id).toBe('krakow-dragon');
      expect(result.current.error).toBeNull();
    });

    it('sets error when API fails (no fallback)', async () => {
      mockFetchQuestsList.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useQuestsList(), { wrapper });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.quests).toEqual([]);
      expect(result.current.error).toBe('Network error');
    });

    it('groups quests by city', async () => {
      const meta2 = { ...API_META, quest_id: 'minsk-cmok', city_id: 'minsk' };
      mockFetchQuestsList.mockResolvedValueOnce([API_META, meta2]);

      const { result } = renderHook(() => useQuestsList(), { wrapper });

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
      expect(result.current.cities[0].countryCode).toBe('PL');
    });

    it('falls back to coords when API returns a blank country code', async () => {
      mockFetchQuestCities.mockResolvedValueOnce([
        { ...API_CITY, country_code: '   ' },
      ]);

      const { result } = renderHook(() => useQuestCities());

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.cities[0].countryCode).toBe('PL');
    });

    it('handles API failure gracefully (no fallback)', async () => {
      mockFetchQuestCities.mockRejectedValue(new Error('fail'));

      const { result } = renderHook(() => useQuestCities());

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.cities).toEqual([]);
    });
  });

  // ===================== useQuestBundle =====================

  describe('useQuestBundle', () => {
    it('loads bundle from API', async () => {
      mockFetchQuestByQuestId.mockResolvedValueOnce(API_BUNDLE);
      mockFetchQuestsList.mockResolvedValueOnce([]);

      const { result } = renderHook(() => useQuestBundle('krakow-dragon'));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.bundle).not.toBeNull();
      expect(result.current.bundle!.title).toBe('Тайна дракона');
      expect(result.current.error).toBeNull();
      expect(typeof result.current.refetch).toBe('function');
    });

    it('sets error when API fails (no fallback)', async () => {
      mockFetchQuestByQuestId.mockRejectedValueOnce(new Error('Not found'));

      const { result } = renderHook(() => useQuestBundle('nonexistent'));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.bundle).toBeNull();
      expect(result.current.error).toBe('Not found');
      // Деталь упала → полный список квестов НЕ грузим (#729 lazy-fallback).
      expect(mockFetchQuestsList).not.toHaveBeenCalled();
    });

    it('returns null bundle for undefined questId', async () => {
      const { result } = renderHook(() => useQuestBundle(undefined));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.bundle).toBeNull();
      expect(mockFetchQuestByQuestId).not.toHaveBeenCalled();
      expect(typeof result.current.refetch).toBe('function');
    });

    it('refetch triggers a second API request and updates bundle', async () => {
      mockFetchQuestByQuestId
        .mockResolvedValueOnce({ ...API_BUNDLE, title: 'Тайна дракона (v1)' })
        .mockResolvedValueOnce({ ...API_BUNDLE, title: 'Тайна дракона (v2)' });
      mockFetchQuestsList
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const { result } = renderHook(() => useQuestBundle('krakow-dragon'));

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.bundle?.title).toBe('Тайна дракона (v1)');
      expect(mockFetchQuestByQuestId).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.refetch();
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.bundle?.title).toBe('Тайна дракона (v2)');
      expect(mockFetchQuestByQuestId).toHaveBeenCalledTimes(2);
    });

    it('falls back to quest meta cover when bundle has no coverUrl', async () => {
      mockFetchQuestByQuestId.mockResolvedValueOnce(API_BUNDLE);
      mockFetchQuestsList.mockResolvedValueOnce([
        { ...API_META, cover_url: 'https://img.com/cover.jpg' },
      ]);

      const { result } = renderHook(() => useQuestBundle('krakow-dragon'));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.bundle?.coverUrl).toBe('https://img.com/cover.jpg');
    });

    it('does NOT fetch the quest list when the bundle already has cover_url (#729)', async () => {
      mockFetchQuestByQuestId.mockResolvedValueOnce({
        ...API_BUNDLE,
        cover_url: 'https://img.com/detail-cover.jpg',
      });

      const { result } = renderHook(() => useQuestBundle('krakow-dragon'));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.bundle?.coverUrl).toBe('https://img.com/detail-cover.jpg');
      expect(mockFetchQuestsList).not.toHaveBeenCalled();
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

    it('flushes a pending debounced save on unmount instead of dropping it', async () => {
      mockFetchOrCreateProgress.mockResolvedValueOnce(API_PROGRESS);
      mockUpdateProgress.mockResolvedValueOnce(API_PROGRESS);

      const { result, unmount } = renderHook(() =>
        useQuestProgressSync('krakow-dragon', true),
      );

      await waitFor(() => expect(result.current.progressLoading).toBe(false));

      act(() => {
        result.current.saveProgress({
          currentIndex: 3,
          unlockedIndex: 4,
          answers: { 'step-2': 'ответ' },
          attempts: { 'step-2': 1 },
          hints: {},
          showMap: false,
        });
      });

      // Unmount before the 2s debounce fires — change must still be persisted.
      expect(mockUpdateProgress).not.toHaveBeenCalled();
      unmount();

      expect(mockUpdateProgress).toHaveBeenCalledWith(42, expect.objectContaining({
        current_index: 3,
        unlocked_index: 4,
        answers: { 'step-2': 'ответ' },
        show_map: false,
      }));
    });

    // ---- Офлайн-прохождение (баг sasino-stilo 2026-07-28) ----
    // Раньше pendingDataRef обнулялся ДО запроса, а catch только логировал: при
    // падении сохранения ответы игрока выбрасывались и никогда не переотправлялись.

    const OFFLINE_ANSWER = {
      currentIndex: 4,
      unlockedIndex: 5,
      answers: { intro: 'start', 'step-1': 'дракон', 'step-2': 'костёл' },
      attempts: { 'step-2': 2 },
      hints: {},
      showMap: true,
    };

    /** Маунт с уже загруженным серверным прогрессом (id=42). */
    const mountLoadedSync = async () => {
      mockFetchOrCreateProgress.mockResolvedValueOnce(API_PROGRESS);
      const rendered = renderHook(() => useQuestProgressSync('krakow-dragon', true));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      return rendered;
    };

    /** Проматывает дебаунс/бэкофф и даёт промису запроса отработать. */
    const advance = async (ms: number) => {
      act(() => {
        jest.advanceTimersByTime(ms);
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
    };

    it('retries a failed save instead of dropping the pending answer', async () => {
      jest.useFakeTimers();
      const { result } = await mountLoadedSync();

      mockUpdateProgress
        .mockRejectedValueOnce(new Error('Network request failed'))
        .mockResolvedValueOnce({ ...API_PROGRESS, answers: OFFLINE_ANSWER.answers });

      act(() => {
        result.current.saveProgress(OFFLINE_ANSWER);
      });

      // Дебаунс — первый (упавший) запрос.
      await advance(2000);
      expect(mockUpdateProgress).toHaveBeenCalledTimes(1);

      // Бэкофф — ответ уходит повторно с теми же данными, а не теряется.
      await advance(2000);
      expect(mockUpdateProgress).toHaveBeenCalledTimes(2);
      expect(mockUpdateProgress).toHaveBeenLastCalledWith(42, expect.objectContaining({
        current_index: 4,
        unlocked_index: 5,
        answers: OFFLINE_ANSWER.answers,
      }));

      // Очередь пуста — лишних запросов больше нет.
      await advance(120000);
      expect(mockUpdateProgress).toHaveBeenCalledTimes(2);
      expect(result.current.progress?.answers).toEqual(OFFLINE_ANSWER.answers);
    });

    it('flushes the offline answer to the server once the network is back', async () => {
      jest.useFakeTimers();
      mockIsConnected = false;
      const { result, rerender } = await mountLoadedSync();

      mockUpdateProgress
        .mockRejectedValueOnce(new Error('Network request failed'))
        .mockResolvedValueOnce({ ...API_PROGRESS, answers: OFFLINE_ANSWER.answers });

      act(() => {
        result.current.saveProgress(OFFLINE_ANSWER);
      });
      await advance(2000);
      expect(mockUpdateProgress).toHaveBeenCalledTimes(1);

      // Сеть вернулась — отложенный прогресс уходит сразу, не дожидаясь бэкоффа.
      mockIsConnected = true;
      rerender(undefined);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockUpdateProgress).toHaveBeenCalledTimes(2);
      expect(mockUpdateProgress).toHaveBeenLastCalledWith(42, expect.objectContaining({
        answers: OFFLINE_ANSWER.answers,
      }));
      expect(result.current.progress?.answers).toEqual(OFFLINE_ANSWER.answers);
    });

    it('flushes the offline answer when the app returns to active', async () => {
      jest.useFakeTimers();
      const appStateListeners: Array<(state: string) => void> = [];
      const addEventListenerSpy = jest
        .spyOn(AppState, 'addEventListener')
        .mockImplementation((event: string, handler: any) => {
          if (event === 'change') appStateListeners.push(handler);
          return { remove: jest.fn() } as any;
        });

      try {
        const { result } = await mountLoadedSync();

        mockUpdateProgress
          .mockRejectedValueOnce(new Error('Network request failed'))
          .mockResolvedValueOnce({ ...API_PROGRESS, answers: OFFLINE_ANSWER.answers });

        act(() => {
          result.current.saveProgress(OFFLINE_ANSWER);
        });
        await advance(2000);
        expect(mockUpdateProgress).toHaveBeenCalledTimes(1);

        act(() => {
          appStateListeners.forEach((listener) => listener('active'));
        });
        await act(async () => {
          await Promise.resolve();
          await Promise.resolve();
        });

        expect(mockUpdateProgress).toHaveBeenCalledTimes(2);
        expect(mockUpdateProgress).toHaveBeenLastCalledWith(42, expect.objectContaining({
          answers: OFFLINE_ANSWER.answers,
        }));
      } finally {
        addEventListenerSpy.mockRestore();
      }
    });

    it('keeps a newer answer pending when it lands during an in-flight save', async () => {
      jest.useFakeTimers();
      const { result } = await mountLoadedSync();

      let resolveFirst: (value: unknown) => void = () => {};
      mockUpdateProgress
        .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
        .mockResolvedValueOnce(API_PROGRESS);

      act(() => {
        result.current.saveProgress({ ...OFFLINE_ANSWER, answers: { intro: 'start' } });
      });
      await advance(2000);
      expect(mockUpdateProgress).toHaveBeenCalledTimes(1);

      // Игрок отвечает, пока первый запрос ещё в полёте.
      act(() => {
        result.current.saveProgress(OFFLINE_ANSWER);
      });
      await act(async () => {
        resolveFirst(API_PROGRESS);
        await Promise.resolve();
        await Promise.resolve();
      });

      await advance(2000);
      expect(mockUpdateProgress).toHaveBeenLastCalledWith(42, expect.objectContaining({
        answers: OFFLINE_ANSWER.answers,
      }));
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
