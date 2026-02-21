import { ApiError } from '@/api/client';
import { API_BASE_URL, DEFAULT_TIMEOUT, TOKEN_KEY } from '@/api/apiConfig';
import { getSecureItem } from '@/utils/secureStorage';
import { fetchWithTimeout } from '@/utils/fetchWithTimeout';

// ---------------------------------------------------------------------------
// Lightweight fetch helper for messaging endpoints.
// Unlike apiClient, this does NOT trigger the 401→refresh→clearTokens cascade,
// so messaging 401s (from undeployed backend) won't log the user out.
// ---------------------------------------------------------------------------

async function messagingFetch<T>(
    endpoint: string,
    options: RequestInit = {},
    timeout: number = DEFAULT_TIMEOUT,
): Promise<T> {
    const token = await getSecureItem(TOKEN_KEY).catch(() => null);
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Token ${token}` } : {}),
        ...options.headers,
    };

    const response = await fetchWithTimeout(
        `${API_BASE_URL}${endpoint}`,
        { ...options, headers },
        timeout,
    );

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        let errorData: any;
        try { errorData = JSON.parse(errorText); } catch { errorData = errorText; }
        throw new ApiError(
            response.status,
            errorData?.message || errorData?.detail || `Ошибка запроса: ${response.statusText}`,
            errorData,
        );
    }

    const text = await response.text();
    if (!text || text === 'null') return null as unknown as T;
    return JSON.parse(text) as T;
}

// ---- Types ----

export interface MessageThread {
    id: number;
    participants: number[];
    created_at: string | null;
    last_message_created_at: string | null;
    unread_count: number;
}

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
    first_name: string | null;
    last_name: string | null;
    avatar: string | null;
    user: number | null;
    youtube?: string | null;
    instagram?: string | null;
    twitter?: string | null;
    vk?: string | null;
}

export function getMessagingUserDisplayName(u: MessagingUser): string {
    const parts = [u.first_name, u.last_name].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'Пользователь';
}

export function getMessagingUserId(u: MessagingUser): number {
    return u.user ?? u.id;
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
}

// ---- API functions ----

export const fetchMessageThreads = async (): Promise<MessageThread[]> => {
    try {
        return await messagingFetch<MessageThread[]>('/message-threads/');
    } catch (e: any) {
        const status = e?.status ?? e?.response?.status;
        if (status === 401 || status === 404) return [];
        throw e;
    }
};

export const fetchAvailableUsers = async (): Promise<MessagingUser[]> => {
    try {
        return await messagingFetch<MessagingUser[]>('/message-threads/available-users/');
    } catch (e: any) {
        const status = e?.status ?? e?.response?.status;
        if (status === 401 || status === 404) return [];
        throw e;
    }
};

export const fetchThreadByUser = async (userId: number): Promise<ThreadByUserResponse> => {
    try {
        return await messagingFetch<ThreadByUserResponse>(
            `/message-threads/thread-by-user/?user_id=${userId}`,
        );
    } catch (e: any) {
        const status = e?.status ?? e?.response?.status;
        if (status === 401 || status === 404) return { thread_id: null };
        throw e;
    }
};

export const fetchMessages = async (
    threadId: number,
    page: number = 1,
    perPage: number = 50
): Promise<PaginatedMessages> => {
    try {
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
    } catch (e: any) {
        const status = e?.status ?? e?.response?.status;
        if (status === 401 || status === 404) {
            return { count: 0, next: null, previous: null, results: [] };
        }
        throw e;
    }
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
    try {
        return await messagingFetch<MarkThreadReadResponse>(
            `/message-threads/${threadId}/mark-read/`,
            {
                method: 'POST',
                body: JSON.stringify(payload ?? {}),
            },
        );
    } catch (e: any) {
        const status = e?.status ?? e?.response?.status;
        if (status === 401 || status === 404) {
            return { thread_id: threadId, last_read_message_id: null, unread_count: 0 };
        }
        throw e;
    }
};

export interface UnreadCountResponse {
    count: number;
}

export const fetchUnreadCount = async (): Promise<UnreadCountResponse> => {
    try {
        const threads = await fetchMessageThreads();
        const count = threads.reduce((sum, thread) => sum + (thread.unread_count ?? 0), 0);
        return { count };
    } catch {
        return { count: 0 };
    }
};

export const sendMessage = async (
    payload: MessageCreatePayload
): Promise<MessageCreatePayload> => {
    try {
        return await messagingFetch<MessageCreatePayload>('/messages/', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    } catch (e: any) {
        const status = e?.status ?? e?.response?.status;
        if (status === 401) {
            throw new Error('Для отправки сообщений необходимо авторизоваться');
        }
        throw e;
    }
};

export const deleteMessage = async (id: number | string): Promise<null> => {
    try {
        return await messagingFetch<null>(`/messages/${id}/`, {
            method: 'DELETE',
        });
    } catch (e: any) {
        const status = e?.status ?? e?.response?.status;
        if (status === 401 || status === 404) return null;
        throw e;
    }
};
