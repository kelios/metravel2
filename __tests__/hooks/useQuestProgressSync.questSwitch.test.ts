// Смена квеста в живой сессии (#1906). Игрок закончил квест A и открыл квест B,
// не перезагружая вкладку: на проде три прохождения получили «Пройден» и звание
// первопроходца с ответами ПРЕДЫДУЩЕГО квеста (446 `gomel-spasova`, 454
// `golshany-black-monk`, 455 `krevo-walled-maiden`). Причина — очередь отправки
// и id прохождения переживали смену `questId`.
//
// Тесты живут отдельным файлом по той же причине, что и офлайновые: они гоняют
// фейковые таймеры, а в jest-expo + RNTL те ломают `waitFor` в соседних тестах
// того же файла.
import { renderHook, act } from '@testing-library/react-native';

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isConnected: true, isInternetReachable: true, type: 'unknown' }),
}));

const mockReadOrCreateProgress = jest.fn();
const mockFetchQuestProgress = jest.fn();
const mockUpdateProgress = jest.fn();
const mockDeleteProgress = jest.fn();

jest.mock('@/api/quests', () => ({
  fetchQuestsList: jest.fn(),
  fetchQuestByQuestId: jest.fn(),
  fetchQuestReviews: jest.fn(),
  // #1905: чтение → слияние → запись сериализованы очередью писателей квеста;
  // мок отдаёт задаче серверную запись ровно как настоящий `withQuestProgress`.
  withQuestProgress: (questId: string, task: (progress: any) => Promise<unknown>) =>
    Promise.resolve(mockReadOrCreateProgress(questId)).then((progress) => task(progress)),
  fetchQuestProgress: (...args: any[]) => mockFetchQuestProgress(...args),
  updateProgress: (...args: any[]) => mockUpdateProgress(...args),
  deleteProgress: (...args: any[]) => mockDeleteProgress(...args),
}));

import { useQuestProgressSync } from '@/hooks/useQuestsApi';

const QUEST_A = 'gomel-soviet';
const QUEST_B = 'gomel-spasova';

const PROGRESS_A = {
  id: 446,
  quest: 1,
  user: 182,
  current_index: 5,
  unlocked_index: 5,
  answers: { intro: 'start', 'soviet-1': 'лев', 'soviet-2': 'мост' },
  attempts: {},
  hints: {},
  show_map: true,
  completed: false,
  completed_at: null,
  created_at: '2026-09-06T13:00:00Z',
  updated_at: '2026-09-06T13:00:00Z',
};

// Снапшот квеста A в момент ухода: пройден до конца, ответы только его шагов.
const SNAPSHOT_A = {
  currentIndex: 5,
  unlockedIndex: 5,
  answers: { intro: 'start', 'soviet-1': 'лев', 'soviet-2': 'мост' },
  attempts: {},
  hints: {},
  showMap: true,
  completed: true,
  updatedAt: Date.parse('2026-09-06T13:58:45Z'),
  answeredAt: {},
};

// Ровно то, что визард шлёт первым рендером нового квеста: нули и пустота.
const EMPTY_SNAPSHOT_B = {
  currentIndex: 0,
  unlockedIndex: 0,
  answers: {},
  attempts: {},
  hints: {},
  showMap: true,
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

describe('useQuestProgressSync — переход на следующий квест', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReadOrCreateProgress.mockReset();
    mockFetchQuestProgress.mockReset();
    mockUpdateProgress.mockReset();
    mockDeleteProgress.mockReset();
    // Квест A уже пройден и лежит на сервере, квеста B на сервере нет (404).
    mockFetchQuestProgress.mockImplementation(async (questId: string) =>
      questId === QUEST_A ? PROGRESS_A : null,
    );
    mockReadOrCreateProgress.mockImplementation(async (questId: string) => ({
      ...PROGRESS_A,
      id: questId === QUEST_A ? 446 : 447,
    }));
    mockUpdateProgress.mockImplementation(async (id: number) => ({ ...PROGRESS_A, id }));
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('не отправляет снапшот квеста A в прохождение квеста B', async () => {
    const { result, rerender } = renderHook(
      ({ questId }: { questId: string }) => useQuestProgressSync(questId, true),
      { initialProps: { questId: QUEST_A } },
    );
    await flushMicrotasks();
    expect(result.current.progress).toEqual(PROGRESS_A);

    // Последний ответ на квесте A ещё в очереди — дебаунс не истёк.
    act(() => {
      result.current.saveProgress(SNAPSHOT_A);
    });
    expect(mockUpdateProgress).not.toHaveBeenCalled();

    // Игрок открыл следующий квест, не перезагружая вкладку.
    rerender({ questId: QUEST_B });
    await flushMicrotasks();
    await advance(2000);
    await advance(120000);

    // Очередь ушла своему квесту...
    expect(mockReadOrCreateProgress).toHaveBeenCalledWith(QUEST_A);
    expect(mockUpdateProgress).toHaveBeenCalledWith(446, expect.objectContaining({
      answers: { intro: 'start', 'soviet-1': 'лев', 'soviet-2': 'мост' },
    }));
    // ...и ни одним запросом не коснулась квеста B.
    expect(mockReadOrCreateProgress).not.toHaveBeenCalledWith(QUEST_B);
    expect(mockUpdateProgress).not.toHaveBeenCalledWith(447, expect.anything());
    // Серверная запись предыдущего квеста не подставляется визарду нового.
    expect(result.current.progress).toBeNull();
  });

  it('не создаёт прохождение квеста B, пока игрок в нём ничего не сделал', async () => {
    const { result, rerender } = renderHook(
      ({ questId }: { questId: string }) => useQuestProgressSync(questId, true),
      { initialProps: { questId: QUEST_A } },
    );
    await flushMicrotasks();

    act(() => {
      result.current.saveProgress(SNAPSHOT_A);
    });
    rerender({ questId: QUEST_B });
    await flushMicrotasks();
    mockReadOrCreateProgress.mockClear();
    mockUpdateProgress.mockClear();

    // Визард нового квеста сохраняет пустой снапшот первым рендером. До #1906
    // гейт «прохождение ещё не начато» открывал id квеста A, и строка B
    // создавалась с чужими ответами и `completed`.
    act(() => {
      result.current.saveProgress(EMPTY_SNAPSHOT_B);
    });
    await advance(2000);
    await advance(120000);

    expect(mockReadOrCreateProgress).not.toHaveBeenCalled();
    expect(mockUpdateProgress).not.toHaveBeenCalled();
    expect(result.current.progress).toBeNull();
  });

  it('первый ответ на квесте B уходит только со своими данными', async () => {
    const { result, rerender } = renderHook(
      ({ questId }: { questId: string }) => useQuestProgressSync(questId, true),
      { initialProps: { questId: QUEST_A } },
    );
    await flushMicrotasks();

    act(() => {
      result.current.saveProgress(SNAPSHOT_A);
    });
    rerender({ questId: QUEST_B });
    await flushMicrotasks();
    await advance(2000);
    mockReadOrCreateProgress.mockClear();
    mockUpdateProgress.mockClear();
    // Серверная запись квеста B (её создаёт первое действие игрока) пустая.
    mockReadOrCreateProgress.mockImplementation(async () => ({
      ...PROGRESS_A,
      id: 447,
      current_index: 0,
      unlocked_index: 0,
      answers: {},
      completed: false,
    }));

    act(() => {
      result.current.saveProgress({
        ...EMPTY_SNAPSHOT_B,
        answers: { intro: 'start' },
        updatedAt: Date.now(),
        answeredAt: { intro: Date.now() },
      });
    });
    await advance(2000);

    expect(mockReadOrCreateProgress).toHaveBeenCalledWith(QUEST_B);
    expect(mockUpdateProgress).toHaveBeenCalledTimes(1);
    expect(mockUpdateProgress).toHaveBeenCalledWith(447, expect.objectContaining({
      answers: { intro: 'start' },
      completed: false,
    }));
  });

  it('на своём квесте id прохождения переживает пустое чтение (#1803)', async () => {
    // Гарантия, ради которой 404 когда-то сохранял `progressIdRef`: чтение,
    // вернувшееся ПОСЛЕ того, как флаш создал строку, не должно её забыть —
    // иначе «Начать заново» молча не удаляет прохождение на сервере.
    let resolveRead: ((value: null) => void) | null = null;
    mockFetchQuestProgress.mockImplementation(
      () => new Promise<null>((resolve) => {
        resolveRead = resolve;
      }),
    );
    mockReadOrCreateProgress.mockImplementation(async () => ({ ...PROGRESS_A, id: 500 }));
    mockUpdateProgress.mockImplementation(async (id: number) => ({ ...PROGRESS_A, id }));
    mockDeleteProgress.mockResolvedValue(undefined);

    const { result } = renderHook(() => useQuestProgressSync(QUEST_B, true));
    await flushMicrotasks();

    act(() => {
      result.current.saveProgress({ ...EMPTY_SNAPSHOT_B, answers: { intro: 'start' } });
    });
    await advance(2000);
    expect(mockReadOrCreateProgress).toHaveBeenCalledWith(QUEST_B);

    // Пустое чтение возвращается позже созданной строки.
    act(() => {
      resolveRead?.(null);
    });
    await flushMicrotasks();

    await act(async () => {
      await result.current.resetProgress();
    });
    expect(mockDeleteProgress).toHaveBeenCalledWith(500);
  });
});
