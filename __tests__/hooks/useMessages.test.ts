import { renderHook, act, waitFor } from '@testing-library/react-native';

// Mock the API module
const mockFetchMessageThreads = jest.fn();
const mockFetchMessages = jest.fn();
const mockFetchAvailableUsers = jest.fn();
const mockFetchThreadByUser = jest.fn();
const mockSendMessage = jest.fn();
const mockDeleteMessage = jest.fn();
const mockMarkThreadRead = jest.fn();
const mockFetchUnreadCount = jest.fn();

jest.mock('@/api/messages', () => ({
  fetchMessageThreads: (...args: any[]) => mockFetchMessageThreads(...args),
  fetchMessages: (...args: any[]) => mockFetchMessages(...args),
  fetchAvailableUsers: (...args: any[]) => mockFetchAvailableUsers(...args),
  fetchThreadByUser: (...args: any[]) => mockFetchThreadByUser(...args),
  sendMessage: (...args: any[]) => mockSendMessage(...args),
  deleteMessage: (...args: any[]) => mockDeleteMessage(...args),
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
  unread_count: 3,
  last_message_text: 'Hello!',
};

const THREAD_2 = {
  id: 2,
  participants: [1, 3],
  created_at: '2024-01-02T00:00:00Z',
  last_message_created_at: '2024-06-14T10:00:00Z',
  unread_count: 0,
  last_message_text: null,
};

const MSG_1 = { id: 1, thread: 1, sender: 1, text: 'Hi', created_at: '2024-06-15T10:00:00Z' };
const MSG_2 = { id: 2, thread: 1, sender: 2, text: 'Hello', created_at: '2024-06-15T10:01:00Z' };

const PAGINATED_MESSAGES = {
  count: 2,
  next: null,
  previous: null,
  results: [MSG_1, MSG_2],
};

const USER_1 = { id: 1, first_name: 'John', last_name: 'Doe', avatar: null, user: 10 };

// ---- Tests ----

describe('useThreads', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads threads on mount when enabled', async () => {
    mockFetchMessageThreads.mockResolvedValueOnce([THREAD_1, THREAD_2]);

    const { result } = renderHook(() => useThreads(true, false));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.threads).toHaveLength(2);
    expect(result.current.threads[0].id).toBe(1);
    expect(result.current.error).toBeNull();
    expect(mockFetchMessageThreads).toHaveBeenCalledTimes(1);
  });

  it('does not load when disabled', async () => {
    const { result } = renderHook(() => useThreads(false, false));

    // Give it a tick
    await act(async () => {});

    expect(mockFetchMessageThreads).not.toHaveBeenCalled();
    expect(result.current.threads).toEqual([]);
  });

  it('sets error on failure', async () => {
    mockFetchMessageThreads.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useThreads(true, false));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Network error');
    expect(result.current.threads).toEqual([]);
  });

  it('refresh reloads data', async () => {
    mockFetchMessageThreads.mockResolvedValueOnce([THREAD_1]);

    const { result } = renderHook(() => useThreads(true, false));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.threads).toHaveLength(1);

    mockFetchMessageThreads.mockResolvedValueOnce([THREAD_1, THREAD_2]);
    await act(async () => { await result.current.refresh(); });

    expect(result.current.threads).toHaveLength(2);
  });

  it('handles non-array response gracefully', async () => {
    mockFetchMessageThreads.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useThreads(true, false));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.threads).toEqual([]);
  });
});

describe('useThreadMessages', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads messages for a thread', async () => {
    mockFetchMessages.mockResolvedValueOnce(PAGINATED_MESSAGES);

    const { result } = renderHook(() => useThreadMessages(1, false));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.hasMore).toBe(false);
    expect(mockFetchMessages).toHaveBeenCalledWith(1, 1, 50);
  });

  it('does not load for null threadId', async () => {
    const { result } = renderHook(() => useThreadMessages(null, false));

    await act(async () => {});

    expect(mockFetchMessages).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it('does not load for virtual thread (id < 0)', async () => {
    const { result } = renderHook(() => useThreadMessages(-1, false));

    await act(async () => {});

    expect(mockFetchMessages).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it('sets error on failure', async () => {
    mockFetchMessages.mockRejectedValueOnce(new Error('Server error'));

    const { result } = renderHook(() => useThreadMessages(1, false));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Server error');
  });

  it('tracks hasMore from pagination', async () => {
    mockFetchMessages.mockResolvedValueOnce({
      ...PAGINATED_MESSAGES,
      next: 'http://api/messages/?page=2',
    });

    const { result } = renderHook(() => useThreadMessages(1, false));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hasMore).toBe(true);
  });

  it('clears messages when threadId changes to null', async () => {
    mockFetchMessages.mockResolvedValueOnce(PAGINATED_MESSAGES);

    const { result, rerender } = renderHook(
      ({ id }) => useThreadMessages(id, false),
      { initialProps: { id: 1 as number | null } }
    );

    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    rerender({ id: null });

    await waitFor(() => expect(result.current.messages).toEqual([]));
  });

  it('optimisticRemove removes message from list immediately', async () => {
    mockFetchMessages.mockResolvedValueOnce(PAGINATED_MESSAGES);

    const { result } = renderHook(() => useThreadMessages(1, false));
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    act(() => {
      result.current.optimisticRemove(1);
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].id).toBe(2);
  });

  it('optimisticRemove rollback restores message', async () => {
    mockFetchMessages.mockResolvedValueOnce(PAGINATED_MESSAGES);

    const { result } = renderHook(() => useThreadMessages(1, false));
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    let rollback: () => void;
    act(() => {
      rollback = result.current.optimisticRemove(1);
    });

    expect(result.current.messages).toHaveLength(1);

    act(() => {
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

    const { result } = renderHook(() => useSendMessage());

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

    const { result } = renderHook(() => useSendMessage());

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

    const { result } = renderHook(() => useSendMessage());

    let sendPromise: Promise<boolean>;
    act(() => {
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

    const { result } = renderHook(() => useDeleteMessage());

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

    const { result } = renderHook(() => useDeleteMessage());

    let success: boolean | undefined;
    await act(async () => {
      success = await result.current.remove(5);
    });

    expect(success).toBe(false);
  });
});

describe('useAvailableUsers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads users when enabled', async () => {
    mockFetchAvailableUsers.mockResolvedValueOnce([USER_1]);

    const { result } = renderHook(() => useAvailableUsers(true));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.users).toHaveLength(1);
    expect(result.current.users[0].first_name).toBe('John');
  });

  it('does not load when disabled', async () => {
    const { result } = renderHook(() => useAvailableUsers(false));

    await act(async () => {});

    expect(mockFetchAvailableUsers).not.toHaveBeenCalled();
    expect(result.current.users).toEqual([]);
  });

  it('handles non-array response', async () => {
    mockFetchAvailableUsers.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useAvailableUsers(true));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.users).toEqual([]);
  });
});

describe('useThreadByUser', () => {
  beforeEach(() => jest.clearAllMocks());

  it('finds existing thread', async () => {
    mockFetchThreadByUser.mockResolvedValueOnce({ thread_id: 42 });

    const { result } = renderHook(() => useThreadByUser(10));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.threadId).toBe(42);
    expect(mockFetchThreadByUser).toHaveBeenCalledWith(10);
  });

  it('returns null when no thread exists', async () => {
    mockFetchThreadByUser.mockResolvedValueOnce({ thread_id: null });

    const { result } = renderHook(() => useThreadByUser(10));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.threadId).toBeNull();
  });

  it('does not fetch when userId is null', async () => {
    const { result } = renderHook(() => useThreadByUser(null));

    await act(async () => {});

    expect(mockFetchThreadByUser).not.toHaveBeenCalled();
    expect(result.current.threadId).toBeNull();
  });

  it('handles error gracefully', async () => {
    mockFetchThreadByUser.mockRejectedValueOnce(new Error('Not found'));

    const { result } = renderHook(() => useThreadByUser(10));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.threadId).toBeNull();
  });
});

describe('useMarkThreadRead', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls markThreadRead API', async () => {
    mockMarkThreadRead.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useMarkThreadRead());

    await act(async () => {
      await result.current.mark(7);
    });

    expect(mockMarkThreadRead).toHaveBeenCalledWith(7);
  });

  it('does not call API for virtual thread (id < 0)', async () => {
    const { result } = renderHook(() => useMarkThreadRead());

    await act(async () => {
      await result.current.mark(-1);
    });

    expect(mockMarkThreadRead).not.toHaveBeenCalled();
  });

  it('handles error silently', async () => {
    mockMarkThreadRead.mockRejectedValueOnce(new Error('Server error'));

    const { result } = renderHook(() => useMarkThreadRead());

    // Should not throw
    await act(async () => {
      await result.current.mark(7);
    });

    expect(mockMarkThreadRead).toHaveBeenCalledWith(7);
  });
});

describe('useUnreadCount', () => {
  beforeEach(() => jest.clearAllMocks());

  it('loads unread count when enabled', async () => {
    mockFetchUnreadCount.mockResolvedValueOnce({ count: 5 });

    const { result } = renderHook(() => useUnreadCount(true, false));

    await waitFor(() => expect(result.current.count).toBe(5));
  });

  it('does not load when disabled', async () => {
    const { result } = renderHook(() => useUnreadCount(false, false));

    await act(async () => {});

    expect(mockFetchUnreadCount).not.toHaveBeenCalled();
    expect(result.current.count).toBe(0);
  });

  it('defaults to 0 on error', async () => {
    mockFetchUnreadCount.mockRejectedValueOnce(new Error('Fail'));

    const { result } = renderHook(() => useUnreadCount(true, false));

    await act(async () => {});

    expect(result.current.count).toBe(0);
  });

  it('handles null/undefined count gracefully', async () => {
    mockFetchUnreadCount.mockResolvedValueOnce({});

    const { result } = renderHook(() => useUnreadCount(true, false));

    await waitFor(() => expect(mockFetchUnreadCount).toHaveBeenCalled());

    expect(result.current.count).toBe(0);
  });
});
