import {
    fetchMessageThreads,
    fetchMessages,
    fetchAvailableUsers,
    fetchThreadByUser,
    sendMessage,
    deleteMessage,
    markThreadRead,
    fetchUnreadCount,
    getMessagingUserDisplayName,
    getMessagingUserId,
    type MessageThread,
    type MessagingUser,
    type PaginatedMessages,
} from '@/api/messages';
import { apiClient } from '@/api/client';

jest.mock('@/api/client');

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('Messages API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('fetchMessageThreads', () => {
        it('should fetch threads list', async () => {
            const mockThreads: MessageThread[] = [
                {
                    id: 1,
                    participants: [1, 2],
                    created_at: '2024-01-01T00:00:00Z',
                    last_message_created_at: '2024-01-01T12:00:00Z',
                    unread_count: 3,
                    last_message_text: 'Hello!',
                },
            ];

            mockedApiClient.get.mockResolvedValueOnce(mockThreads);

            const result = await fetchMessageThreads();

            expect(mockedApiClient.get).toHaveBeenCalledWith('/message-threads/');
            expect(result).toEqual(mockThreads);
        });

        it('should propagate network errors', async () => {
            mockedApiClient.get.mockRejectedValueOnce(new Error('Network error'));

            await expect(fetchMessageThreads()).rejects.toThrow('Network error');
        });

        it('should treat 401 as empty list', async () => {
            mockedApiClient.get.mockRejectedValueOnce({ response: { status: 401 } });

            const result = await fetchMessageThreads();
            expect(result).toEqual([]);
        });

        it('should treat 404 as empty list', async () => {
            mockedApiClient.get.mockRejectedValueOnce({ response: { status: 404 } });

            const result = await fetchMessageThreads();
            expect(result).toEqual([]);
        });

        it('should treat ApiError 401 (status on error) as empty list', async () => {
            mockedApiClient.get.mockRejectedValueOnce({ status: 401, message: 'Требуется авторизация' });

            const result = await fetchMessageThreads();
            expect(result).toEqual([]);
        });
    });

    describe('fetchMessages', () => {
        it('should fetch messages for a thread with pagination', async () => {
            const mockData: PaginatedMessages = {
                count: 2,
                next: null,
                previous: null,
                results: [
                    { id: 1, thread: 5, sender: 1, text: 'Hi', created_at: '2024-01-01T00:00:00Z' },
                    { id: 2, thread: 5, sender: 2, text: 'Hello', created_at: '2024-01-01T00:01:00Z' },
                ],
            };

            mockedApiClient.get.mockResolvedValueOnce(mockData);

            const result = await fetchMessages(5, 1, 50);

            expect(mockedApiClient.get).toHaveBeenCalledWith('/messages/?thread_id=5&page=1&perPage=50');
            expect(result).toEqual(mockData);
        });

        it('should use default pagination params', async () => {
            mockedApiClient.get.mockResolvedValueOnce({ count: 0, next: null, previous: null, results: [] });

            await fetchMessages(3);

            expect(mockedApiClient.get).toHaveBeenCalledWith('/messages/?thread_id=3&page=1&perPage=50');
        });

        it('should propagate errors', async () => {
            mockedApiClient.get.mockRejectedValueOnce(new Error('Server error'));

            await expect(fetchMessages(1)).rejects.toThrow('Server error');
        });

        it('should treat 404 as empty paginated result', async () => {
            mockedApiClient.get.mockRejectedValueOnce({ response: { status: 404 } });

            const result = await fetchMessages(1);
            expect(result).toEqual({ count: 0, next: null, previous: null, results: [] });
        });

        it('should treat 401 as empty paginated result', async () => {
            mockedApiClient.get.mockRejectedValueOnce({ response: { status: 401 } });

            const result = await fetchMessages(1);
            expect(result).toEqual({ count: 0, next: null, previous: null, results: [] });
        });

        it('should treat ApiError 401 (status on error) as empty paginated result', async () => {
            mockedApiClient.get.mockRejectedValueOnce({ status: 401, message: 'Требуется авторизация' });

            const result = await fetchMessages(1);
            expect(result).toEqual({ count: 0, next: null, previous: null, results: [] });
        });
    });

    describe('fetchAvailableUsers', () => {
        it('should fetch available users', async () => {
            const mockUsers: MessagingUser[] = [
                { id: 1, first_name: 'John', last_name: 'Doe', avatar: null, user: 10 },
            ];

            mockedApiClient.get.mockResolvedValueOnce(mockUsers);

            const result = await fetchAvailableUsers();

            expect(mockedApiClient.get).toHaveBeenCalledWith('/message-threads/available-users/');
            expect(result).toEqual(mockUsers);
        });

        it('should treat 401 as empty list', async () => {
            mockedApiClient.get.mockRejectedValueOnce({ response: { status: 401 } });

            const result = await fetchAvailableUsers();
            expect(result).toEqual([]);
        });

        it('should treat ApiError 401 (status on error) as empty list', async () => {
            mockedApiClient.get.mockRejectedValueOnce({ status: 401, message: 'Требуется авторизация' });

            const result = await fetchAvailableUsers();
            expect(result).toEqual([]);
        });
    });

    describe('fetchThreadByUser', () => {
        it('should find existing thread by user id', async () => {
            mockedApiClient.get.mockResolvedValueOnce({ thread_id: 42 });

            const result = await fetchThreadByUser(10);

            expect(mockedApiClient.get).toHaveBeenCalledWith('/message-threads/thread-by-user/?user_id=10');
            expect(result).toEqual({ thread_id: 42 });
        });

        it('should return null thread_id when no thread exists', async () => {
            mockedApiClient.get.mockResolvedValueOnce({ thread_id: null });

            const result = await fetchThreadByUser(99);

            expect(result.thread_id).toBeNull();
        });
    });

    describe('sendMessage', () => {
        it('should send a message', async () => {
            const payload = { participants: [2], text: 'Hello!' };
            mockedApiClient.post.mockResolvedValueOnce(payload);

            const result = await sendMessage(payload);

            expect(mockedApiClient.post).toHaveBeenCalledWith('/messages/', payload);
            expect(result).toEqual(payload);
        });

        it('should propagate errors', async () => {
            mockedApiClient.post.mockRejectedValueOnce(new Error('Send failed'));

            await expect(sendMessage({ participants: [2], text: 'Hi' })).rejects.toThrow('Send failed');
        });
    });

    describe('deleteMessage', () => {
        it('should delete a message by id', async () => {
            mockedApiClient.delete.mockResolvedValueOnce(null);

            await deleteMessage(5);

            expect(mockedApiClient.delete).toHaveBeenCalledWith('/messages/5/');
        });

        it('should accept string id', async () => {
            mockedApiClient.delete.mockResolvedValueOnce(null);

            await deleteMessage('10');

            expect(mockedApiClient.delete).toHaveBeenCalledWith('/messages/10/');
        });
    });

    describe('markThreadRead', () => {
        it('should mark thread as read', async () => {
            mockedApiClient.post.mockResolvedValueOnce(null);

            await markThreadRead(7);

            expect(mockedApiClient.post).toHaveBeenCalledWith('/message-threads/7/mark-read/', {});
        });
    });

    describe('fetchUnreadCount', () => {
        it('should fetch unread count', async () => {
            mockedApiClient.get.mockResolvedValueOnce({ count: 5 });

            const result = await fetchUnreadCount();

            expect(mockedApiClient.get).toHaveBeenCalledWith('/messages/unread-count/');
            expect(result).toEqual({ count: 5 });
        });

        it('should return zero on any error', async () => {
            mockedApiClient.get.mockRejectedValueOnce(new Error('Network error'));

            const result = await fetchUnreadCount();
            expect(result).toEqual({ count: 0 });
        });
    });

    describe('getMessagingUserDisplayName', () => {
        it('should return full name', () => {
            const user: MessagingUser = { id: 1, first_name: 'John', last_name: 'Doe', avatar: null, user: null };
            expect(getMessagingUserDisplayName(user)).toBe('John Doe');
        });

        it('should return first name only', () => {
            const user: MessagingUser = { id: 1, first_name: 'John', last_name: null, avatar: null, user: null };
            expect(getMessagingUserDisplayName(user)).toBe('John');
        });

        it('should return fallback when no name', () => {
            const user: MessagingUser = { id: 1, first_name: null, last_name: null, avatar: null, user: null };
            expect(getMessagingUserDisplayName(user)).toBe('Пользователь');
        });
    });

    describe('getMessagingUserId', () => {
        it('should return user field when present', () => {
            const user: MessagingUser = { id: 1, first_name: null, last_name: null, avatar: null, user: 10 };
            expect(getMessagingUserId(user)).toBe(10);
        });

        it('should fall back to id when user is null', () => {
            const user: MessagingUser = { id: 5, first_name: null, last_name: null, avatar: null, user: null };
            expect(getMessagingUserId(user)).toBe(5);
        });
    });
});
