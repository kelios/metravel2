import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import isEqual from 'fast-deep-equal';
import { useMessagePolling } from '@/hooks/useMessagePolling';
import { ApiError } from '@/api/client';
import {
    fetchMessageThreads,
    fetchMessages,
    fetchMessageChanges,
    MESSAGE_PAGE_SIZE,
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
const isAccessDenied = (error: unknown) => error instanceof ApiError && [401, 403, 404].includes(error.status);

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
    const requestRef = useRef<AbortController | null>(null);
    const lastThreads = useRef<MessageThread[]>([]);
    const consecutiveFailuresRef = useRef(0);
    const hiddenThreadIdsRef = useRef(new Set<number>());

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            requestRef.current?.abort();
        };
    }, []);

    const read = useCallback(async (silent: boolean) => {
        if (!mountedRef.current || (silent && (requestRef.current || consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES))) return false;
        requestRef.current?.abort();
        const request = new AbortController();
        requestRef.current = request;
        if (!silent) {
            setLoading(true);
            setError(null);
            consecutiveFailuresRef.current = 0;
        }
        try {
            const data = await fetchMessageThreads(request.signal);
            if (request.signal.aborted) return false;
            const next = Array.isArray(data)
                ? withoutBlockedThreads(data.filter((thread) => !hiddenThreadIdsRef.current.has(thread.id)))
                : [];
            const changed = !isEqual(lastThreads.current, next);
            lastThreads.current = next;
            setThreads(next);
            setError(null);
            consecutiveFailuresRef.current = 0;
            return changed;
        } catch (e: unknown) {
            if (!request.signal.aborted) {
                consecutiveFailuresRef.current = isAccessDenied(e) ? consecutiveFailuresRef.current + 1 : 0;
                if (!silent) {
                    devError('useThreads load error:', e);
                    setError(getErrorMessage(e, i18nT('messages:hooks.useMessages.oshibka_zagruzki_soobscheniy_b3faeb10')));
                }
            }
            return false;
        } finally {
            if (!request.signal.aborted) {
                requestRef.current = null;
                setLoading(false);
                setLoaded(true);
            }
        }
    }, []);

    const poll = useCallback((resuming: boolean) => {
        if (resuming) consecutiveFailuresRef.current = 0;
        return read(!(resuming && requestRef.current));
    }, [read]);
    const restartPolling = useMessagePolling(enabled && pollEnabled, poll, THREADS_POLL_INTERVAL, 120_000);
    const load = useCallback(async () => {
        restartPolling();
        await read(false);
    }, [read, restartPolling]);

    useEffect(() => { if (enabled) void load(); }, [enabled, load]);

    useEffect(() => subscribeAuthorBlock((_authorId, blocked) => {
        if (!mountedRef.current) return;
        if (blocked) setThreads((prev) => withoutBlockedThreads(prev));
        else if (enabled) void load();
    }), [enabled, load]);

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

type ThreadMessageLoadMode = 'refresh' | 'more' | 'poll';

interface ThreadMessageSession {
    threadId: number | null;
    ownerId: string | null;
    page: number;
    hasMore: boolean;
    cursor: string | null;
    legacy: boolean;
    legacyHead: Message[];
    failures: number;
    hidden: Set<number>;
    request: { controller: AbortController; mode: ThreadMessageLoadMode } | null;
}

function mergeMessages(previous: Message[], updates: Message[], removed: number[]) {
    if (!updates.length && !removed.length) return previous;
    const byId = new Map(previous.map((message) => [message.id, message]));
    for (const message of updates) byId.set(message.id, message);
    for (const id of removed) byId.delete(id);
    return [...byId.values()];
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
    const displayed = useRef(messages);
    useLayoutEffect(() => { displayed.current = messages; }, [messages]);
    const sessionRef = useRef<ThreadMessageSession | null>(null);

    const getSession = useCallback(() => {
        const session = sessionRef.current;
        return session?.threadId === threadId && session.ownerId === ownerId ? session : null;
    }, [threadId, ownerId]);

    const load = useCallback(async (mode: ThreadMessageLoadMode, rebootstrap = false, pollSignal?: AbortSignal) => {
        const session = getSession();
        if (!session || session.threadId == null || session.threadId < 0) return false;
        if (mode === 'more' && (!session.hasMore || (!session.cursor && session.page === 1))) return false;
        if (mode === 'poll' && session.failures >= MAX_CONSECUTIVE_FAILURES) return false;
        const selectedId = session.threadId;
        const pending = session.request;
        if (pending && (mode === 'poll' || (mode === 'more' && pending.mode !== 'poll'))) return false;

        pending?.controller.abort();
        const request = { controller: new AbortController(), mode };
        session.request = request;
        const signal = request.controller.signal;
        const isCurrent = () => getSession() === session && session.request === request;
        const clearSnapshot = () => {
            session.cursor = null;
            session.page = 1;
            session.hasMore = false;
            session.hidden = new Set();
            session.legacyHead = [];
            setMessages([]);
            setHasMore(false);
        };
        const filter = (items: Message[]) => withoutBlockedMessages(items.filter((m) => !session.hidden.has(m.id)));
        if (rebootstrap) clearSnapshot();
        if (mode !== 'poll') {
            session.failures = 0;
            setLoading(true);
            setError(null);
        }
        let changed = false;
        let historyInvalidated = false;
        // Older history uses numbered pages. A delta read after the page request
        // checks for a concurrent deletion or access reset before publishing that page.
        const readChanges = async () => {
            let more: boolean;
            do {
                const cursor = session.cursor;
                let delta;
                try {
                    delta = await fetchMessageChanges(selectedId, cursor, signal);
                } catch (e) {
                    if (!isCurrent()) return;
                    // The old DRF router resolves "changes" as a detail route with DELETE only.
                    if (cursor === null && e instanceof ApiError && e.status === 405) {
                        session.legacy = true;
                        return;
                    }
                    const invalidCursor = e instanceof ApiError && e.status === 400 &&
                        e.data != null && typeof e.data === 'object' && 'cursor' in e.data;
                    if (cursor !== null && e instanceof ApiError && (e.status === 409 || invalidCursor)) {
                        clearSnapshot();
                        historyInvalidated = true;
                        more = true;
                        continue;
                    }
                    throw e;
                }
                if (!isCurrent()) return;
                if (!delta?.cursor || (delta.has_more && delta.cursor === cursor)) {
                    throw new Error(i18nT('messages:hooks.useMessages.oshibka_zagruzki_soobscheniy_b3faeb10'));
                }
                if (cursor === null) {
                    session.page = 2;
                    session.hasMore = delta.messages.length > MESSAGE_PAGE_SIZE;
                    setHasMore(session.hasMore);
                    setMessages(filter(delta.messages.slice(0, MESSAGE_PAGE_SIZE)));
                } else {
                    const updates = filter(delta.messages);
                    for (const id of delta.removed_ids) session.hidden.delete(id);
                    if (updates.length || delta.removed_ids.length) {
                        setMessages((prev) => mergeMessages(prev, updates, delta.removed_ids));
                    }
                    if (session.hasMore && delta.removed_ids.length) {
                        session.page = Math.max(1, session.page - Math.ceil(delta.removed_ids.length / MESSAGE_PAGE_SIZE));
                        historyInvalidated = true;
                    }
                }
                session.cursor = delta.cursor;
                changed ||= delta.messages.length > 0 || delta.removed_ids.length > 0;
                more = delta.has_more;
            } while (more && !pollSignal?.aborted);
        };
        try {
            if (mode !== 'more' && !session.legacy) await readChanges();
            if (!isCurrent()) return false;
            if (mode === 'more' || session.legacy) {
                const known = mode === 'more' ? new Set(displayed.current.map((m) => m.id)) : null;
                do {
                    const page = mode === 'more' ? session.page : 1;
                    const data = await fetchMessages(selectedId, page, MESSAGE_PAGE_SIZE, signal).catch((e) => {
                        // DRF also returns 404 when a deletion removes the last numbered page.
                        if (mode === 'more' && !session.legacy && e instanceof ApiError && e.status === 404) return null;
                        throw e;
                    });
                    if (!isCurrent()) return false;
                    if (!session.legacy && mode === 'more') {
                        historyInvalidated = false;
                        await readChanges();
                        if (!isCurrent()) return false;
                        if (historyInvalidated) continue;
                    }
                    const updates = filter(data?.results ?? []);
                    if (session.legacy && mode !== 'more') {
                        changed = !isEqual(session.legacyHead, updates);
                        session.legacyHead = updates;
                        if (session.page === 1 || rebootstrap) setMessages(updates);
                        else if (changed) setMessages((prev) => mergeMessages(prev, updates, []));
                    } else {
                        // The checkpoint is newer than the history page. Keep any concurrent edits.
                        setMessages((prev) => {
                            const ids = new Set(prev.map((m) => m.id));
                            return [...prev, ...updates.filter((m) => !ids.has(m.id))];
                        });
                    }
                    if (mode === 'more' || session.page === 1) {
                        session.hasMore = Boolean(data?.next);
                        session.page = page + 1;
                        setHasMore(session.hasMore);
                    }
                    if (!known || updates.some((m) => !known.has(m.id))) break;
                    // Catch-up can move a whole page of already visible rows across the boundary.
                } while (session.hasMore);
            }
            session.failures = 0;
            setError(null);
            return changed;
        } catch (e) {
            if (!isCurrent()) return false;
            const denied = isAccessDenied(e);
            if (denied) clearSnapshot();
            session.failures = denied ? session.failures + 1 : 0;
            if (mode !== 'poll' || denied) {
                devError('useThreadMessages load error:', e);
                setError(getErrorMessage(e, i18nT('messages:hooks.useMessages.oshibka_zagruzki_soobscheniy_b3faeb10')));
            }
            return false;
        } finally {
            if (isCurrent()) {
                session.request = null;
                if (mode !== 'poll') setLoading(false);
            }
        }
    }, [getSession]);

    useLayoutEffect(() => {
        const session: ThreadMessageSession = {
            threadId, ownerId, page: 1, hasMore: true, cursor: null, legacy: false, legacyHead: [],
            hidden: new Set(), failures: 0, request: null,
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

    useEffect(() => { void load('refresh'); }, [load]);

    useEffect(() => subscribeAuthorBlock((_authorId, blocked) => {
        if (!getSession()) return;
        if (blocked) setMessages((previous) => withoutBlockedMessages(previous));
        else void load('refresh', true);
    }), [getSession, load]);

    const poll = useCallback((resuming: boolean, signal: AbortSignal) => {
        const session = getSession();
        if (session && resuming) session.failures = 0;
        return load(resuming && session?.request?.mode === 'poll' ? 'refresh' : 'poll', false, signal);
    }, [getSession, load]);
    const restartPolling = useMessagePolling(threadId != null && threadId >= 0 && pollEnabled, poll, MESSAGES_POLL_INTERVAL, 60_000);
    const refresh = useCallback(async () => {
        if (getSession()) {
            restartPolling();
            await load('refresh');
        }
    }, [getSession, load, restartPolling]);

    const optimisticRemove = useCallback((messageId: number) => {
        const session = getSession();
        if (!session) return () => {};
        const hidden = session.hidden;
        hidden.add(messageId);
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
            if (getSession() === session && session.hidden === hidden && hidden.delete(messageId) && removed && !getBlockedAuthorIds().has(removed.sender)) {
                setMessages((prev) => {
                    if (prev.some((m) => m.id === removed.id)) return prev;
                    const copy = [...prev];
                    copy.splice(Math.min(index, copy.length), 0, removed);
                    return copy;
                });
            }
        };
    }, [getSession]);

    return { messages, loading, error, hasMore, loadMore: () => load('more'), refresh, optimisticRemove };
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
