import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import {
    fetchMessageThreads,
    fetchMessages,
    fetchThreadByUser,
    fetchAvailableUsers,
    sendMessage,
    deleteMessage,
    deleteThread,
    markThreadRead,
    type MessageThread,
    type Message,
    type MessagingUser,
} from '@/api/messages';
import { devError } from '@/utils/logger';
import { getBlockedAuthorIds, subscribeAuthorBlock } from '@/api/blockSensitiveQueries';
import { translate as i18nT } from '@/i18n'


const THREADS_POLL_INTERVAL = 30_000;
const MESSAGES_POLL_INTERVAL = 10_000;
const getErrorMessage = (error: unknown, fallback: string): string =>
    error instanceof Error && typeof error.message === 'string' ? error.message : fallback;

// ---- useThreads ----

const MAX_CONSECUTIVE_FAILURES = 3;

// #2134: переписка с заблокированным скрывается сразу и после любого перечитывания.
// Списки живут в useState, а не в React Query, поэтому guard кэша их не видит —
// фильтр по набору заблокированных и подписка на блок стоят здесь.
const withoutBlockedThreads = (threads: MessageThread[]): MessageThread[] => {
    const blocked = getBlockedAuthorIds();
    if (blocked.size === 0) return threads;
    return threads.filter((thread) => !(thread.participants ?? []).some((id) => blocked.has(id)));
};

const withoutBlockedMessages = (messages: Message[]): Message[] => {
    const blocked = getBlockedAuthorIds();
    if (blocked.size === 0) return messages;
    return messages.filter((message) => !blocked.has(message.sender));
};

export function useThreads(enabled: boolean = true, pollEnabled: boolean = true) {
    const [threads, setThreads] = useState<MessageThread[]>([]);
    const [loading, setLoading] = useState(false);
    // Первая загрузка завершилась (успехом или ошибкой). До этого пустой `threads`
    // значит «ещё не знаем», а не «диалогов нет»: экран показывает загрузку, а не
    // «Нет сообщений» (#2267 — пустое состояние мелькало до ответа сервера).
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const mountedRef = useRef(true);
    const consecutiveFailuresRef = useRef(0);
    const hiddenThreadIdsRef = useRef(new Set<number>());

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
                setThreads(
                    Array.isArray(data)
                        ? withoutBlockedThreads(data.filter((thread) => !hiddenThreadIdsRef.current.has(thread.id)))
                        : [],
                );
            }
        } catch (e: unknown) {
            devError('useThreads load error:', e);
            if (mountedRef.current) {
                setError(getErrorMessage(e, i18nT('messages:hooks.useMessages.oshibka_zagruzki_soobscheniy_b3faeb10')));
            }
        } finally {
            if (mountedRef.current) {
                setLoading(false);
                setLoaded(true);
            }
        }
    }, []);

    const silentRefresh = useCallback(async () => {
        if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) return;
        try {
            const data = await fetchMessageThreads();
            if (mountedRef.current) {
                consecutiveFailuresRef.current = 0;
                setThreads(
                    Array.isArray(data)
                        ? withoutBlockedThreads(data.filter((thread) => !hiddenThreadIdsRef.current.has(thread.id)))
                        : [],
                );
            }
        } catch {
            consecutiveFailuresRef.current += 1;
        }
    }, []);

    useEffect(() => { if (enabled) load(); }, [enabled, load]);

    useEffect(() => subscribeAuthorBlock((_authorId, blocked) => {
        if (!mountedRef.current) return;
        if (blocked) setThreads((prev) => withoutBlockedThreads(prev));
        else if (enabled) void load();
    }), [enabled, load]);

    useEffect(() => {
        if (!enabled || !pollEnabled) return;
        const id = setInterval(silentRefresh, THREADS_POLL_INTERVAL);
        return () => clearInterval(id);
    }, [enabled, pollEnabled, silentRefresh]);

    const setThreadUnreadCount = useCallback((threadId: number, unreadCount: number) => {
        setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, unread_count: unreadCount } : t)));
    }, []);

    const optimisticRemove = useCallback((threadId: number) => {
        hiddenThreadIdsRef.current.add(threadId);
        const snapshot: { removed: MessageThread | null; index: number } = { removed: null, index: -1 };
        setThreads((prev) => {
            const index = prev.findIndex((thread) => thread.id === threadId);
            if (index === -1) return prev;
            snapshot.removed = prev[index];
            snapshot.index = index;
            return prev.filter((thread) => thread.id !== threadId);
        });

        return () => {
            hiddenThreadIdsRef.current.delete(threadId);
            const { removed, index } = snapshot;
            if (!removed) return;
            setThreads((prev) => {
                if (prev.some((thread) => thread.id === removed.id)) return prev;
                const next = [...prev];
                next.splice(Math.min(index, next.length), 0, removed);
                return next;
            });
        };
    }, []);

    return { threads, loading, loaded, error, refresh: load, setThreadUnreadCount, optimisticRemove };
}

// ---- useThreadMessages ----

type ThreadMessageLoadMode = 'reset' | 'more' | 'poll';

interface ThreadMessageSession {
    threadId: number | null;
    ownerId: string | null;
    page: number;
    hasMore: boolean;
    failures: number;
    request: { controller: AbortController; mode: ThreadMessageLoadMode } | null;
}

export function useThreadMessages(
    threadId: number | null,
    pollEnabled: boolean = true,
    ownerId: string | null = null,
) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const sessionRef = useRef<ThreadMessageSession | null>(null);

    const getSession = useCallback(() => {
        const session = sessionRef.current;
        return session?.threadId === threadId && session.ownerId === ownerId ? session : null;
    }, [threadId, ownerId]);

    const load = useCallback(async (mode: ThreadMessageLoadMode) => {
        const session = getSession();
        if (!session || session.threadId == null || session.threadId < 0) return;
        if (mode === 'more' && (!session.hasMore || session.page === 1)) return;
        if (mode === 'poll' && session.failures >= MAX_CONSECUTIVE_FAILURES) return;
        const pending = session.request;
        if (pending && mode !== 'reset' && (mode !== 'more' || pending.mode !== 'poll')) return;

        pending?.controller.abort();
        const request = { controller: new AbortController(), mode };
        session.request = request;
        const isCurrent = () => getSession() === session && session.request === request;
        const page = mode === 'more' ? session.page : 1;
        const initialPoll = mode === 'poll' && session.page === 1;

        if (mode !== 'poll') {
            setLoading(true);
            setError(null);
        }

        try {
            const data = await fetchMessages(session.threadId, page, 50, request.controller.signal);
            if (!isCurrent()) return;

            session.failures = 0;
            const results = withoutBlockedMessages(data.results || []);
            if (mode === 'reset' || initialPoll) {
                if (initialPoll) setError(null);
                setMessages(results);
            } else {
                setMessages((previous) => {
                    const ids = new Set(previous.map((message) => message.id));
                    const added = results.filter((message) => !ids.has(message.id));
                    if (added.length === 0) return previous;
                    if (mode === 'more') return [...previous, ...added];
                    return [...added, ...previous].sort((a, b) => {
                        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
                        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
                        return ta - tb || a.id - b.id;
                    });
                });
            }

            if (mode !== 'poll' || initialPoll) {
                session.hasMore = Boolean(data.next);
                session.page = page + 1;
                setHasMore(session.hasMore);
            }
        } catch (e: unknown) {
            if (!isCurrent()) return;
            if (mode === 'poll') {
                session.failures += 1;
            } else {
                devError('useThreadMessages load error:', e);
                setError(getErrorMessage(e, i18nT('messages:hooks.useMessages.oshibka_zagruzki_soobscheniy_b3faeb10')));
            }
        } finally {
            if (isCurrent()) {
                session.request = null;
                if (mode !== 'poll') setLoading(false);
            }
        }
    }, [getSession]);

    useLayoutEffect(() => {
        const session: ThreadMessageSession = {
            threadId, ownerId, page: 1, hasMore: true, failures: 0, request: null,
        };
        sessionRef.current = session;
        setMessages([]);
        setError(null);
        setHasMore(true);
        setLoading(threadId != null && threadId >= 0);
        return () => {
            sessionRef.current = null;
            session.request?.controller.abort();
        };
    }, [threadId, ownerId]);

    useEffect(() => { void load('reset'); }, [load]);

    useEffect(() => subscribeAuthorBlock((_authorId, blocked) => {
        if (!getSession()) return;
        if (blocked) setMessages((previous) => withoutBlockedMessages(previous));
        else void load('reset');
    }), [getSession, load]);

    useEffect(() => {
        if (threadId == null || threadId < 0 || !pollEnabled) return;
        const id = setInterval(() => void load('poll'), MESSAGES_POLL_INTERVAL);
        return () => clearInterval(id);
    }, [threadId, pollEnabled, load]);

    const optimisticRemove = useCallback((messageId: number) => {
        const session = getSession();
        if (!session) return () => {};
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
            if (getSession() === session && removed) {
                setMessages((prev) => {
                    if (prev.some((m) => m.id === removed.id)) return prev;
                    const copy = [...prev];
                    copy.splice(Math.min(index, copy.length), 0, removed);
                    return copy;
                });
            }
        };
    }, [getSession]);

    return { messages, loading, error, hasMore, loadMore: () => load('more'), refresh: () => load('reset'), optimisticRemove };
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
            if (mountedRef.current) {
                const fallback = i18nT('messages:hooks.useMessages.oshibka_otpravki_soobscheniya_b06f59fd');
                // ApiError.message — сырой текст бэкенда (англ. detail вроде «CSRF
                // Failed…»); пользователю показываем локализованный текст. Обычный
                // Error (например, локализованный 401 из sendMessage) показываем как есть.
                setError(e instanceof ApiError ? fallback : getErrorMessage(e, fallback));
            }
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

/**
 * Реализация одна на всё приложение и живёт в `hooks/useDeferredUnreadCount`
 * (#1661): тот файл не тянет `api/messages` статически, а тот же хук висит в
 * шапке на каждой странице. Здесь остаётся прежнее имя, чтобы не переписывать
 * экран профиля.
 */
export { useDeferredUnreadCount as useUnreadCount } from '@/hooks/useDeferredUnreadCount';
