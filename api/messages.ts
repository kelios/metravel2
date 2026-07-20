import { ApiError } from '@/api/client';
import { API_BASE_URL, DEFAULT_TIMEOUT, TOKEN_KEY } from '@/api/apiConfig';
import { getSecureItem } from '@/utils/secureStorage';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { unwrapList } from '@/api/clientResponse';
import { getApiRequestCredentials, shouldUseStoredAuthToken } from '@/utils/authPlatform';
import { getCsrfHeader } from '@/utils/csrf';
import { normalizeProfileName, resolveProfileFullName } from '@/utils/profileName';
import { translate as i18nT } from '@/i18n';

// ---------------------------------------------------------------------------
// Lightweight fetch helper for messaging endpoints.
// Unlike apiClient, this does NOT trigger the 401→refresh→clearTokens cascade,
// so messaging 401s (from undeployed backend) won't log the user out.
// ---------------------------------------------------------------------------

const getMessagingErrorStatus = (error: unknown): number | undefined => {
    if (error instanceof ApiError) return error.status;
    if (!error || typeof error !== 'object') return undefined;
    const rec = error as Record<string, unknown>;
    if (typeof rec.status === 'number') return rec.status;
    const resp = rec.response;
    if (resp && typeof resp === 'object' && typeof (resp as Record<string, unknown>).status === 'number') {
        return (resp as Record<string, unknown>).status as number;
    }
    return undefined;
};

async function messagingFetch<T>(
    endpoint: string,
    options: RequestInit = {},
    timeout: number = DEFAULT_TIMEOUT,
): Promise<T> {
    const token = shouldUseStoredAuthToken()
        ? await getSecureItem(TOKEN_KEY).catch(() => null)
        : null;
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Token ${token}` } : {}),
        // Web ходит с cookie-сессией: Django требует X-CSRFToken на unsafe-методах,
        // иначе POST/DELETE отвечают 403 (отправка/прочтение/удаление молча падали).
        ...getCsrfHeader(),
        ...options.headers,
    };

    const response = await fetchWithTimeout(
        `${API_BASE_URL}${endpoint}`,
        { ...options, ...getApiRequestCredentials(), headers },
        timeout,
    );

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        let errorData: unknown;
        try { errorData = JSON.parse(errorText); } catch { errorData = errorText; }
        const rec = errorData && typeof errorData === 'object' ? (errorData as Record<string, unknown>) : {};
        const message = (typeof rec.message === 'string' ? rec.message : undefined)
            || (typeof rec.detail === 'string' ? rec.detail : undefined)
            || i18nT('errorsStatic:api.common.requestFailed', { details: response.statusText });
        throw new ApiError(
            response.status,
            message,
            errorData,
        );
    }

    return safeJsonParse<T>(response, null as unknown as T);
}

// ---- Types ----

// #708: канонические имена/аватары участников в payload /message-threads/.
// Отсутствует только на старом API — тогда работает fetchUserProfile-fallback.
export interface ParticipantPreview {
    id: number;
    display_name: string;
    avatar_url: string | null;
    username: string | null;
    is_deleted: boolean;
}

export interface MessageThread {
    id: number;
    participants: number[];
    participant_previews?: ParticipantPreview[];
    created_at: string | null;
    last_message_created_at: string | null;
    unread_count: number;
}

export const getParticipantPreviewDisplayName = (preview: ParticipantPreview): string | null => {
    const displayName = preview.display_name?.trim();
    if (displayName) return displayName;
    const username = preview.username?.trim();
    if (username) return username;
    return preview.is_deleted ? i18nT('errorsStatic:api.messages.deletedUser') : null;
};

export const threadHasParticipantPreviews = (thread: MessageThread): boolean =>
    Array.isArray(thread.participant_previews);

export const isOrphanedMessageThread = (
    thread: MessageThread | null | undefined,
    currentUserId: number | null,
): boolean => {
    if (!thread || currentUserId == null || thread.id < 0) return false;
    return !thread.participants.some((participantId) => participantId !== currentUserId);
};

// Пустой осиротевший тред: собеседника нет и не было ни одного сообщения. Такие
// строки — мусор от прежнего self-send бага (отправка в осиротевший тред создавала
// на бэке новый диалог только с самим собой); в списке диалогов их не показываем.
// Осиротевший тред С историей остаётся видимым (read-only переписка с удалённым
// пользователем).
export const isDeadOrphanedMessageThread = (
    thread: MessageThread | null | undefined,
    currentUserId: number | null,
): boolean => {
    if (!isOrphanedMessageThread(thread, currentUserId) || !thread) return false;
    return !thread.last_message_created_at && (thread.unread_count ?? 0) === 0;
};

export type ParticipantPreviewInfo = { name: string | null; avatar: string | null };

// Канонический мэппинг previews -> имена/аватары для списка диалогов и шапки чата.
export const collectParticipantPreviews = (
    threads: Array<MessageThread | null | undefined>,
): Map<number, ParticipantPreviewInfo> => {
    const map = new Map<number, ParticipantPreviewInfo>();
    for (const thread of threads) {
        for (const preview of thread?.participant_previews ?? []) {
            if (typeof preview?.id !== 'number' || map.has(preview.id)) continue;
            map.set(preview.id, {
                name: getParticipantPreviewDisplayName(preview),
                avatar: preview.avatar_url ?? null,
            });
        }
    }
    return map;
};

// Peers, которым нужен fetchUserProfile-fallback: ТОЛЬКО из тредов старого API
// без participant_previews. Канонический payload previews не даёт N+1 запросов.
export const collectLegacyPeerIds = (
    threads: MessageThread[],
    currentUserId: number,
): number[] => {
    const ids = new Set<number>();
    for (const thread of threads) {
        if (threadHasParticipantPreviews(thread)) continue;
        for (const participantId of thread.participants) {
            if (participantId !== currentUserId) ids.add(participantId);
        }
    }
    return Array.from(ids);
};

export interface Message {
    id: number;
    thread: number;
    sender: number;
    text: string;
    created_at: string | null;
}

export interface MessageCreatePayload {
    participants: number[];
    text: string;
}

export interface MessagingUser {
    id: number;
    // Бэк (ProfileSlimSerializer) отдаёт уже собранное имя:
    // first_name + last_name, а если профиль пустой — имя с регистрации (User.name).
    name?: string | null;
    email?: string | null;
    username?: string | null;
    nickname?: string | null;
    nick?: string | null;
    avatar: string | null;
    // legacy/defensive: старый контракт мог присылать раздельные поля
    first_name?: string | null;
    last_name?: string | null;
    user?: number | null;
    youtube?: string | null;
    instagram?: string | null;
    twitter?: string | null;
    vk?: string | null;
}

export function getMessagingUserDisplayName(u: MessagingUser): string {
    const name = normalizeProfileName(u.name);
    if (name) return name;
    const fullName = resolveProfileFullName(u);
    if (fullName) return fullName;
    return i18nT('errorsStatic:api.messages.userFallback');
}

export function getMessagingUserId(u: MessagingUser): number {
    return u.user ?? u.id;
}

export function getMessagingUserSearchText(u: MessagingUser): string {
    return [
        getMessagingUserDisplayName(u),
        u.name,
        u.first_name,
        u.last_name,
        u.email,
        u.username,
        u.nickname,
        u.nick,
    ]
        .map((value) => String(value ?? '').trim().toLowerCase())
        .filter(Boolean)
        .join(' ');
}

export interface PaginatedMessages {
    count: number;
    next: string | null;
    previous: string | null;
    results: Message[];
}

// Backend may return a different pagination envelope
interface RawPaginatedMessages {
    data?: Message[];
    results?: Message[];
    count?: number;
    total?: number;
    next?: string | null;
    next_page_url?: string | null;
    previous?: string | null;
    per_page?: number;
}

export interface ThreadByUserResponse {
    thread_id: number | null;
    thread?: MessageThread | null;
}

// ---- API functions ----

export const fetchMessageThreads = async (): Promise<MessageThread[]> => {
    return messagingFetch<MessageThread[]>('/message-threads/');
};

// Backend may return either a bare array or a paginated/wrapped envelope
// ({ results: [...] } / { data: [...] }), like /messages/ does. Normalize both.
type RawAvailableUsers =
    | MessagingUser[]
    | { results?: MessagingUser[]; data?: MessagingUser[] }
    | null
    | undefined;

const normalizeAvailableUsers = (raw: RawAvailableUsers): MessagingUser[] =>
    unwrapList<MessagingUser>(raw);

export const fetchAvailableUsers = async (): Promise<MessagingUser[]> => {
    const raw = await messagingFetch<RawAvailableUsers>('/message-threads/available-users/');
    return normalizeAvailableUsers(raw);
};

export const fetchThreadByUser = async (userId: number): Promise<ThreadByUserResponse> => {
    return messagingFetch<ThreadByUserResponse>(
        `/message-threads/thread-by-user/?user_id=${userId}`,
    );
};

export const fetchMessages = async (
    threadId: number,
    page: number = 1,
    perPage: number = 50
): Promise<PaginatedMessages> => {
    const raw = await messagingFetch<RawPaginatedMessages>(
        `/messages/?thread_id=${threadId}&page=${page}&perPage=${perPage}`,
    );
    // Normalize: backend may use 'data' instead of 'results', 'next_page_url' instead of 'next'
    return {
        count: raw.count ?? raw.total ?? 0,
        next: raw.next ?? raw.next_page_url ?? null,
        previous: raw.previous ?? null,
        results: raw.results ?? raw.data ?? [],
    };
};

export interface MarkThreadReadPayload {
    last_read_message_id?: number;
}

export interface MarkThreadReadResponse {
    thread_id: number;
    last_read_message_id: number | null;
    unread_count: number;
}

export const markThreadRead = async (
    threadId: number,
    payload?: MarkThreadReadPayload
): Promise<MarkThreadReadResponse> => {
    return messagingFetch<MarkThreadReadResponse>(
        `/message-threads/${threadId}/mark-read/`,
        {
            method: 'POST',
            body: JSON.stringify(payload ?? {}),
        },
    );
};

export interface UnreadCountResponse {
    count: number;
}

export const fetchUnreadCount = async (): Promise<UnreadCountResponse> => {
    const threads = await fetchMessageThreads();
    const count = threads.reduce((sum, thread) => sum + (thread.unread_count ?? 0), 0);
    return { count };
};

export const sendMessage = async (
    payload: MessageCreatePayload
): Promise<MessageCreatePayload> => {
    try {
        return await messagingFetch<MessageCreatePayload>('/messages/', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    } catch (e: unknown) {
        const status = getMessagingErrorStatus(e);
        if (status === 401) {
            throw new Error(i18nT('errorsStatic:api.messages.authRequired'));
        }
        throw e;
    }
};

export const deleteThread = async (threadId: number | string): Promise<null> => {
    try {
        return await messagingFetch<null>(`/message-threads/${threadId}/`, {
            method: 'DELETE',
        });
    } catch (e: unknown) {
        const status = getMessagingErrorStatus(e);
        if (status === 404) return null;
        throw e;
    }
};

export const deleteMessage = async (id: number | string): Promise<null> => {
    try {
        return await messagingFetch<null>(`/messages/${id}/`, {
            method: 'DELETE',
        });
    } catch (e: unknown) {
        const status = getMessagingErrorStatus(e);
        if (status === 404) return null;
        throw e;
    }
};
