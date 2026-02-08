import { apiClient } from '@/api/client';

// ---- Types ----

export interface MessageThread {
    id: number;
    participants: number[];
    created_at: string | null;
    last_message_created_at: string | null;
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
    return apiClient.get<MessageThread[]>('/message-threads/');
};

export const fetchAvailableUsers = async (): Promise<MessagingUser[]> => {
    return apiClient.get<MessagingUser[]>('/message-threads/available-users/');
};

export const fetchThreadByUser = async (userId: number): Promise<ThreadByUserResponse> => {
    return apiClient.get<ThreadByUserResponse>(
        `/message-threads/thread-by-user/?user_id=${userId}`
    );
};

export const fetchMessages = async (
    page: number = 1,
    perPage: number = 50
): Promise<PaginatedMessages> => {
    return apiClient.get<PaginatedMessages>(
        `/messages/?page=${page}&perPage=${perPage}`
    );
};

export const sendMessage = async (
    payload: MessageCreatePayload
): Promise<MessageCreatePayload> => {
    return apiClient.post<MessageCreatePayload>('/messages/', payload);
};

export const deleteMessage = async (id: number | string): Promise<null> => {
    return apiClient.delete<null>(`/messages/${id}/`);
};
