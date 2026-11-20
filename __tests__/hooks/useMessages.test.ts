import { renderHook, act, waitFor } from '@testing-library/react-native';
import { focusManager } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { createQueryWrapper } from '../helpers/testQueryClient';

// Mock the API module
const mockFetchMessageThreads = jest.fn();
const mockFetchMessages = jest.fn();
const mockFetchMessageChanges = jest.fn();
const mockFetchAvailableUsers = jest.fn();
const mockFetchThreadByUser = jest.fn();
const mockSendMessage = jest.fn();
const mockDeleteMessage = jest.fn();
const mockDeleteThread = jest.fn();
const mockMarkThreadRead = jest.fn();
const mockFetchUnreadCount = jest.fn();

jest.mock('@/api/messages', () => ({
  MESSAGE_PAGE_SIZE: 50,
  fetchMessageChanges: (...args: unknown[]) => mockFetchMessageChanges(...args),
  fetchMessageThreads: (...args: any[]) => mockFetchMessageThreads(...args),
  fetchMessages: (...args: any[]) => mockFetchMessages(...args),
  fetchAvailableUsers: (...args: any[]) => mockFetchAvailableUsers(...args),
  fetchThreadByUser: (...args: any[]) => mockFetchThreadByUser(...args),
  sendMessage: (...args: any[]) => mockSendMessage(...args),
  deleteMessage: (...args: any[]) => mockDeleteMessage(...args),
  deleteThread: (...args: any[]) => mockDeleteThread(...args),
  markThreadRead: (...args: any[]) => mockMarkThreadRead(...args),
  fetchUnreadCount: (...args: any[]) => mockFetchUnreadCount(...args),
}));

jest.mock('@/utils/logger', () => ({
  devError: jest.fn(),
}));

import {
  useThreads,
  useThreadMessages,
  useSendMessage,
  useDeleteMessage,
  useDeleteThread,
  useAvailableUsers,
  useThreadByUser,
  useMarkThreadRead,
  useUnreadCount,
} from '@/hooks/useMessages';

// ---- Fixtures ----

const THREAD_1 = {
  id: 1,
  participants: [1, 2],
  created_at: '2024-01-01T00:00:00Z',
  last_message_created_at: '2024-06-15T14:30:00Z',
};

const THREAD_2 = {
  id: 2,
  participants: [1, 3],
  created_at: '2024-01-02T00:00:00Z',
  last_message_created_at: '2024-06-14T10:00:00Z',
};

const MSG_1 = { id: 1, thread: 1, sender: 1, text: 'Hi', created_at: '2024-06-15T10:00:00Z' };
const MSG_2 = { id: 2, thread: 1, sender: 2, text: 'Hello', created_at: '2024-06-15T10:01:00Z' };

const PAGINATED_MESSAGES = {
  count: 2,
  next: null,
  previous: null,
  results: [MSG_1, MSG_2],
};

function changes(cursor: string, messages = [MSG_1, MSG_2], removed_ids: number[] = [], has_more = false) {
  return { cursor, messages, removed_ids, has_more };
}

function newestMessages(count: number, thread = 1) {
  return Array.from({ length: count }, (_, i) => ({ ...MSG_1, thread, id: count - i }));
}

async function advance(ms: number) {
  await act(async () => { await jest.advanceTimersByTimeAsync(ms); });
}

const USER_1 = { id: 1, first_name: 'John', last_name: 'Doe', avatar: null, user: 10 };

// ---- Tests ----

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('useThreads', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads threads on mount when enabled', async () => {
    const request = createDeferred<Array<typeof THREAD_1>>();
    mockFetchMessageThreads.mockReturnValueOnce(request.promise);

    const { result } = await renderHook(() => useThreads(true, false));

    expect(result.current.loading).toBe(true);

    await act(() => request.resolve([THREAD_1, THREAD_2]));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.threads).toHaveLength(2);
    expect(result.current.threads[0].id).toBe(1);
    expect(result.current.error).toBeNull();
    expect(mockFetchMessageThreads).toHaveBeenCalledTimes(1);
  });

  it('does not load when disabled', async () => {
    const { result } = await renderHook(() => useThreads(false, false));

    // Give it a tick
    await act(async () => {});

    expect(mockFetchMessageThreads).not.toHaveBeenCalled();
    expect(result.current.threads).toEqual([]);
  });

  it('sets error on failure', async () => {
    mockFetchMessageThreads.mockRejectedValueOnce(new Error('Network error'));

    const { result } = await renderHook(() => useThreads(true, false));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Network error');
    expect(result.current.threads).toEqual([]);
  });

  // #2267: пустой `threads` до первого ответа — «ещё не знаем», а не «диалогов нет».
  it('reports loaded only after the first load settles — success, empty and error alike', async () => {
    const emptyRequest = createDeferred<Array<typeof THREAD_1>>();
    mockFetchMessageThreads.mockReturnValueOnce(emptyRequest.promise);
    const empty = await renderHook(() => useThreads(true, false));
    expect(empty.result.current.loaded).toBe(false);
    await act(() => emptyRequest.resolve([]));
    await waitFor(() => expect(empty.result.current.loaded).toBe(true));
    expect(empty.result.current.threads).toEqual([]);

    const failedRequest = createDeferred<Array<typeof THREAD_1>>();
    mockFetchMessageThreads.mockReturnValueOnce(failedRequest.promise);
    const failed = await renderHook(() => useThreads(true, false));
    expect(failed.result.current.loaded).toBe(false);
    await act(() => failedRequest.reject(new Error('Network error')));
    await waitFor(() => expect(failed.result.current.loaded).toBe(true));
    expect(failed.result.current.error).toBe('Network error');
  });

  it('stays not loaded while disabled, then loads once enabled', async () => {
    mockFetchMessageThreads.mockResolvedValueOnce([THREAD_1]);
    const { result, rerender } = await renderHook(({ enabled }: { enabled: boolean }) => useThreads(enabled, false), {
      initialProps: { enabled: false },
    });

    await act(async () => {});
    expect(result.current).toMatchObject({ loaded: false, loading: false, threads: [] });

    await rerender({ enabled: true });
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.threads).toHaveLength(1);
  });

  it('refresh reloads data', async () => {
    mockFetchMessageThreads.mockResolvedValueOnce([THREAD_1]);

    const { result } = await renderHook(() => useThreads(true, false));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.threads).toHaveLength(1);

    mockFetchMessageThreads.mockResolvedValueOnce([THREAD_1, THREAD_2]);
    await act(async () => { await result.current.refresh(); });

    expect(result.current.threads).toHaveLength(2);
  });

  it('handles non-array response gracefully', async () => {
    mockFetchMessageThreads.mockResolvedValueOnce(null);

    const { result } = await renderHook(() => useThreads(true, false));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.threads).toEqual([]);
  });

  it('optimistically removes a thread and can roll it back in the original position', async () => {
    mockFetchMessageThreads.mockResolvedValueOnce([THREAD_1, THREAD_2]);

    const { result } = await renderHook(() => useThreads(true, false));
    await waitFor(() => expect(result.current.threads).toHaveLength(2));

    let rollback: () => void;
    await act(() => {
      rollback = result.current.optimisticRemove(THREAD_1.id);
    });
    expect(result.current.threads.map((thread) => thread.id)).toEqual([THREAD_2.id]);

    await act(() => rollback());
    expect(result.current.threads.map((thread) => thread.id)).toEqual([THREAD_1.id, THREAD_2.id]);
  });

  it('does not restore an optimistically deleted thread from a stale refresh response', async () => {
    mockFetchMessageThreads.mockResolvedValueOnce([THREAD_1, THREAD_2]);
    const { result } = await renderHook(() => useThreads(true, false));
    await waitFor(() => expect(result.current.threads).toHaveLength(2));

    let resolveRefresh: (threads: Array<typeof THREAD_1>) => void = () => undefined;
    mockFetchMessageThreads.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      })
    );

    let refreshPromise: Promise<void>;
    await act(() => {
      refreshPromise = result.current.refresh();
      result.current.optimisticRemove(THREAD_1.id);
    });

    await act(async () => {
      resolveRefresh([THREAD_1, THREAD_2]);
      await refreshPromise!;
    });

    expect(result.current.threads.map((thread) => thread.id)).toEqual([THREAD_2.id]);
  });
});

describe('useThreadMessages', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads messages for a thread', async () => {
    mockFetchMessageChanges.mockResolvedValueOnce(changes('checkpoint'));

    const { result } = await renderHook(() => useThreadMessages(1, false));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.hasMore).toBe(false);
    expect(mockFetchMessageChanges).toHaveBeenCalledWith(1, null, expect.any(AbortSignal));
  });

  it.each(['thread', 'owner'])('ignores late messages after changing %s', async (change) => {
    const first = createDeferred<ReturnType<typeof changes>>();
    const nextId = change === 'thread' ? 2 : 1;
    const currentPage = newestMessages(51, nextId);
    mockFetchMessageChanges.mockReturnValueOnce(first.promise).mockResolvedValueOnce(changes('current', currentPage));

    const { result, rerender } = await renderHook(
      ({ id, owner }) => useThreadMessages(id, false, owner),
      { initialProps: { id: 1, owner: 'A' } },
    );
    const oldSignal = mockFetchMessageChanges.mock.calls[0][2] as AbortSignal;
    await rerender({ id: nextId, owner: change === 'owner' ? 'B' : 'A' });
    await waitFor(() => expect(result.current.messages).toEqual(currentPage.slice(0, 50)));
    expect(oldSignal.aborted).toBe(true);

    await act(async () => first.resolve(changes('stale')));
    expect(result.current.messages).toEqual(currentPage.slice(0, 50));
    expect(result.current.hasMore).toBe(true);
    expect(result.current.loading).toBe(false);

    mockFetchMessageChanges.mockResolvedValueOnce(changes('current', []));
    mockFetchMessages.mockResolvedValueOnce({ ...PAGINATED_MESSAGES, results: [] });
    await act(async () => result.current.loadMore());
    expect(mockFetchMessages).toHaveBeenLastCalledWith(nextId, 2, 50, expect.any(AbortSignal));
  });

  it('lets explicit pagination preempt a pending poll', async () => {
    jest.useFakeTimers();
    const poll = createDeferred<ReturnType<typeof changes>>();
    const newest = newestMessages(51);
    const older = { ...MSG_1, id: 999 };
    mockFetchMessageChanges.mockResolvedValueOnce(changes('start', newest)).mockReturnValueOnce(poll.promise)
      .mockResolvedValueOnce(changes('start', []));
    mockFetchMessages.mockResolvedValueOnce({ ...PAGINATED_MESSAGES, results: [newest[50], older] });

    try {
      const { result, unmount } = await renderHook(() => useThreadMessages(1));
      await advance(10_000);
      const pollSignal = mockFetchMessageChanges.mock.calls[1][2] as AbortSignal;
      await act(async () => result.current.loadMore());
      expect(pollSignal.aborted).toBe(true);
      expect(mockFetchMessages).toHaveBeenLastCalledWith(1, 2, 50, expect.any(AbortSignal));
      await act(async () => poll.resolve(changes('stale', [{ ...MSG_1, id: 1000 }])));
      expect(result.current.messages.map((m) => m.id).sort((a, b) => a - b)).toEqual([
        ...newest.map((m) => m.id).reverse(), older.id,
      ]);
      await unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not load for null threadId', async () => {
    const { result } = await renderHook(() => useThreadMessages(null, false));

    await act(async () => {});

    expect(mockFetchMessageChanges).not.toHaveBeenCalled();
    expect(mockFetchMessages).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it('does not load for virtual thread (id < 0)', async () => {
    const { result } = await renderHook(() => useThreadMessages(-1, false));

    await act(async () => {});

    expect(mockFetchMessageChanges).not.toHaveBeenCalled();
    expect(mockFetchMessages).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it('sets error on failure', async () => {
    mockFetchMessageChanges.mockRejectedValueOnce(new Error('Server error'));

    const { result } = await renderHook(() => useThreadMessages(1, false));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Server error');
  });

  it('tracks hasMore from pagination', async () => {
    mockFetchMessageChanges.mockResolvedValueOnce(changes('start', newestMessages(51)));

    const { result } = await renderHook(() => useThreadMessages(1, false));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hasMore).toBe(true);
  });

  it('clears messages when threadId changes to null', async () => {
    mockFetchMessageChanges.mockResolvedValueOnce(changes('checkpoint'));

    const { result, rerender } = await renderHook(
      ({ id }) => useThreadMessages(id, false),
      { initialProps: { id: 1 as number | null } }
    );

    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    await rerender({ id: null });

    await waitFor(() => expect(result.current.messages).toEqual([]));
  });

  it('optimisticRemove removes message from list immediately', async () => {
    mockFetchMessageChanges.mockResolvedValueOnce(changes('checkpoint'));

    const { result } = await renderHook(() => useThreadMessages(1, false));
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    await act(() => {
      result.current.optimisticRemove(1);
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].id).toBe(2);
  });

  it('optimisticRemove rollback restores message', async () => {
    mockFetchMessageChanges.mockResolvedValueOnce(changes('checkpoint'));

    const { result } = await renderHook(() => useThreadMessages(1, false));
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    let rollback: () => void;
    await act(() => {
      rollback = result.current.optimisticRemove(1);
    });

    expect(result.current.messages).toHaveLength(1);

    await act(() => {
      rollback();
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages.find((m: any) => m.id === 1)).toBeTruthy();
  });
});

describe('useSendMessage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends message successfully', async () => {
    mockSendMessage.mockResolvedValueOnce({});

    const { result } = await renderHook(() => useSendMessage());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.send([2], 'Hello!');
    });

    expect(success).toBe(true);
    expect(result.current.sending).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockSendMessage).toHaveBeenCalledWith({ participants: [2], text: 'Hello!' });
  });

  it('returns false and sets error on failure', async () => {
    mockSendMessage.mockRejectedValueOnce(new Error('Send failed'));

    const { result } = await renderHook(() => useSendMessage());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.send([2], 'Hi');
    });

    expect(success).toBe(false);
    expect(result.current.error).toBe('Send failed');
  });

  it('sets sending=true during request', async () => {
    let resolvePromise: (v: any) => void;
    mockSendMessage.mockReturnValueOnce(new Promise(r => { resolvePromise = r; }));

    const { result } = await renderHook(() => useSendMessage());

    let sendPromise: Promise<boolean>;
    await act(() => {
      sendPromise = result.current.send([2], 'Test');
    });

    expect(result.current.sending).toBe(true);

    await act(async () => {
      resolvePromise!({});
      await sendPromise!;
    });

    expect(result.current.sending).toBe(false);
  });
});

describe('useDeleteMessage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes message successfully', async () => {
    mockDeleteMessage.mockResolvedValueOnce(null);

    const { result } = await renderHook(() => useDeleteMessage());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.remove(5);
    });

    expect(success).toBe(true);
    expect(result.current.deleting).toBe(false);
    expect(mockDeleteMessage).toHaveBeenCalledWith(5);
  });

  it('returns false on failure', async () => {
    mockDeleteMessage.mockRejectedValueOnce(new Error('Delete failed'));

    const { result } = await renderHook(() => useDeleteMessage());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.remove(5);
    });

    expect(success).toBe(false);
  });
});

describe('useDeleteThread', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes a thread successfully', async () => {
    mockDeleteThread.mockResolvedValueOnce(null);
    const { result } = await renderHook(() => useDeleteThread());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.remove(7);
    });

    expect(success).toBe(true);
    expect(result.current.deleting).toBe(false);
    expect(mockDeleteThread).toHaveBeenCalledWith(7);
  });

  it('reports failure so the screen can roll back its optimistic removal', async () => {
    mockDeleteThread.mockRejectedValueOnce(new Error('Delete failed'));
    const { result } = await renderHook(() => useDeleteThread());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.remove(7);
    });

    expect(success).toBe(false);
  });
});

describe('useAvailableUsers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads users when enabled', async () => {
    mockFetchAvailableUsers.mockResolvedValueOnce([USER_1]);

    const { result } = await renderHook(() => useAvailableUsers(true));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.users).toHaveLength(1);
    expect(result.current.users[0].first_name).toBe('John');
  });

  it('does not load when disabled', async () => {
    const { result } = await renderHook(() => useAvailableUsers(false));

    await act(async () => {});

    expect(mockFetchAvailableUsers).not.toHaveBeenCalled();
    expect(result.current.users).toEqual([]);
  });

  it('handles non-array response', async () => {
    mockFetchAvailableUsers.mockResolvedValueOnce(null);

    const { result } = await renderHook(() => useAvailableUsers(true));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.users).toEqual([]);
  });
});

describe('useThreadByUser', () => {
  beforeEach(() => jest.clearAllMocks());

  it('finds existing thread', async () => {
    mockFetchThreadByUser.mockResolvedValueOnce({ thread_id: 42 });

    const { result } = await renderHook(() => useThreadByUser(10));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.threadId).toBe(42);
    expect(mockFetchThreadByUser).toHaveBeenCalledWith(10);
  });

  it('returns null when no thread exists', async () => {
    mockFetchThreadByUser.mockResolvedValueOnce({ thread_id: null });

    const { result } = await renderHook(() => useThreadByUser(10));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.threadId).toBeNull();
  });

  it('does not fetch when userId is null', async () => {
    const { result } = await renderHook(() => useThreadByUser(null));

    await act(async () => {});

    expect(mockFetchThreadByUser).not.toHaveBeenCalled();
    expect(result.current.threadId).toBeNull();
  });

  it('handles error gracefully', async () => {
    mockFetchThreadByUser.mockRejectedValueOnce(new Error('Not found'));

    const { result } = await renderHook(() => useThreadByUser(10));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.threadId).toBeNull();
  });
});

describe('useMarkThreadRead', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls markThreadRead API', async () => {
    mockMarkThreadRead.mockResolvedValueOnce(null);

    const { result } = await renderHook(() => useMarkThreadRead());

    await act(async () => {
      await result.current.mark(7);
    });

    expect(mockMarkThreadRead).toHaveBeenCalledWith(7);
  });

  it('does not call API for virtual thread (id < 0)', async () => {
    const { result } = await renderHook(() => useMarkThreadRead());

    await act(async () => {
      await result.current.mark(-1);
    });

    expect(mockMarkThreadRead).not.toHaveBeenCalled();
  });

  it('handles error silently', async () => {
    mockMarkThreadRead.mockRejectedValueOnce(new Error('Server error'));

    const { result } = await renderHook(() => useMarkThreadRead());

    // Should not throw
    await act(async () => {
      await result.current.mark(7);
    });

    expect(mockMarkThreadRead).toHaveBeenCalledWith(7);
  });
});

describe('useUnreadCount (stubbed — backend not deployed)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 0 when enabled (stub)', async () => {
    mockFetchUnreadCount.mockResolvedValueOnce({ count: 0 });

    const { result } = await renderHook(() => useUnreadCount(true, false), {
      wrapper: createQueryWrapper().Wrapper,
    });

    await waitFor(() => expect(mockFetchUnreadCount).toHaveBeenCalled());

    expect(result.current.count).toBe(0);
  });

  it('does not load when disabled', async () => {
    const { result } = await renderHook(() => useUnreadCount(false, false), {
      wrapper: createQueryWrapper().Wrapper,
    });

    await act(async () => {});

    expect(mockFetchUnreadCount).not.toHaveBeenCalled();
    expect(result.current.count).toBe(0);
  });
});

describe('open conversation polling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    focusManager.setFocused(true);
  });
  afterEach(() => {
    focusManager.setFocused(undefined);
    jest.useRealTimers();
  });

  it('keeps ten quiet minutes under 30 background reads and never rereads message bodies', async () => {
    const firstPage = newestMessages(50);
    mockFetchMessageChanges.mockImplementation((_threadId, cursor) =>
      Promise.resolve(changes('checkpoint', cursor === null ? firstPage : [])));
    mockFetchMessageThreads.mockResolvedValue([THREAD_1]);
    const { result } = await renderHook(() => {
      useThreads();
      return useThreadMessages(1);
    });
    expect(result.current.messages).toHaveLength(50);
    expect(result.current.hasMore).toBe(false);
    mockFetchMessageThreads.mockClear();
    mockFetchMessageChanges.mockClear();
    await advance(600_000);
    const polls = mockFetchMessageChanges.mock.calls;
    const listReads = mockFetchMessageThreads.mock.calls.length;
    expect(polls.length).toBeGreaterThan(0);
    expect(listReads).toBeGreaterThan(0);
    expect(polls.length + listReads).toBeLessThanOrEqual(30);
    expect(polls.every(([, cursor]) => cursor === 'checkpoint')).toBe(true);
    expect(mockFetchMessages).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(50);
  });

  it('drains a missed page, merges by id, and returns to the fast interval on activity', async () => {
    const edited = { ...MSG_2, text: 'edited' };
    const incoming = { ...MSG_1, id: 3 };
    mockFetchMessageChanges
      .mockResolvedValueOnce(changes('start'))
      .mockResolvedValueOnce(changes('quiet', []))
      .mockResolvedValueOnce(changes('more', [edited], [MSG_1.id], true))
      .mockResolvedValueOnce(changes('done', [edited, incoming]))
      .mockResolvedValueOnce(changes('done', []));
    const { result } = await renderHook(() => useThreadMessages(1));
    await advance(10_000);
    await advance(19_999);
    expect(mockFetchMessageChanges).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(mockFetchMessageChanges.mock.calls.map(([, cursor]) => cursor)).toEqual([null, 'start', 'quiet', 'more']);
    expect([...result.current.messages].sort((a, b) => a.id - b.id)).toEqual([edited, incoming]);
    await advance(10_000);
    expect(mockFetchMessageChanges).toHaveBeenLastCalledWith(1, 'done', expect.any(AbortSignal));
  });

  it.each(['route', 'application'])('catches up on return to the %s and after sending', async (source) => {
    mockFetchMessageChanges
      .mockResolvedValueOnce(changes('start'))
      .mockResolvedValueOnce(changes('quiet', []))
      .mockResolvedValueOnce(changes('returned', []))
      .mockResolvedValueOnce(changes('sent', [{ ...MSG_1, id: 3 }]))
      .mockResolvedValueOnce(changes('sent', []));
    const { result, rerender } = await renderHook(({ visible }) => useThreadMessages(1, visible, 'A'),
      { initialProps: { visible: true } });
    await advance(10_000);
    if (source === 'route') await rerender({ visible: false });
    else await act(() => focusManager.setFocused(false));
    await advance(120_000);
    expect(mockFetchMessageChanges).toHaveBeenCalledTimes(2);
    if (source === 'route') await rerender({ visible: true });
    else await act(() => focusManager.setFocused(true));
    expect(mockFetchMessageChanges).toHaveBeenLastCalledWith(1, 'quiet', expect.any(AbortSignal));
    await act(async () => result.current.refresh());
    expect(mockFetchMessageChanges).toHaveBeenLastCalledWith(1, 'returned', expect.any(AbortSignal));
    expect(result.current.messages.map((m) => m.id)).toContain(3);
    await advance(10_000);
    expect(mockFetchMessageChanges).toHaveBeenLastCalledWith(1, 'sent', expect.any(AbortSignal));
  });

  it('retries an interrupted catch-up from the last applied cursor', async () => {
    const incoming = { ...MSG_1, id: 3 };
    mockFetchMessageChanges.mockResolvedValueOnce(changes('start', [MSG_1]))
      .mockResolvedValueOnce(changes('next-page', [MSG_2], [], true))
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce(changes('caught-up', [incoming]));
    const { result } = await renderHook(() => useThreadMessages(1));
    await advance(10_000);
    expect(result.current.messages).toEqual([MSG_1, MSG_2]);
    await act(async () => result.current.refresh());
    expect(mockFetchMessageChanges.mock.calls.map(([, cursor]) => cursor)).toEqual([null, 'start', 'next-page', 'next-page']);
    expect(result.current.messages).toEqual([MSG_1, MSG_2, incoming]);
  });

  it('evicts the old audience before a reset bootstrap resolves', async () => {
    const bootstrap = createDeferred<ReturnType<typeof changes>>();
    mockFetchMessageChanges.mockResolvedValueOnce(changes('start'))
      .mockRejectedValueOnce(new ApiError(409, 'Reset required', { code: 'reset_required' }))
      .mockReturnValueOnce(bootstrap.promise);
    const { result } = await renderHook(() => useThreadMessages(1));
    await advance(10_000);
    expect(result.current.messages).toEqual([]);
    expect(mockFetchMessageChanges).toHaveBeenLastCalledWith(1, null, expect.any(AbortSignal));
    await act(async () => bootstrap.resolve(changes('new-scope', [MSG_2])));
    expect(result.current.messages).toEqual([MSG_2]);
  });

  it.each([403, 404])('evicts cached messages and invalidates delete rollback on HTTP %i', async (status) => {
    mockFetchMessageChanges.mockResolvedValueOnce(changes('start'))
      .mockRejectedValueOnce(new ApiError(status, 'Unavailable'));
    const { result } = await renderHook(() => useThreadMessages(1));
    let rollback!: () => void;
    await act(() => { rollback = result.current.optimisticRemove(MSG_1.id); });
    await advance(10_000);
    await act(() => rollback());
    expect(result.current.messages).toEqual([]);
    expect(result.current.hasMore).toBe(false);
    expect(mockFetchMessages).not.toHaveBeenCalled();
  });

  it('keeps shifted history when a deletion races the last numbered page', async () => {
    const all = newestMessages(52);
    const remaining = all.slice(1);
    mockFetchMessageChanges.mockResolvedValueOnce(changes('before', all.slice(0, 51)))
      .mockResolvedValueOnce(changes('after', [], [all[0].id]))
      .mockResolvedValue(changes('after', []));
    mockFetchMessages.mockImplementation((_thread, page) => Promise.resolve({
      results: remaining.slice((page - 1) * 50, page * 50),
      next: page === 1 ? 'next-page' : null,
    }));
    const { result } = await renderHook(() => useThreadMessages(1));
    await act(async () => result.current.loadMore());
    await act(async () => result.current.loadMore());
    expect(mockFetchMessages.mock.calls.map(([, page]) => page)).toEqual([2, 1, 2]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.messages.map((m) => m.id)).toEqual(remaining.map((m) => m.id));
  });

  it('recovers a signed cursor rejected after rotation', async () => {
    mockFetchMessageChanges.mockResolvedValueOnce(changes('expired'))
      .mockRejectedValueOnce(new ApiError(400, 'Invalid cursor', { cursor: 'Invalid cursor.' }))
      .mockResolvedValueOnce(changes('fresh', [MSG_2]));
    const { result } = await renderHook(() => useThreadMessages(1));
    await advance(10_000);
    expect(mockFetchMessageChanges.mock.calls.map(([, cursor]) => cursor)).toEqual([null, 'expired', null]);
    expect(result.current.messages).toEqual([MSG_2]);
  });

  it('continues polling after a transient outage while the screen stays foregrounded', async () => {
    mockFetchMessageChanges.mockResolvedValueOnce(changes('saved', []))
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(changes('online-again', [MSG_1]));
    const { result } = await renderHook(() => useThreadMessages(1));
    await advance(130_000);
    expect(result.current.messages).toEqual([MSG_1]);
  });

  it('pauses a multi-page catch-up when the app backgrounds', async () => {
    const pending = createDeferred<ReturnType<typeof changes>>();
    mockFetchMessageChanges.mockResolvedValueOnce(changes('start', [MSG_1]))
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(changes('done', [MSG_2]));
    const { result } = await renderHook(() => useThreadMessages(1));
    await advance(10_000);
    await act(() => focusManager.setFocused(false));
    await act(async () => pending.resolve(changes('middle', [], [], true)));
    expect(mockFetchMessageChanges).toHaveBeenCalledTimes(2);
    await act(() => focusManager.setFocused(true));
    expect(mockFetchMessageChanges.mock.calls.map(([, cursor]) => cursor)).toEqual([null, 'start', 'middle']);
    expect(result.current.messages).toEqual([MSG_1, MSG_2]);
  });

  it('refocus replaces a still-pending background poll', async () => {
    const previous = createDeferred<ReturnType<typeof changes>>();
    mockFetchMessageChanges.mockResolvedValueOnce(changes('here', [MSG_1]))
      .mockReturnValueOnce(previous.promise)
      .mockResolvedValueOnce(changes('returned', [MSG_2]));
    const { result } = await renderHook(() => useThreadMessages(1));
    await advance(10_000);
    const signal = mockFetchMessageChanges.mock.calls[1][2] as AbortSignal;
    await act(() => focusManager.setFocused(false));
    await act(() => focusManager.setFocused(true));
    expect(signal.aborted).toBe(true);
    await act(() => previous.resolve(changes('old', [], [MSG_1.id])));
    expect(result.current.messages).toEqual([MSG_1, MSG_2]);
  });

  it('recognizes the old route only on unsupported bootstrap and polls legacy pages adaptively', async () => {
    mockFetchMessageChanges.mockRejectedValueOnce(new ApiError(405, 'Method not allowed'));
    mockFetchMessages.mockResolvedValue(PAGINATED_MESSAGES);
    const { result } = await renderHook(() => useThreadMessages(1));
    expect(result.current.messages).toEqual(PAGINATED_MESSAGES.results);
    await advance(30_000);
    expect(mockFetchMessageChanges).toHaveBeenCalledTimes(1);
    expect(mockFetchMessages).toHaveBeenCalledTimes(3);
    expect(mockFetchMessages).toHaveBeenLastCalledWith(1, 1, 50, expect.any(AbortSignal));
  });
});
