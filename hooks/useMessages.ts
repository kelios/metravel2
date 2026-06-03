import { useCallback, useEffect, useRef, useState } from 'react';
import {
    fetchMessageThreads,
    fetchMessages,
    fetchThreadByUser,
    fetchAvailableUsers,
    sendMessage,
    deleteMessage,
    deleteThread,
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
const getErrorMessage = (error: unknown, fallback: string): string =>
    error instanceof Error && typeof error.message === 'string' ? error.message : fallback;

// ---- useThreads ----

const MAX_CONSECUTIVE_FAILURES = 3;

export function useThreads(enabled: boolean = true, pollEnabled: boolean = true) {
    const [threads, setThreads] = useState<MessageThread[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const mountedRef = useRef(true);
    const consecutiveFailuresRef = useRef(0);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        consecutiveFailuresRef.current = 0;
        try {
            const data = await fetchMessageThreads();
            if (mountedRef.current) {
                setThreads(Array.isArray(data) ? data : []);
            }
        } catch (e: unknown) {
            devError('useThreads load error:', e);
            if (mountedRef.current) {
                setError(getErrorMessage(e, 'Ошибка загрузки сообщений'));
            }
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, []);

    const silentRefresh = useCallback(async () => {
        if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) return;
        try {
            const data = await fetchMessageThreads();
            if (mountedRef.current) {
                consecutiveFailuresRef.current = 0;
                setThreads(Array.isArray(data) ? data : []);
            }
        } catch {
            consecutiveFailuresRef.current += 1;
        }
    }, []);

    useEffect(() => { if (enabled) load(); }, [enabled, load]);

    useEffect(() => {
        if (!enabled || !pollEnabled) return;
        const id = setInterval(silentRefresh, THREADS_POLL_INTERVAL);
        return () => clearInterval(id);
    }, [enabled, pollEnabled, silentRefresh]);

    const setThreadUnreadCount = useCallback((threadId: number, unreadCount: number) => {
        setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, unread_count: unreadCount } : t)));
    }, []);

    return { threads, loading, error, refresh: load, setThreadUnreadCount };
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
        const requestThreadId = threadId;
        if (reset) {
            pageRef.current = 1;
            setHasMore(true);
        }
        setLoading(true);
        setError(null);
        try {
            const data: PaginatedMessages = await fetchMessages(requestThreadId, pageRef.current, 50);
            if (!mountedRef.current || requestThreadId !== threadId) return;

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
        } catch (e: unknown) {
            devError('useThreadMessages load error:', e);
            if (mountedRef.current && requestThreadId === threadId) {
                setError(getErrorMessage(e, 'Ошибка загрузки сообщений'));
            }
        } finally {
            if (mountedRef.current && requestThreadId === threadId) setLoading(false);
        }
    }, [threadId]);

    const consecutiveFailuresRef = useRef(0);

    const silentRefresh = useCallback(async () => {
        if (threadId == null || threadId < 0) return;
        if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) return;
        const requestThreadId = threadId;
        try {
            const data: PaginatedMessages = await fetchMessages(requestThreadId, 1, 50);
            if (!mountedRef.current || requestThreadId !== threadId) return;
            consecutiveFailuresRef.current = 0;
            const results = data.results || [];
            setMessages((prev) => {
                const ids = new Set(prev.map((m) => m.id));
                const newOnes = results.filter((m) => !ids.has(m.id));
                if (newOnes.length === 0) return prev;
                const merged = [...newOnes, ...prev];
                merged.sort((a, b) => {
                    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
                    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
                    if (ta !== tb) return ta - tb;
                    return a.id - b.id;
                });
                return merged;
            });
        } catch {
            consecutiveFailuresRef.current += 1;
        }
    }, [threadId]);

    useEffect(() => {
        if (threadId != null && threadId >= 0) {
            setMessages([]);
            setHasMore(true);
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
        const snapshot: { removed: Message | null; index: number } = { removed: null, index: -1 };
        setMessages((prev) => {
            const index = prev.findIndex((m) => m.id === messageId);
            if (index === -1) return prev;
            snapshot.removed = prev[index];
            snapshot.index = index;
            return prev.filter((m) => m.id !== messageId);
        });
        // Return rollback function. Читаем snapshot ВНУТРИ rollback: setMessages-updater
        // выполняется не синхронно, поэтому snapshot заполняется уже после возврата из
        // optimisticRemove, но к моменту вызова rollback — гарантированно готов. Per-call
        // объект snapshot изолирует конкурентные вызовы (нет общей мутируемой переменной).
        return () => {
            const { removed, index } = snapshot;
            if (removed) {
                setMessages((prev) => {
                    if (prev.some((m) => m.id === removed.id)) return prev;
                    const copy = [...prev];
                    copy.splice(Math.min(index, copy.length), 0, removed);
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
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const send = useCallback(async (participants: number[], text: string) => {
        setSending(true);
        setError(null);
        try {
            await sendMessage({ participants, text });
            return true;
        } catch (e: unknown) {
            devError('useSendMessage error:', e);
            if (mountedRef.current) setError(getErrorMessage(e, 'Ошибка отправки сообщения'));
            return false;
        } finally {
            if (mountedRef.current) setSending(false);
        }
    }, []);

    return { send, sending, error };
}

// ---- useDeleteMessage ----

export function useDeleteMessage() {
    const [deleting, setDeleting] = useState(false);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const remove = useCallback(async (id: number | string) => {
        setDeleting(true);
        try {
            await deleteMessage(id);
            return true;
        } catch (e: unknown) {
            devError('useDeleteMessage error:', e);
            return false;
        } finally {
            if (mountedRef.current) setDeleting(false);
        }
    }, []);

    return { remove, deleting };
}

// ---- useDeleteThread ----

export function useDeleteThread() {
    const [deleting, setDeleting] = useState(false);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const remove = useCallback(async (threadId: number | string) => {
        setDeleting(true);
        try {
            await deleteThread(threadId);
            return true;
        } catch (e: unknown) {
            devError('useDeleteThread error:', e);
            return false;
        } finally {
            if (mountedRef.current) setDeleting(false);
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
        } catch (e: unknown) {
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
        } catch (e: unknown) {
            devError('useMarkThreadRead error:', e);
        }
    }, []);

    return { mark };
}

// ---- useUnreadCount ----

export function useUnreadCount(enabled: boolean = true, pollEnabled: boolean = true) {
    const [count, setCount] = useState(0);
    const mountedRef = useRef(true);
    const consecutiveFailuresRef = useRef(0);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const load = useCallback(async () => {
        if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) return;
        try {
            const data = await fetchUnreadCount();
            if (mountedRef.current) {
                consecutiveFailuresRef.current = 0;
                setCount(data?.count ?? 0);
            }
        } catch {
            consecutiveFailuresRef.current += 1;
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
