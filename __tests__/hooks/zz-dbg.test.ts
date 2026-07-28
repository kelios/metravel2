import { renderHook, act, waitFor } from '@testing-library/react-native';

const mockFetchOrCreateProgress = jest.fn();
const mockUpdateProgress = jest.fn();
let mockIsConnected = true;

jest.mock('@/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isConnected: mockIsConnected, isInternetReachable: mockIsConnected, type: 'unknown' }),
}));
jest.mock('@/api/quests', () => ({
  fetchQuestsList: jest.fn(), fetchQuestByQuestId: jest.fn(), fetchQuestCities: jest.fn(),
  fetchOrCreateProgress: (...a: any[]) => mockFetchOrCreateProgress(...a),
  updateProgress: (...a: any[]) => mockUpdateProgress(...a),
  deleteProgress: jest.fn(),
}));

import { useQuestProgressSync } from '@/hooks/useQuestsApi';
const API_PROGRESS: any = { id: 42, answers: {}, current_index: 0, unlocked_index: 0, attempts: {}, hints: {}, show_map: true };

beforeEach(() => {
  [mockFetchOrCreateProgress, mockUpdateProgress].forEach((m) => m.mockReset());
  mockUpdateProgress.mockResolvedValue(API_PROGRESS);
  mockIsConnected = true;
});
afterEach(() => { jest.useRealTimers(); });

it('A: fake timers + explicit unmount', async () => {
  jest.useFakeTimers();
  mockFetchOrCreateProgress.mockResolvedValueOnce(API_PROGRESS);
  const { result, unmount } = renderHook(() => useQuestProgressSync('q', true));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  mockUpdateProgress.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(API_PROGRESS);
  act(() => { result.current.saveProgress({ currentIndex: 1, unlockedIndex: 1, answers: { a: 'b' }, attempts: {}, hints: {}, showMap: true }); });
  act(() => { jest.advanceTimersByTime(2000); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(mockUpdateProgress).toHaveBeenCalledTimes(1);
  jest.useRealTimers();
  unmount();
});

it('B: real timers after', async () => {
  mockFetchOrCreateProgress.mockResolvedValueOnce(API_PROGRESS);
  const { result } = renderHook(() => useQuestProgressSync('q', true));
  await new Promise((r) => setTimeout(r, 50));
  console.log('CALLS', mockFetchOrCreateProgress.mock.calls.length, 'loading', result.current.progressLoading, 'progress', JSON.stringify(result.current.progress));
  await waitFor(() => expect(result.current.progressLoading).toBe(false));
  expect(result.current.progress).toEqual(API_PROGRESS);
});
