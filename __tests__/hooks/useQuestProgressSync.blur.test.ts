// #1973: ответ за <2 с до ухода с экрана должен уйти сразу, если сеть и сессия
// живые. Раньше экран передавал `isFocused && isAuthenticated`, прощание
// принимало блюр за логаут и клало снапшот в очередь до «пробуждения».
//
// Отдельный файл: фейковые таймеры ломают `waitFor` в соседних тестах jest-expo.
import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let mockIsConnected = true;

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({
    isConnected: mockIsConnected,
    isInternetReachable: mockIsConnected,
    type: 'unknown',
  }),
}));

const mockReadOrCreateProgress = jest.fn();
const mockFetchQuestProgress = jest.fn();
const mockUpdateProgress = jest.fn();

jest.mock('@/api/quests', () => ({
  fetchQuestsList: jest.fn(),
  fetchQuestByQuestId: jest.fn(),
  fetchQuestReviews: jest.fn(),
  withQuestProgress: (questId: string, task: (progress: any) => Promise<unknown>) =>
    Promise.resolve(mockReadOrCreateProgress(questId)).then((progress) => task(progress)),
  fetchQuestProgress: (...args: any[]) => mockFetchQuestProgress(...args),
  updateProgress: (...args: any[]) => mockUpdateProgress(...args),
  deleteProgress: jest.fn(),
}));

import { useQuestProgressSync } from '@/hooks/useQuestsApi';
import { useAuthStore } from '@/stores/authStore';
import {
  QUEST_PROGRESS_QUEUE_KEY,
  __resetQuestProgressQueue,
} from '@/utils/questProgressQueue';

const QUEST_ID = 'krakow-dragon';

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

const ANSWER = {
  currentIndex: 3,
  unlockedIndex: 4,
  answers: { 'step-1': 'дракон', 'step-2': 'костёл' },
  attempts: { 'step-2': 1 },
  hints: {},
  showMap: false,
};

type SyncProps = { questId: string | undefined; isAuthenticated: boolean };

const flushMicrotasks = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('useQuestProgressSync — уход с экрана раньше дебаунса (#1973)', () => {
  const authSnapshot = useAuthStore.getState();

  beforeEach(() => {
    jest.useFakeTimers();
    __resetQuestProgressQueue();
    void AsyncStorage.removeItem(QUEST_PROGRESS_QUEUE_KEY);
    mockReadOrCreateProgress.mockReset();
    mockFetchQuestProgress.mockReset();
    mockUpdateProgress.mockReset();
    mockFetchQuestProgress.mockResolvedValue(API_PROGRESS);
    mockReadOrCreateProgress.mockResolvedValue(API_PROGRESS);
    mockUpdateProgress.mockResolvedValue(API_PROGRESS);
    mockIsConnected = true;
    useAuthStore.setState({ isAuthenticated: true, userId: '10' });
  });

  afterEach(() => {
    useAuthStore.setState({
      isAuthenticated: authSnapshot.isAuthenticated,
      userId: authSnapshot.userId,
    });
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const mountLoaded = async (initial: SyncProps) => {
    const rendered = renderHook(
      ({ questId, isAuthenticated }: SyncProps) => useQuestProgressSync(questId, isAuthenticated),
      { initialProps: initial },
    );
    await flushMicrotasks();
    return rendered;
  };

  it('отправляет ответ сразу при блюре, если сессия и сеть живые', async () => {
    const { result, rerender } = await mountLoaded({
      questId: QUEST_ID,
      isAuthenticated: true,
    });

    act(() => {
      result.current.saveProgress(ANSWER);
    });
    expect(mockUpdateProgress).not.toHaveBeenCalled();

    // Как экран после фикса: questId снимается с фокусом, isAuthenticated остаётся.
    rerender({ questId: undefined, isAuthenticated: true });
    await flushMicrotasks();

    expect(mockUpdateProgress).toHaveBeenCalledTimes(1);
    expect(mockUpdateProgress).toHaveBeenCalledWith(42, expect.objectContaining({
      answers: ANSWER.answers,
    }));
    expect(JSON.parse((await AsyncStorage.getItem(QUEST_PROGRESS_QUEUE_KEY)) ?? '[]')).toHaveLength(0);
  });

  it('не принимает блюр за логаут, даже если проп уже false', async () => {
    const { result, rerender } = await mountLoaded({
      questId: QUEST_ID,
      isAuthenticated: true,
    });

    act(() => {
      result.current.saveProgress(ANSWER);
    });
    expect(mockUpdateProgress).not.toHaveBeenCalled();

    // Старый экран: `isFocused && isAuthenticated` на блюре давал false.
    rerender({ questId: undefined, isAuthenticated: false });
    await flushMicrotasks();

    expect(mockUpdateProgress).toHaveBeenCalledTimes(1);
    expect(mockUpdateProgress).toHaveBeenCalledWith(42, expect.objectContaining({
      answers: ANSWER.answers,
    }));
    expect(JSON.parse((await AsyncStorage.getItem(QUEST_PROGRESS_QUEUE_KEY)) ?? '[]')).toHaveLength(0);
  });

  it('гостю не шлёт ни одного запроса прогресса', async () => {
    useAuthStore.setState({ isAuthenticated: false, userId: null });
    mockFetchQuestProgress.mockClear();
    mockReadOrCreateProgress.mockClear();
    mockUpdateProgress.mockClear();

    const { result, rerender } = renderHook(
      ({ questId, isAuthenticated }: SyncProps) => useQuestProgressSync(questId, isAuthenticated),
      { initialProps: { questId: QUEST_ID, isAuthenticated: false } },
    );
    await flushMicrotasks();

    act(() => {
      result.current.saveProgress(ANSWER);
    });
    rerender({ questId: undefined, isAuthenticated: false });
    await flushMicrotasks();
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    await flushMicrotasks();

    expect(mockFetchQuestProgress).not.toHaveBeenCalled();
    expect(mockReadOrCreateProgress).not.toHaveBeenCalled();
    expect(mockUpdateProgress).not.toHaveBeenCalled();
  });

  it('без сети кладёт снапшот в очередь, а не шлёт повторный запрос', async () => {
    mockIsConnected = false;
    const { result, rerender } = await mountLoaded({
      questId: QUEST_ID,
      isAuthenticated: true,
    });

    act(() => {
      result.current.saveProgress(ANSWER);
    });
    expect(mockUpdateProgress).not.toHaveBeenCalled();

    rerender({ questId: undefined, isAuthenticated: true });
    await flushMicrotasks();

    expect(mockUpdateProgress).not.toHaveBeenCalled();
    const queued = JSON.parse((await AsyncStorage.getItem(QUEST_PROGRESS_QUEUE_KEY)) ?? '[]');
    expect(queued).toHaveLength(1);
    expect(queued[0].questId).toBe(QUEST_ID);
    expect(queued[0].snapshot.answers).toEqual(ANSWER.answers);
  });
});
