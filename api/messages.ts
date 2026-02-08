import { apiClient } from '@/api/client';

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
        return await apiClient.get<MessageThread[]>('/message-threads/');
    } catch (e: any) {
        const status = e?.response?.status;
        if (status === 401 || status === 404) return [];
        throw e;
    }
};

export const fetchAvailableUsers = async (): Promise<MessagingUser[]> => {
    try {
        return await apiClient.get<MessagingUser[]>('/message-threads/available-users/');
    } catch (e: any) {
        const status = e?.response?.status;
        if (status === 401 || status === 404) return [];
        throw e;
    }
};

export const fetchThreadByUser = async (userId: number): Promise<ThreadByUserResponse> => {
    return apiClient.get<ThreadByUserResponse>(
        `/message-threads/thread-by-user/?user_id=${userId}`
    );
};

export const fetchMessages = async (
    threadId: number,
    page: number = 1,
    perPage: number = 50
): Promise<PaginatedMessages> => {
    try {
        return await apiClient.get<PaginatedMessages>(
            `/messages/?thread_id=${threadId}&page=${page}&perPage=${perPage}`
        );
    } catch (e: any) {
        const status = e?.response?.status;
        if (status === 401 || status === 404) {
            return { count: 0, next: null, previous: null, results: [] };
        }
        throw e;
    }
};

export const markThreadRead = async (threadId: number): Promise<null> => {
    return apiClient.post<null>(`/message-threads/${threadId}/mark-read/`, {});
};

export interface UnreadCountResponse {
    count: number;
}

export const fetchUnreadCount = async (): Promise<UnreadCountResponse> => {
    try {
        return await apiClient.get<UnreadCountResponse>('/messages/unread-count/');
    } catch {
        return { count: 0 };
    }
};

export const sendMessage = async (
    payload: MessageCreatePayload
): Promise<MessageCreatePayload> => {
    return apiClient.post<MessageCreatePayload>('/messages/', payload);
};

export const deleteMessage = async (id: number | string): Promise<null> => {
    return apiClient.delete<null>(`/messages/${id}/`);
};
