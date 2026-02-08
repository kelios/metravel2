import { useCallback, useEffect, useRef, useState } from 'react';
import {
    fetchMessageThreads,
    fetchMessages,
    fetchThreadByUser,
    fetchAvailableUsers,
    sendMessage,
    deleteMessage,
    markThreadRead,
    fetchUnreadCount,
    type MessageThread,
    type Message,
    type MessagingUser,
    type PaginatedMessages,
} from '@/api/messages';
import { devError } from '@/utils/logger';

const THREADS_POLL_INTERVAL = 30_000;
const MESSAGES_POLL_INTERVAL = 10_000;

// ---- useThreads ----

export function useThreads(enabled: boolean = true, pollEnabled: boolean = true) {
    const [threads, setThreads] = useState<MessageThread[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchMessageThreads();
            if (mountedRef.current) {
                setThreads(Array.isArray(data) ? data : []);
            }
        } catch (e: any) {
            devError('useThreads load error:', e);
            if (mountedRef.current) {
                setError(e?.message || 'Ошибка загрузки сообщений');
            }
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, []);

    const silentRefresh = useCallback(async () => {
        try {
            const data = await fetchMessageThreads();
            if (mountedRef.current) {
                setThreads(Array.isArray(data) ? data : []);
            }
        } catch {
            // silent — polling errors should not disrupt UI
        }
    }, []);

    useEffect(() => { if (enabled) load(); }, [enabled, load]);

    useEffect(() => {
        if (!enabled || !pollEnabled) return;
        const id = setInterval(silentRefresh, THREADS_POLL_INTERVAL);
        return () => clearInterval(id);
    }, [enabled, pollEnabled, silentRefresh]);

    return { threads, loading, error, refresh: load };
}

// ---- useThreadMessages ----

export function useThreadMessages(threadId: number | null, pollEnabled: boolean = true) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const pageRef = useRef(1);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const load = useCallback(async (reset = false) => {
        if (threadId == null || threadId < 0) return;
        if (reset) {
            pageRef.current = 1;
            setHasMore(true);
        }
        setLoading(true);
        setError(null);
        try {
            const data: PaginatedMessages = await fetchMessages(threadId, pageRef.current, 50);
            if (!mountedRef.current) return;

            const results = data.results || [];

            if (reset) {
                setMessages(results);
            } else {
                setMessages((prev) => {
                    const ids = new Set(prev.map((m) => m.id));
                    const newOnes = results.filter((m) => !ids.has(m.id));
                    return [...prev, ...newOnes];
                });
            }

            setHasMore(!!data.next);
            pageRef.current += 1;
        } catch (e: any) {
            devError('useThreadMessages load error:', e);
            if (mountedRef.current) {
                setError(e?.message || 'Ошибка загрузки сообщений');
            }
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, [threadId]);

    const silentRefresh = useCallback(async () => {
        if (threadId == null || threadId < 0) return;
        try {
            const data: PaginatedMessages = await fetchMessages(threadId, 1, 50);
            if (!mountedRef.current) return;
            const results = data.results || [];
            setMessages((prev) => {
                const ids = new Set(prev.map((m) => m.id));
                const newOnes = results.filter((m) => !ids.has(m.id));
                if (newOnes.length === 0) return prev;
                return [...newOnes, ...prev];
            });
        } catch {
            // silent — polling errors should not disrupt UI
        }
    }, [threadId]);

    useEffect(() => {
        if (threadId != null && threadId >= 0) {
            load(true);
        } else {
            setMessages([]);
        }
    }, [threadId, load]);

    useEffect(() => {
        if (threadId == null || threadId < 0 || !pollEnabled) return;
        const id = setInterval(silentRefresh, MESSAGES_POLL_INTERVAL);
        return () => clearInterval(id);
    }, [threadId, pollEnabled, silentRefresh]);

    const optimisticRemove = useCallback((messageId: number) => {
        let removed: Message | null = null;
        let index = -1;
        setMessages((prev) => {
            index = prev.findIndex((m) => m.id === messageId);
            if (index === -1) return prev;
            removed = prev[index];
            return prev.filter((m) => m.id !== messageId);
        });
        // Return rollback function
        return () => {
            if (removed) {
                const msg = removed;
                const idx = index;
                setMessages((prev) => {
                    if (prev.some((m) => m.id === msg.id)) return prev;
                    const copy = [...prev];
                    copy.splice(Math.min(idx, copy.length), 0, msg);
                    return copy;
                });
            }
        };
    }, []);

    return { messages, loading, error, hasMore, loadMore: () => load(false), refresh: () => load(true), optimisticRemove };
}

// ---- useSendMessage ----

export function useSendMessage() {
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const send = useCallback(async (participants: number[], text: string) => {
        setSending(true);
        setError(null);
        try {
            await sendMessage({ participants, text });
            return true;
        } catch (e: any) {
            devError('useSendMessage error:', e);
            setError(e?.message || 'Ошибка отправки сообщения');
            return false;
        } finally {
            setSending(false);
        }
    }, []);

    return { send, sending, error };
}

// ---- useDeleteMessage ----

export function useDeleteMessage() {
    const [deleting, setDeleting] = useState(false);

    const remove = useCallback(async (id: number | string) => {
        setDeleting(true);
        try {
            await deleteMessage(id);
            return true;
        } catch (e: any) {
            devError('useDeleteMessage error:', e);
            return false;
        } finally {
            setDeleting(false);
        }
    }, []);

    return { remove, deleting };
}

// ---- useAvailableUsers ----

export function useAvailableUsers(enabled: boolean = true) {
    const [users, setUsers] = useState<MessagingUser[]>([]);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchAvailableUsers();
            setUsers(Array.isArray(data) ? data : []);
        } catch (e: any) {
            devError('useAvailableUsers error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (enabled) load(); }, [enabled, load]);

    return { users, loading, refresh: load };
}

// ---- useThreadByUser ----

export function useThreadByUser(userId: number | null) {
    const [threadId, setThreadId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (userId == null) {
            setThreadId(null);
            return;
        }
        let cancelled = false;
        setLoading(true);
        fetchThreadByUser(userId)
            .then((res) => {
                if (!cancelled) setThreadId(res.thread_id ?? null);
            })
            .catch((e) => {
                devError('useThreadByUser error:', e);
                if (!cancelled) setThreadId(null);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [userId]);

    return { threadId, loading };
}

// ---- useMarkThreadRead ----

export function useMarkThreadRead() {
    const mark = useCallback(async (threadId: number) => {
        if (threadId < 0) return;
        try {
            await markThreadRead(threadId);
        } catch (e: any) {
            devError('useMarkThreadRead error:', e);
        }
    }, []);

    return { mark };
}

// ---- useUnreadCount ----

export function useUnreadCount(enabled: boolean = true, pollEnabled: boolean = true) {
    const [count, setCount] = useState(0);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const load = useCallback(async () => {
        try {
            const data = await fetchUnreadCount();
            if (mountedRef.current) {
                setCount(data?.count ?? 0);
            }
        } catch {
            // silent
        }
    }, []);

    useEffect(() => { if (enabled) load(); }, [enabled, load]);

    useEffect(() => {
        if (!enabled || !pollEnabled) return;
        const id = setInterval(load, THREADS_POLL_INTERVAL);
        return () => clearInterval(id);
    }, [enabled, pollEnabled, load]);

    return { count, refresh: load };
}
