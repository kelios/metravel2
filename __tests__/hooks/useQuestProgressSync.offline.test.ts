// Офлайн-синхронизация прогресса квеста (баг sasino-stilo 2026-07-28: игрок
// прошёл маршрут ~1.5 часа без стабильной сети, на сервере остался только
// {"intro":"start"}). Раньше flushSync обнулял pendingDataRef ДО запроса, а
// catch только логировал — упавшее сохранение выбрасывало ответы навсегда.
//
// Тесты живут отдельным файлом: они работают на фейковых таймерах, а в этом
// окружении (jest-expo + RNTL + react-test-renderer) фейковые таймеры ломают
// `waitFor` в последующих тестах того же файла.
import { AppState } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';

let mockIsConnected = true;

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({
    isConnected: mockIsConnected,
    isInternetReachable: mockIsConnected,
    type: 'unknown',
  }),
}));

const mockFetchOrCreateProgress = jest.fn();
const mockUpdateProgress = jest.fn();

jest.mock('@/api/quests', () => ({
  fetchQuestsList: jest.fn(),
  fetchQuestByQuestId: jest.fn(),
  fetchQuestCities: jest.fn(),
  fetchQuestReviews: jest.fn(),
  fetchOrCreateProgress: (...args: any[]) => mockFetchOrCreateProgress(...args),
  updateProgress: (...args: any[]) => mockUpdateProgress(...args),
  deleteProgress: jest.fn(),
}));

import { useQuestProgressSync } from '@/hooks/useQuestsApi';

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

const OFFLINE_ANSWER = {
  currentIndex: 4,
  unlockedIndex: 5,
  answers: { intro: 'start', 'step-1': 'дракон', 'step-2': 'костёл' },
  attempts: { 'step-2': 2 },
  hints: {},
  showMap: true,
};

const OFFLINE_ERROR = () => new Error('Network request failed');

/** Даёт отработать промисам запросов между шагами фейковых таймеров. */
const flushMicrotasks = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

/** Проматывает дебаунс/бэкофф и догоняет промис запроса. */
const advance = async (ms: number) => {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
  await flushMicrotasks();
};

/** Маунт с уже загруженным серверным прогрессом (id=42). */
const mountLoadedSync = async () => {
  mockFetchOrCreateProgress.mockResolvedValueOnce(API_PROGRESS);
  const rendered = renderHook(() => useQuestProgressSync('krakow-dragon', true));
  await flushMicrotasks();
  return rendered;
};

describe('useQuestProgressSync — офлайн-прохождение', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFetchOrCreateProgress.mockReset();
    mockUpdateProgress.mockReset();
    // Отложенный прогресс переживает неудачное сохранение и дожимается флашем на
    // размонтировании, поэтому мок обязан оставаться thenable и без Once-значений.
    mockUpdateProgress.mockResolvedValue(API_PROGRESS);
    mockIsConnected = true;
  });

  afterEach(() => {
    // Реальные таймеры обязательно ДО cleanup RNTL: с фейковыми его размонтирование
    // виснет до jest-таймаута.
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('retries a failed save instead of dropping the pending answer', async () => {
    const { result } = await mountLoadedSync();

    mockUpdateProgress
      .mockRejectedValueOnce(OFFLINE_ERROR())
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
      attempts: OFFLINE_ANSWER.attempts,
    }));

    // Очередь пуста — лишних запросов больше нет.
    await advance(120000);
    expect(mockUpdateProgress).toHaveBeenCalledTimes(2);
    expect(result.current.progress?.answers).toEqual(OFFLINE_ANSWER.answers);
  });

  it('flushes the offline answer to the server once the network is back', async () => {
    mockIsConnected = false;
    const { result, rerender } = await mountLoadedSync();

    mockUpdateProgress
      .mockRejectedValueOnce(OFFLINE_ERROR())
      .mockResolvedValueOnce({ ...API_PROGRESS, answers: OFFLINE_ANSWER.answers });

    act(() => {
      result.current.saveProgress(OFFLINE_ANSWER);
    });
    await advance(2000);
    expect(mockUpdateProgress).toHaveBeenCalledTimes(1);

    // Сеть вернулась — отложенный прогресс уходит сразу, не дожидаясь бэкоффа.
    mockIsConnected = true;
    rerender(undefined);
    await flushMicrotasks();

    expect(mockUpdateProgress).toHaveBeenCalledTimes(2);
    expect(mockUpdateProgress).toHaveBeenLastCalledWith(42, expect.objectContaining({
      answers: OFFLINE_ANSWER.answers,
    }));
    expect(result.current.progress?.answers).toEqual(OFFLINE_ANSWER.answers);
  });

  it('flushes the offline answer when the app returns to active', async () => {
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
        .mockRejectedValueOnce(OFFLINE_ERROR())
        .mockResolvedValueOnce({ ...API_PROGRESS, answers: OFFLINE_ANSWER.answers });

      act(() => {
        result.current.saveProgress(OFFLINE_ANSWER);
      });
      await advance(2000);
      expect(mockUpdateProgress).toHaveBeenCalledTimes(1);

      act(() => {
        appStateListeners.forEach((listener) => listener('active'));
      });
      await flushMicrotasks();

      expect(mockUpdateProgress).toHaveBeenCalledTimes(2);
      expect(mockUpdateProgress).toHaveBeenLastCalledWith(42, expect.objectContaining({
        answers: OFFLINE_ANSWER.answers,
      }));
    } finally {
      addEventListenerSpy.mockRestore();
    }
  });

  it('keeps a newer answer pending when it lands during an in-flight save', async () => {
    const { result } = await mountLoadedSync();

    let resolveFirst: (value: unknown) => void = () => {};
    mockUpdateProgress
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce({ ...API_PROGRESS, answers: OFFLINE_ANSWER.answers });

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

  it('queues an answer made before the progress id arrives', async () => {
    // Ответ до ответа fetchOrCreateProgress раньше молча выбрасывался
    // (saveProgress выходил по !progressIdRef.current).
    let resolveProgress: (value: unknown) => void = () => {};
    mockFetchOrCreateProgress.mockImplementationOnce(
      () => new Promise((resolve) => { resolveProgress = resolve; }),
    );

    const { result } = renderHook(() => useQuestProgressSync('krakow-dragon', true));
    await flushMicrotasks();

    act(() => {
      result.current.saveProgress(OFFLINE_ANSWER);
    });
    await advance(2000);
    expect(mockUpdateProgress).not.toHaveBeenCalled();

    await act(async () => {
      resolveProgress(API_PROGRESS);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockUpdateProgress).toHaveBeenCalledWith(42, expect.objectContaining({
      answers: OFFLINE_ANSWER.answers,
    }));
  });
});
