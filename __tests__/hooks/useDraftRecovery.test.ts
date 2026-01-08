import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useDraftRecovery } from '@/hooks/useDraftRecovery';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        store.delete(key);
      }),
      clear: jest.fn(async () => {
        store.clear();
      }),
    },
  };
});

const AsyncStorage = require('@react-native-async-storage/async-storage').default as {
  getItem: jest.Mock;
  setItem: jest.Mock;
  removeItem: jest.Mock;
  clear: jest.Mock;
};

describe('useDraftRecovery', () => {
  const travelId = '443';
  const draftKey = `metravel_travel_draft_${travelId}`;

  beforeEach(() => {
    jest.clearAllMocks();
    void AsyncStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows pending draft when storage has a recent draft different from currentData', async () => {
    await AsyncStorage.setItem(
      draftKey,
      JSON.stringify({ data: { name: 'draft' }, timestamp: Date.now() - 60_000 })
    );

    const { result } = renderHook(() =>
      useDraftRecovery({
        travelId,
        isNew: false,
        enabled: true,
        currentData: { name: 'server' } as any,
      })
    );

    await waitFor(() => {
      expect(result.current.hasPendingDraft).toBe(true);
    });
  });

  it('auto-removes pending draft when it is identical to currentData (ignores undefined shape diffs)', async () => {
    await AsyncStorage.setItem(
      draftKey,
      JSON.stringify({
        data: { name: 'same', optional: undefined },
        timestamp: Date.now() - 60_000,
      })
    );

    const { result } = renderHook(() =>
      useDraftRecovery({
        travelId,
        isNew: false,
        enabled: true,
        currentData: { name: 'same' } as any,
      })
    );

    await waitFor(() => {
      expect(result.current.hasPendingDraft).toBe(false);
    });

    const stored = await AsyncStorage.getItem(draftKey);
    expect(stored).toBeNull();
  });

  it('does not re-check drafts on subsequent currentData changes (prevents popup on autosave)', async () => {
    await AsyncStorage.setItem(
      draftKey,
      JSON.stringify({ data: { name: 'draft' }, timestamp: Date.now() - 60_000 })
    );

    const { result, rerender } = renderHook(
      (props: { currentData: any }) =>
        useDraftRecovery({
          travelId,
          isNew: false,
          enabled: true,
          currentData: props.currentData,
        }),
      {
        initialProps: { currentData: { name: 'server' } },
      }
    );

    await waitFor(() => {
      expect(result.current.hasPendingDraft).toBe(true);
    });

    // Dismiss it.
    await act(async () => {
      await result.current.dismissDraft();
    });

    expect(result.current.hasPendingDraft).toBe(false);

    // Simulate autosave updating localStorage with a new draft and currentData changing.
    await AsyncStorage.setItem(
      draftKey,
      JSON.stringify({ data: { name: 'new-draft' }, timestamp: Date.now() - 1_000 })
    );

    rerender({ currentData: { name: 'server-after-autosave' } });

    // Because the hook checks only once per draftKey, it must NOT re-enable hasPendingDraft.
    expect(result.current.hasPendingDraft).toBe(false);
  });

  it('saveDraft writes normalized data after debounce and does not flip hasPendingDraft in same session', async () => {
    jest.useFakeTimers();
    const { result, rerender } = renderHook(
      (props: { currentData: any }) =>
        useDraftRecovery({
          travelId,
          isNew: false,
          enabled: true,
          currentData: props.currentData,
        }),
      {
        initialProps: { currentData: { name: 'server' } },
      }
    );

    expect(result.current.hasPendingDraft).toBe(false);

    act(() => {
      result.current.saveDraft({ name: 'draft', optional: undefined } as any);
    });

    act(() => {
      jest.advanceTimersByTime(2100);
    });
    // Flush microtasks from async timer callback.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);

    const stored = await AsyncStorage.getItem(draftKey);
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored as string);
    expect(parsed.data).toEqual({ name: 'draft' });

    // Rerender with changed currentData: must not trigger recovery popup.
    rerender({ currentData: { name: 'server2' } });
    expect(result.current.hasPendingDraft).toBe(false);

    // timers restored in afterEach
  });
});
