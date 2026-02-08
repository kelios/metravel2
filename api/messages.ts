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
    unread_count?: number;
    last_message_text?: string | null;
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
        return await messagingFetch<PaginatedMessages>(
            `/messages/?thread_id=${threadId}&page=${page}&perPage=${perPage}`,
        );
    } catch (e: any) {
        const status = e?.status ?? e?.response?.status;
        if (status === 401 || status === 404) {
            return { count: 0, next: null, previous: null, results: [] };
        }
        throw e;
    }
};

export const markThreadRead = async (threadId: number): Promise<null> => {
    try {
        return await messagingFetch<null>(`/message-threads/${threadId}/mark-read/`, {
            method: 'POST',
            body: JSON.stringify({}),
        });
    } catch (e: any) {
        const status = e?.status ?? e?.response?.status;
        if (status === 401 || status === 404) return null;
        throw e;
    }
};

export interface UnreadCountResponse {
    count: number;
}

export const fetchUnreadCount = async (): Promise<UnreadCountResponse> => {
    try {
        return await messagingFetch<UnreadCountResponse>('/messages/unread-count/');
    } catch (e: any) {
        const status = e?.status ?? e?.response?.status;
        if (status === 401 || status === 403) {
            // Re-throw so useUnreadCount consecutive failure tracking can detect it
            throw e;
        }
        // Swallow other errors (network, 500, etc.) silently
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
