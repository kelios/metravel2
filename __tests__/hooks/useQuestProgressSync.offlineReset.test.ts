// #2043: «Сбросить» без сети. `DELETE` падал, намерение нигде не сохранялось и
// не повторялось, а строка прохождения на сервере оставалась. Следующее
// сохранение уходило снапшотом без поколения, писатель законно отдавал ему эту
// строку (#1803), и новое прохождение сливалось со старым — возвращались прежние
// ответы и «Пройден».
//
// Отдельный файл по той же причине, что и reset/offline-наборы: фейковые
// таймеры в этом окружении ломают `waitFor` соседних тестов.
import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ApiError } from '@/api/clientErrors';

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isConnected: true, isInternetReachable: true, type: 'unknown' }),
}));

/** Есть ли связь с сервером: без неё падает любой запрос прогресса. */
let mockOnline = true;
/** Удаление падает само по себе, пока чтение работает (5xx только на DELETE). */
let mockDeleteError: Error | null = null;
/** Сервер ответил на чтение или PATCH, а ответ ещё в сети — до `release`. */
let mockResponseGate: Promise<void> | null = null;
/** PATCH висит и падает, не дойдя до сервера. */
let mockPatchError: Error | null = null;
/** Строка прохождения квеста на сервере; `null` — строки нет. */
let mockServerRow: any = null;
let mockNextRowId = 43;
const mockFetchQuestProgress = jest.fn();
const mockCreateProgress = jest.fn();
const mockUpdateProgress = jest.fn();
const mockDeleteProgress = jest.fn();

jest.mock('@/api/quests', () => {
  const { ApiError: MockApiError } = jest.requireActual('@/api/clientErrors');
  const { QuestProgressLineageMismatch } = jest.requireActual('@/utils/questProgressMerge');
  const offline = () => new MockApiError(0, 'offline', { offline: true });
  return {
    fetchQuestsList: jest.fn(),
    fetchQuestByQuestId: jest.fn(),
    fetchQuestReviews: jest.fn(),
    fetchQuestProgress: async (questId: string) => {
      mockFetchQuestProgress(questId);
      if (!mockOnline) throw offline();
      const row = mockServerRow;
      if (mockResponseGate) await mockResponseGate;
      return row;
    },
    // Настоящий писатель в миниатюре: чтение, при отсутствии строки — POST
    // (`get_or_create`), снапшот с поколением — только в свою строку (#2033).
    withQuestProgress: async (
      questId: string,
      task: (progress: any) => Promise<unknown>,
      options?: { lineageId?: number },
    ) => {
      if (!mockOnline) throw offline();
      if (options?.lineageId) {
        if (mockServerRow?.id !== options.lineageId) {
          throw new QuestProgressLineageMismatch(questId, options.lineageId, mockServerRow);
        }
      } else if (!mockServerRow) {
        mockCreateProgress(questId);
        mockServerRow = {
          id: mockNextRowId++,
          current_index: 0,
          unlocked_index: 0,
          answers: {},
          attempts: {},
          hints: {},
          skipped: {},
          early_finish: false,
          show_map: true,
          completed: false,
          updated_at: '2026-09-23T10:00:00Z',
        };
      }
      return task(mockServerRow);
    },
    updateProgress: async (id: number, payload: any) => {
      mockUpdateProgress(id, payload);
      if (!mockOnline) throw offline();
      const patchError = mockPatchError;
      if (patchError) {
        if (mockResponseGate) await mockResponseGate;
        throw patchError;
      }
      if (mockServerRow?.id !== id) throw new MockApiError(404, 'Not found');
      mockServerRow = { ...mockServerRow, ...payload };
      const row = mockServerRow;
      if (mockResponseGate) await mockResponseGate;
      return row;
    },
    deleteProgress: async (id: number) => {
      mockDeleteProgress(id);
      if (!mockOnline) throw offline();
      if (mockDeleteError) throw mockDeleteError;
      if (mockServerRow?.id !== id) throw new MockApiError(404, 'Not found');
      mockServerRow = null;
    },
  };
});

import { useQuestProgressSync } from '@/hooks/useQuestsApi';
import { useAuthStore } from '@/stores/authStore';
import {
  QUEST_PROGRESS_DELETIONS_KEY,
  QUEST_PROGRESS_QUEUE_KEY,
  __resetQuestProgressQueue,
  flushQuestProgressQueue,
} from '@/utils/questProgressQueue';

const QUEST = 'krakow-dragon';
const OWNER = '169';

/** Пройденное прохождение, которое игрок сбрасывает. */
const FINISHED_ROW = {
  id: 42,
  quest: 1,
  user: 169,
  current_index: 4,
  unlocked_index: 4,
  answers: { intro: 'start', 'step-1': 'дракон', 'step-2': 'костёл' },
  attempts: { 'step-1': 2 },
  hints: {},
  skipped: {},
  early_finish: false,
  show_map: true,
  completed: true,
  completed_at: '2026-09-20T10:00:00Z',
  created_at: '2026-09-20T09:00:00Z',
  updated_at: '2026-09-20T10:00:00Z',
};

/**
 * Новое прохождение после сброса: «Начать квест» и подсказка к первой точке,
 * поколения ещё нет. Подсказки в старой строке нет — слияние с ней обязано
 * было бы уйти PATCH-ем.
 */
const NEW_RUN = {
  currentIndex: 1,
  unlockedIndex: 1,
  answers: { intro: 'start' },
  attempts: {},
  hints: { 'step-1': true },
  showMap: true,
  completed: false,
  serverId: 0,
};

/** Сохранение прежнего прохождения до «Сбросить»: подсказка, которой в строке 42 нет. */
const FINISHED_RUN_SAVE = {
  currentIndex: 4,
  unlockedIndex: 4,
  answers: FINISHED_ROW.answers,
  attempts: FINISHED_ROW.attempts,
  hints: { 'step-2': true },
  showMap: true,
  completed: true,
  serverId: 42,
};

const holdResponses = (): (() => void) => {
  let release!: () => void;
  mockResponseGate = new Promise<void>((resolve) => { release = resolve; });
  return release;
};

const flushMicrotasks = async () => {
  await act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
};

const advance = async (ms: number) => {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
  await flushMicrotasks();
};

const readStoredList = async (key: string): Promise<any[]> => JSON.parse((await AsyncStorage.getItem(key)) ?? '[]');

const mountSync = async () => {
  const rendered = renderHook(() => useQuestProgressSync(QUEST, true));
  await flushMicrotasks();
  return rendered;
};

/** Сеть вернулась: корневой runtime (#1922) будит очередь. */
const wakeQueue = async () => {
  await act(async () => {
    await flushQuestProgressQueue();
  });
};

describe('useQuestProgressSync — «Сбросить» без сети (#2043)', () => {
  const authSnapshot = useAuthStore.getState();

  beforeEach(async () => {
    jest.useFakeTimers();
    __resetQuestProgressQueue();
    await AsyncStorage.removeItem(QUEST_PROGRESS_QUEUE_KEY);
    await AsyncStorage.removeItem(QUEST_PROGRESS_DELETIONS_KEY);
    useAuthStore.setState({ isAuthenticated: true, userId: OWNER });
    mockOnline = true;
    mockDeleteError = null;
    mockResponseGate = null;
    mockPatchError = null;
    mockServerRow = FINISHED_ROW;
    mockNextRowId = 43;
    mockFetchQuestProgress.mockReset();
    mockCreateProgress.mockReset();
    mockUpdateProgress.mockReset();
    mockDeleteProgress.mockReset();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    __resetQuestProgressQueue();
    useAuthStore.setState({ isAuthenticated: authSnapshot.isAuthenticated, userId: authSnapshot.userId });
  });

  it('сохраняет намерение удаления на диске и повторяет DELETE, когда сеть вернулась', async () => {
    const { result } = await mountSync();
    expect(result.current.progress?.id).toBe(42);

    mockOnline = false;
    let deletionPending: boolean | undefined;
    await act(async () => {
      deletionPending = await result.current.resetProgress();
    });

    expect(deletionPending).toBe(true);
    expect(mockDeleteProgress).toHaveBeenCalledWith(42);
    expect(await readStoredList(QUEST_PROGRESS_DELETIONS_KEY)).toEqual([
      expect.objectContaining({ questId: QUEST, ownerId: OWNER, progressId: 42 }),
    ]);
    // Строка сброшенного прохождения больше не состояние сервера для экрана,
    // но и «строки нет» сервер пока не подтвердил.
    expect(result.current.progress).toBeNull();
    expect(result.current.progressMissing).toBe(false);

    mockOnline = true;
    await wakeQueue();

    expect(mockDeleteProgress).toHaveBeenCalledTimes(2);
    expect(mockServerRow).toBeNull();
    expect(await readStoredList(QUEST_PROGRESS_DELETIONS_KEY)).toEqual([]);
  });

  it('намерение переживает перезапуск приложения', async () => {
    const { result, unmount } = await mountSync();
    mockOnline = false;
    await act(async () => {
      await result.current.resetProgress();
    });
    unmount();

    // Перезапуск: модульное состояние очереди пустое, на диске — намерение.
    __resetQuestProgressQueue();
    mockOnline = true;
    await wakeQueue();

    expect(mockDeleteProgress).toHaveBeenLastCalledWith(42);
    expect(mockServerRow).toBeNull();
    expect(await readStoredList(QUEST_PROGRESS_DELETIONS_KEY)).toEqual([]);
  });

  it('пока удаление не подтверждено, новое прохождение не уходит PATCH-ем в старую строку', async () => {
    const { result } = await mountSync();
    mockOnline = false;
    await act(async () => {
      await result.current.resetProgress();
    });

    // Игрок начинает заново, сети по-прежнему нет.
    act(() => {
      result.current.saveProgress(NEW_RUN);
    });
    await advance(2000);
    expect(mockUpdateProgress).not.toHaveBeenCalled();

    // Сервер снова отвечает, но удаление пока не проходит: писатель в строку 42 не идёт.
    mockOnline = true;
    mockDeleteError = new ApiError(503, 'Service unavailable');
    await advance(4000);
    await wakeQueue();
    expect(mockUpdateProgress).not.toHaveBeenCalled();
    expect(mockCreateProgress).not.toHaveBeenCalled();

    // Удаление прошло — новое прохождение создаёт свою строку без прежних ответов.
    mockDeleteError = null;
    await wakeQueue();

    expect(mockServerRow?.id).toBe(43);
    expect(mockCreateProgress).toHaveBeenCalledTimes(1);
    const deletedAt = mockDeleteProgress.mock.invocationCallOrder[mockDeleteProgress.mock.invocationCallOrder.length - 1];
    expect(deletedAt).toBeLessThan(mockCreateProgress.mock.invocationCallOrder[0]);
    expect(mockUpdateProgress.mock.calls.map(([id]) => id)).not.toContain(42);
    expect(mockServerRow).toMatchObject({
      answers: { intro: 'start' },
      hints: { 'step-1': true },
      completed: false,
    });
  });

  it('чтение при открытии квеста не отдаёт экрану строку, удаление которой ещё ждёт', async () => {
    // «Сбросить» нажато без сети в прошлый раз: намерение лежит на диске.
    await AsyncStorage.setItem(
      QUEST_PROGRESS_DELETIONS_KEY,
      JSON.stringify([{ questId: QUEST, ownerId: OWNER, progressId: 42, queuedAt: 1 }]),
    );
    __resetQuestProgressQueue();
    mockDeleteError = new ApiError(503, 'Service unavailable');

    const { result } = await mountSync();

    expect(mockDeleteProgress).toHaveBeenCalledWith(42);
    expect(mockFetchQuestProgress).not.toHaveBeenCalled();
    expect(result.current.progressLoading).toBe(false);
    expect(result.current.progress).toBeNull();
    expect(result.current.progressMissing).toBe(false);
  });

  it('открытие квеста сначала доводит удаление, затем читает уже пустой сервер', async () => {
    await AsyncStorage.setItem(
      QUEST_PROGRESS_DELETIONS_KEY,
      JSON.stringify([{ questId: QUEST, ownerId: OWNER, progressId: 42, queuedAt: 1 }]),
    );
    __resetQuestProgressQueue();

    const { result } = await mountSync();

    expect(mockDeleteProgress.mock.invocationCallOrder[0]).toBeLessThan(mockFetchQuestProgress.mock.invocationCallOrder[0]);
    expect(result.current.progress).toBeNull();
    expect(result.current.progressMissing).toBe(true);
    expect(await readStoredList(QUEST_PROGRESS_DELETIONS_KEY)).toEqual([]);
  });

  it('экран, открытый без сети, удаляет строку, с которой согласована стёртая копия визарда', async () => {
    mockOnline = false;
    const { result } = await mountSync();
    expect(result.current.progress).toBeNull();

    let deletionPending: boolean | undefined;
    await act(async () => {
      deletionPending = await result.current.resetProgress(42);
    });

    expect(deletionPending).toBe(true);
    expect(await readStoredList(QUEST_PROGRESS_DELETIONS_KEY)).toEqual([
      expect.objectContaining({ questId: QUEST, ownerId: OWNER, progressId: 42 }),
    ]);

    mockOnline = true;
    await wakeQueue();
    expect(mockServerRow).toBeNull();
  });

  it('сброс в сети: удаление подтверждено сразу, намерений на диске не остаётся', async () => {
    const { result } = await mountSync();

    let deletionPending: boolean | undefined;
    await act(async () => {
      deletionPending = await result.current.resetProgress();
    });

    expect(deletionPending).toBe(false);
    expect(mockDeleteProgress).toHaveBeenCalledTimes(1);
    expect(result.current.progressMissing).toBe(true);
    expect(await readStoredList(QUEST_PROGRESS_DELETIONS_KEY)).toEqual([]);
  });

  // Ответы на запросы, отправленные до «Сбросить», описывают стёртое прохождение.
  // Стань они состоянием экрана — визард без поколения слил бы строку 42 обратно,
  // а следующий сейв с её поколением стёр бы копию уже нового прохождения.
  it('PATCH, стартовавший до «Сбросить», не возвращает экрану строку сброшенного прохождения', async () => {
    const { result } = await mountSync();
    const releaseResponse = holdResponses();
    act(() => {
      result.current.saveProgress(FINISHED_RUN_SAVE);
    });
    await advance(2000);
    // Сервер записал PATCH, ответ ещё в сети — игрок жмёт «Сбросить».
    expect(mockUpdateProgress).toHaveBeenCalledWith(42, expect.anything());

    await act(async () => {
      await result.current.resetProgress();
    });
    expect(mockServerRow).toBeNull();

    await act(async () => {
      releaseResponse();
    });
    await flushMicrotasks();

    expect(result.current.progress).toBeNull();
    expect(result.current.progressMissing).toBe(true);
  });

  it('флаш, упавший уже после «Сбросить», не возвращает снапшот стёртого прохождения в очередь', async () => {
    const { result } = await mountSync();
    const releaseResponse = holdResponses();
    mockPatchError = new ApiError(0, 'offline', { offline: true });
    act(() => {
      result.current.saveProgress(FINISHED_RUN_SAVE);
    });
    await advance(2000);

    await act(async () => {
      await result.current.resetProgress();
    });
    await act(async () => {
      releaseResponse();
    });
    await flushMicrotasks();
    await flushMicrotasks();

    expect(await readStoredList(QUEST_PROGRESS_QUEUE_KEY)).toEqual([]);
    mockPatchError = null;
    mockResponseGate = null;
    await advance(60000);
    expect(mockUpdateProgress).toHaveBeenCalledTimes(1);
    expect(mockCreateProgress).not.toHaveBeenCalled();
  });

  it('чтение, отправленное до «Сбросить», не отдаёт экрану строку сброшенного прохождения', async () => {
    const releaseResponse = holdResponses();
    const { result } = await mountSync();
    expect(result.current.progressLoading).toBe(true);

    // Экран строку ещё не знает — удаляется поколение стёртой копии визарда.
    await act(async () => {
      await result.current.resetProgress(42);
    });
    expect(mockServerRow).toBeNull();

    await act(async () => {
      releaseResponse();
    });
    await flushMicrotasks();

    expect(result.current.progressLoading).toBe(false);
    expect(result.current.progress).toBeNull();
    expect(result.current.progressMissing).toBe(true);
  });

  it('«Сбросить» после смены аккаунта удаляет строку вошедшего игрока в его сессии', async () => {
    const { result, rerender } = renderHook(
      ({ isAuthenticated }: { isAuthenticated: boolean }) => useQuestProgressSync(QUEST, isAuthenticated),
      { initialProps: { isAuthenticated: true } },
    );
    await flushMicrotasks();
    // Прежний игрок сохранялся в этом маунте — владелец снапшота запомнен экраном.
    act(() => {
      result.current.saveProgress(FINISHED_RUN_SAVE);
    });
    await advance(2000);

    // Он вышел, и на том же экране вошёл другой игрок со своей строкой.
    useAuthStore.setState({ isAuthenticated: false, userId: null });
    rerender({ isAuthenticated: false });
    await flushMicrotasks();
    mockServerRow = { ...FINISHED_ROW, id: 77, user: 186 };
    useAuthStore.setState({ isAuthenticated: true, userId: '186' });
    rerender({ isAuthenticated: true });
    await flushMicrotasks();
    expect(result.current.progress?.id).toBe(77);

    let deletionPending: boolean | undefined;
    await act(async () => {
      deletionPending = await result.current.resetProgress();
    });

    expect(mockDeleteProgress).toHaveBeenCalledWith(77);
    expect(deletionPending).toBe(false);
    expect(mockServerRow).toBeNull();
    expect(await readStoredList(QUEST_PROGRESS_DELETIONS_KEY)).toEqual([]);
  });

  it('открытие квеста снимает из очереди запись закончившегося поколения сразу (R1)', async () => {
    // Копия пройденного прохождения ждёт отправки, а его сбросили на другом устройстве.
    await AsyncStorage.setItem(
      QUEST_PROGRESS_QUEUE_KEY,
      JSON.stringify([{
        questId: QUEST,
        ownerId: OWNER,
        snapshot: { ...NEW_RUN, answers: FINISHED_ROW.answers, completed: true, serverId: 42 },
        queuedAt: 1,
      }]),
    );
    __resetQuestProgressQueue();
    mockServerRow = null;

    const { result } = await mountSync();
    await flushMicrotasks();

    expect(result.current.progressMissing).toBe(true);
    expect(await readStoredList(QUEST_PROGRESS_QUEUE_KEY)).toEqual([]);
  });
});
