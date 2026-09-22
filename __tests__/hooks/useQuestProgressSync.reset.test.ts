// #2033: «Сбросить» на одном устройстве удаляет строку прохождения, а экран
// другого устройства при следующем сохранении создавал её заново из своей
// копии — сброшенное прохождение воскресало «Пройденным». Хук синхронизации
// обязан отличать подтверждённое отсутствие строки от упавшего чтения и не
// ретраить снапшот, чьё прохождение сброшено.
//
// Отдельный файл по той же причине, что и offline-набор: фейковые таймеры в
// этом окружении ломают `waitFor` соседних тестов.
import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isConnected: true, isInternetReachable: true, type: 'unknown' }),
}));

/** Строка прохождения на сервере сейчас; `null` — её удалили. */
let mockServerRow: any = null;
const mockFetchQuestProgress = jest.fn();
const mockUpdateProgress = jest.fn();
const mockDeleteProgress = jest.fn();

jest.mock('@/api/quests', () => {
  const { QuestProgressLineageMismatch } = jest.requireActual('@/utils/questProgressMerge');
  return {
    fetchQuestsList: jest.fn(),
    fetchQuestByQuestId: jest.fn(),
    fetchQuestReviews: jest.fn(),
    // Настоящий писатель: снапшот с поколением ложится только в свою строку.
    withQuestProgress: async (
      questId: string,
      task: (progress: any) => Promise<unknown>,
      options?: { lineageId?: number },
    ) => {
      if (options?.lineageId && mockServerRow?.id !== options.lineageId) {
        throw new QuestProgressLineageMismatch(questId, options.lineageId, mockServerRow);
      }
      return task(mockServerRow);
    },
    fetchQuestProgress: (...args: any[]) => mockFetchQuestProgress(...args),
    updateProgress: (...args: any[]) => mockUpdateProgress(...args),
    deleteProgress: (...args: any[]) => mockDeleteProgress(...args),
  };
});

import { useQuestProgressSync } from '@/hooks/useQuestsApi';
import {
  QUEST_PROGRESS_QUEUE_KEY,
  __resetQuestProgressQueue,
} from '@/utils/questProgressQueue';

const FINISHED_ROW = {
  id: 42,
  quest: 1,
  user: 10,
  current_index: 4,
  unlocked_index: 4,
  answers: { intro: 'start', 'step-1': 'дракон' },
  attempts: {},
  hints: {},
  skipped: {},
  early_finish: false,
  show_map: true,
  completed: true,
  completed_at: '2026-09-20T10:00:00Z',
  created_at: '2026-09-20T09:00:00Z',
  updated_at: '2026-09-20T10:00:00Z',
};

/** Копия пройденного прохождения на этом устройстве — поколение строки 42. */
const FINISHED_COPY = {
  currentIndex: 5,
  unlockedIndex: 5,
  answers: { intro: 'start', 'step-1': 'дракон', 'step-2': 'костёл' },
  attempts: {},
  hints: {},
  showMap: false,
  completed: true,
  serverId: 42,
};

const flushMicrotasks = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

const advance = async (ms: number) => {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
  await flushMicrotasks();
};

const readStoredQueue = async (): Promise<any[]> => {
  const raw = await AsyncStorage.getItem(QUEST_PROGRESS_QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
};

const mountSync = async () => {
  const rendered = renderHook(() => useQuestProgressSync('krakow-dragon', true));
  await flushMicrotasks();
  return rendered;
};

describe('useQuestProgressSync — сброс на другом устройстве (#2033)', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    __resetQuestProgressQueue();
    await AsyncStorage.removeItem(QUEST_PROGRESS_QUEUE_KEY);
    mockServerRow = FINISHED_ROW;
    mockFetchQuestProgress.mockReset();
    mockUpdateProgress.mockReset();
    mockDeleteProgress.mockReset();
    mockFetchQuestProgress.mockImplementation(async () => mockServerRow);
    mockUpdateProgress.mockImplementation(async (id: number, payload: any) => ({ ...mockServerRow, id, ...payload }));
    mockDeleteProgress.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('404 чтения — подтверждённое отсутствие строки', async () => {
    mockServerRow = null;

    const { result } = await mountSync();

    expect(result.current.progressLoading).toBe(false);
    expect(result.current.progress).toBeNull();
    expect(result.current.progressMissing).toBe(true);
  });

  it('упавшее чтение отсутствия не подтверждает — копию по нему не стирают', async () => {
    mockFetchQuestProgress.mockRejectedValue(new Error('Network request failed'));

    const { result } = await mountSync();

    expect(result.current.progressLoading).toBe(false);
    expect(result.current.progress).toBeNull();
    expect(result.current.progressMissing).toBe(false);
  });

  it('копия сброшенного прохождения: ни PATCH, ни ретрая, ни очереди — экран узнаёт, что строки нет', async () => {
    const { result } = await mountSync();
    expect(result.current.progress?.id).toBe(42);
    expect(result.current.progressMissing).toBe(false);

    // «Сбросить» во втором профиле: строки 42 больше нет.
    mockServerRow = null;
    act(() => {
      result.current.saveProgress(FINISHED_COPY);
    });
    await advance(2000);

    expect(mockUpdateProgress).not.toHaveBeenCalled();
    expect(result.current.progress).toBeNull();
    expect(result.current.progressMissing).toBe(true);

    // Бэкофф ничего не дожимает, а на диске копии нет.
    await advance(120000);
    expect(mockUpdateProgress).not.toHaveBeenCalled();
    expect(await readStoredQueue()).toEqual([]);
  });

  it('на месте строки уже новое прохождение — экран переходит на него, не трогая', async () => {
    const { result } = await mountSync();

    const restarted = { ...FINISHED_ROW, id: 57, answers: { intro: 'start' }, completed: false };
    mockServerRow = restarted;
    act(() => {
      result.current.saveProgress(FINISHED_COPY);
    });
    await advance(2000);

    expect(mockUpdateProgress).not.toHaveBeenCalled();
    expect(result.current.progress).toEqual(restarted);
    expect(result.current.progressMissing).toBe(false);
  });

  it('снапшот без поколения по-прежнему уходит PATCH-ем в строку (#1803)', async () => {
    const { result } = await mountSync();

    act(() => {
      result.current.saveProgress({ ...FINISHED_COPY, serverId: undefined });
    });
    await advance(2000);

    expect(mockUpdateProgress).toHaveBeenCalledTimes(1);
    expect(mockUpdateProgress.mock.calls[0][0]).toBe(42);
  });

  it('подтверждённое удаление своим «Сбросить» — строки нет', async () => {
    const { result } = await mountSync();

    await act(async () => {
      await result.current.resetProgress();
    });

    expect(mockDeleteProgress).toHaveBeenCalledWith(42);
    expect(result.current.progress).toBeNull();
    expect(result.current.progressMissing).toBe(true);
  });

  it('удаление, дошедшее уже на следующем квесте, не объявляет его прохождение пропавшим', async () => {
    const NEXT_ROW = { ...FINISHED_ROW, id: 77, completed: false };
    mockFetchQuestProgress.mockImplementation(async (questId: string) =>
      questId === 'krakow-dragon' ? FINISHED_ROW : NEXT_ROW,
    );
    let finishDelete!: () => void;
    mockDeleteProgress.mockImplementationOnce(
      () => new Promise<void>((resolve) => { finishDelete = resolve; }),
    );
    const { result, rerender } = renderHook(
      ({ questId }: { questId: string }) => useQuestProgressSync(questId, true),
      { initialProps: { questId: 'krakow-dragon' } },
    );
    await flushMicrotasks();

    let resetting!: Promise<void>;
    act(() => {
      resetting = result.current.resetProgress();
    });
    // DELETE ещё в полёте, а игрок уже открыл следующий квест.
    rerender({ questId: 'krakow-barbakan' });
    await flushMicrotasks();
    expect(result.current.progress?.id).toBe(77);

    await act(async () => {
      finishDelete();
      await resetting;
    });

    expect(mockDeleteProgress).toHaveBeenCalledWith(42);
    // Иначе визард следующего квеста стёр бы копию живого прохождения 77.
    expect(result.current.progress?.id).toBe(77);
    expect(result.current.progressMissing).toBe(false);
    // И его собственный «Сбросить» по-прежнему знает, какую строку удалять.
    await act(async () => {
      await result.current.resetProgress();
    });
    expect(mockDeleteProgress).toHaveBeenLastCalledWith(77);
  });

  it('упавшее перечитывание не наследует прежнее «строки нет»', async () => {
    mockServerRow = null;
    const { result, rerender } = renderHook(
      ({ isAuthenticated }: { isAuthenticated: boolean }) =>
        useQuestProgressSync('krakow-dragon', isAuthenticated),
      { initialProps: { isAuthenticated: true } },
    );
    await flushMicrotasks();
    expect(result.current.progressMissing).toBe(true);

    // Выход и вход другим аккаунтом, не уходя с квеста: чтение нового упало.
    // Подтверждение прошлого аккаунта ему не принадлежит — копию по нему не стирают.
    rerender({ isAuthenticated: false });
    await flushMicrotasks();
    mockFetchQuestProgress.mockRejectedValue(new Error('Network request failed'));
    rerender({ isAuthenticated: true });
    await flushMicrotasks();

    expect(result.current.progressLoading).toBe(false);
    expect(result.current.progressMissing).toBe(false);
  });
});
