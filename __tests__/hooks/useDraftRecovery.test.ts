import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

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
  const originalPlatform = Platform.OS;

  const setPlatformOs = (os: string) => {
    Object.defineProperty(Platform, 'OS', {
      value: os,
      configurable: true,
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setPlatformOs('ios');
    localStorage.clear();
    void AsyncStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => {
    setPlatformOs(originalPlatform);
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

  it('does not flush loaded server data on web pagehide before user edits', async () => {
    setPlatformOs('web');

    renderHook(() =>
      useDraftRecovery({
        travelId,
        isNew: false,
        enabled: true,
        currentData: { name: 'draft-on-hide', optional: undefined } as any,
      })
    );

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(localStorage.getItem(draftKey)).toBeNull();
  });

  it('uses a stable `_new` key for a new travel (never `_null`)', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() =>
      useDraftRecovery({
        travelId: null,
        isNew: true,
        enabled: true,
        currentData: { name: 'server' } as any,
      })
    );

    act(() => {
      result.current.saveDraft({ name: 'draft' } as any);
    });
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(await AsyncStorage.getItem('metravel_travel_draft_new')).toBeTruthy();
    expect(await AsyncStorage.getItem('metravel_travel_draft_null')).toBeNull();
  });

  it('does not write a draft while travelId is unresolved for an existing travel', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() =>
      useDraftRecovery({
        travelId: null,
        isNew: false,
        enabled: true,
        currentData: { name: 'server' } as any,
      })
    );

    act(() => {
      result.current.saveDraft({ name: 'draft' } as any);
    });
    act(() => {
      jest.advanceTimersByTime(2100);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem('metravel_travel_draft_null')).toBeNull();
  });

  it('clearDraft cancels a pending autosave debounce so no orphan draft is written', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() =>
      useDraftRecovery({
        travelId,
        isNew: false,
        enabled: true,
        currentData: { name: 'server' } as any,
      })
    );

    act(() => {
      result.current.saveDraft({ name: 'pending' } as any);
    });

    // Clear before the debounce fires (simulates autosave succeeding mid-debounce).
    await act(async () => {
      await result.current.clearDraft();
    });

    act(() => {
      jest.advanceTimersByTime(2100);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(draftKey)).toBeNull();
  });

  it('drops the old-key draft when isNew flips to false and id appears (F-09 P2)', async () => {
    // Simulate a NEW travel that autosaved: a draft exists under `_new`, then the
    // server id is reflected in the URL so the key transitions to `_<id>`.
    await AsyncStorage.setItem(
      'metravel_travel_draft_new',
      JSON.stringify({ data: { name: 'draft-while-new' }, timestamp: Date.now() - 1_000 })
    );

    const { result, rerender } = renderHook(
      (props: { travelId: string | null; isNew: boolean }) =>
        useDraftRecovery({
          travelId: props.travelId,
          isNew: props.isNew,
          enabled: true,
          currentData: { name: 'server' } as any,
        }),
      {
        initialProps: { travelId: null as string | null, isNew: true },
      }
    );

    // The new travel got id 777; controller pushes it into the URL.
    rerender({ travelId: '777', isNew: false });

    await waitFor(() => {
      // The old `_new` draft must be gone so it cannot resurface under `_777`.
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('metravel_travel_draft_new');
    });

    expect(await AsyncStorage.getItem('metravel_travel_draft_new')).toBeNull();

    // No false recovery prompt under the new key.
    await waitFor(() => {
      expect(result.current.hasPendingDraft).toBe(false);
    });
    expect(await AsyncStorage.getItem('metravel_travel_draft_777')).toBeNull();
  });

  it('still recovers a genuine draft saved under the post-transition `_<id>` key (legit recovery preserved)', async () => {
    // After a NEW travel's first save the draft key becomes `_<id>`. If the user
    // edits AFTER that save and leaves before the next autosave, a real draft lives
    // under `_<id>` and MUST still surface as a recovery prompt on reload — the P2
    // fix only suppresses the FALSE draft written during the id-transition, not a
    // genuine post-save edit.
    await AsyncStorage.setItem(
      'metravel_travel_draft_888',
      JSON.stringify({ data: { name: 'edited-after-save' }, timestamp: Date.now() - 1_000 })
    );

    const { result } = renderHook(() =>
      useDraftRecovery({
        travelId: '888',
        isNew: false,
        enabled: true,
        currentData: { name: 'server-after-reload' } as any,
      })
    );

    // Let the async storage read inside the mount-check effect resolve and the
    // resulting setState flush.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.hasPendingDraft).toBe(true);
  });

  it('flushes the latest pending draft on web pagehide', async () => {
    setPlatformOs('web');

    const { result } = renderHook(() =>
      useDraftRecovery({
        travelId,
        isNew: false,
        enabled: true,
        currentData: { name: 'server-data', optional: undefined } as any,
      })
    );

    act(() => {
      result.current.saveDraft({ name: 'draft-on-hide', optional: undefined } as any);
    });

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    await waitFor(() => {
      const stored = localStorage.getItem(draftKey);
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored as string).data).toEqual({ name: 'draft-on-hide' });
    });
  });
});
