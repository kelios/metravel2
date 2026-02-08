import { useCallback, useEffect, useRef, useState } from 'react';
import {
    fetchMessageThreads,
    fetchMessages,
    fetchThreadByUser,
    fetchAvailableUsers,
    sendMessage,
    deleteMessage,
    type MessageThread,
    type Message,
    type MessagingUser,
    type PaginatedMessages,
} from '@/api/messages';
import { devError } from '@/utils/logger';

// ---- useThreads ----

export function useThreads() {
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

    useEffect(() => { load(); }, [load]);

    return { threads, loading, error, refresh: load };
}

// ---- useThreadMessages ----

export function useThreadMessages(threadId: number | null) {
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
        if (threadId == null) return;
        if (reset) {
            pageRef.current = 1;
            setHasMore(true);
        }
        setLoading(true);
        setError(null);
        try {
            const data: PaginatedMessages = await fetchMessages(pageRef.current, 50);
            if (!mountedRef.current) return;

            const threadMessages = (data.results || []).filter(
                (m) => m.thread === threadId
            );

            if (reset) {
                setMessages(threadMessages);
            } else {
                setMessages((prev) => {
                    const ids = new Set(prev.map((m) => m.id));
                    const newOnes = threadMessages.filter((m) => !ids.has(m.id));
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

    useEffect(() => {
        if (threadId != null) {
            load(true);
        } else {
            setMessages([]);
        }
    }, [threadId, load]);

    return { messages, loading, error, hasMore, loadMore: () => load(false), refresh: () => load(true) };
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

export function useAvailableUsers() {
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

    useEffect(() => { load(); }, [load]);

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
