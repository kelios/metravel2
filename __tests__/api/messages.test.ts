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

// Mock the low-level dependencies used by messagingFetch
jest.mock('@/utils/fetchWithTimeout');
jest.mock('@/utils/secureStorage');

import { fetchWithTimeout } from '@/utils/fetchWithTimeout';
import { getSecureItem } from '@/utils/secureStorage';

const mockedFetch = fetchWithTimeout as jest.MockedFunction<typeof fetchWithTimeout>;
const mockedGetSecureItem = getSecureItem as jest.MockedFunction<typeof getSecureItem>;

// Helper: create a mock Response
function mockResponse(body: any, status = 200): Response {
    const text = body === null ? 'null' : JSON.stringify(body);
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        text: jest.fn().mockResolvedValue(text),
        json: jest.fn().mockResolvedValue(body),
        headers: new Headers(),
    } as unknown as Response;
}

describe('Messages API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockedGetSecureItem.mockResolvedValue('test-token');
    });

    describe('fetchMessageThreads', () => {
        it('should fetch threads list', async () => {
            const mockThreads: MessageThread[] = [
                {
                    id: 1,
                    participants: [1, 2],
                    created_at: '2024-01-01T00:00:00Z',
                    last_message_created_at: '2024-01-01T12:00:00Z',
                },
            ];

            mockedFetch.mockResolvedValueOnce(mockResponse(mockThreads));

            const result = await fetchMessageThreads();
            expect(result).toEqual(mockThreads);
        });

        it('should propagate network errors', async () => {
            mockedFetch.mockRejectedValueOnce(new Error('Network error'));

            await expect(fetchMessageThreads()).rejects.toThrow('Network error');
        });

        it('should treat 401 as empty list', async () => {
            mockedFetch.mockResolvedValueOnce(mockResponse({ detail: 'Unauthorized' }, 401));

            const result = await fetchMessageThreads();
            expect(result).toEqual([]);
        });

        it('should treat 404 as empty list', async () => {
            mockedFetch.mockResolvedValueOnce(mockResponse({ detail: 'Not found' }, 404));

            const result = await fetchMessageThreads();
            expect(result).toEqual([]);
        });
    });

    describe('fetchMessages', () => {
        it('should fetch messages with pagination', async () => {
            const mockData: PaginatedMessages = {
                count: 2,
                next: null,
                previous: null,
                results: [
                    { id: 1, thread: 5, sender: 1, text: 'Hi', created_at: '2024-01-01T00:00:00Z' },
                    { id: 2, thread: 5, sender: 2, text: 'Hello', created_at: '2024-01-01T00:01:00Z' },
                ],
            };

            mockedFetch.mockResolvedValueOnce(mockResponse(mockData));

            const result = await fetchMessages(5, 1, 50);
            expect(result).toEqual(mockData);
        });

        it('should propagate errors', async () => {
            mockedFetch.mockRejectedValueOnce(new Error('Server error'));

            await expect(fetchMessages(1)).rejects.toThrow('Server error');
        });

        it('should treat 404 as empty paginated result', async () => {
            mockedFetch.mockResolvedValueOnce(mockResponse({ detail: 'Not found' }, 404));

            const result = await fetchMessages(1);
            expect(result).toEqual({ count: 0, next: null, previous: null, results: [] });
        });

        it('should treat 401 as empty paginated result', async () => {
            mockedFetch.mockResolvedValueOnce(mockResponse({ detail: 'Unauthorized' }, 401));

            const result = await fetchMessages(1);
            expect(result).toEqual({ count: 0, next: null, previous: null, results: [] });
        });
    });

    describe('fetchAvailableUsers', () => {
        it('should fetch available users', async () => {
            const mockUsers: MessagingUser[] = [
                { id: 1, first_name: 'John', last_name: 'Doe', avatar: null, user: 10 },
            ];

            mockedFetch.mockResolvedValueOnce(mockResponse(mockUsers));

            const result = await fetchAvailableUsers();
            expect(result).toEqual(mockUsers);
        });

        it('should treat 401 as empty list', async () => {
            mockedFetch.mockResolvedValueOnce(mockResponse({ detail: 'Unauthorized' }, 401));

            const result = await fetchAvailableUsers();
            expect(result).toEqual([]);
        });
    });

    describe('fetchThreadByUser', () => {
        it('should find existing thread by user id', async () => {
            mockedFetch.mockResolvedValueOnce(mockResponse({ thread_id: 42 }));

            const result = await fetchThreadByUser(10);
            expect(result).toEqual({ thread_id: 42 });
        });

        it('should return null thread_id on 401', async () => {
            mockedFetch.mockResolvedValueOnce(mockResponse({ detail: 'Unauthorized' }, 401));

            const result = await fetchThreadByUser(99);
            expect(result.thread_id).toBeNull();
        });
    });

    describe('sendMessage', () => {
        it('should send a message', async () => {
            const payload = { participants: [2], text: 'Hello!' };
            mockedFetch.mockResolvedValueOnce(mockResponse(payload, 201));

            const result = await sendMessage(payload);
            expect(result).toEqual(payload);
        });

        it('should throw user-friendly error on 401', async () => {
            mockedFetch.mockResolvedValueOnce(mockResponse({ detail: 'Unauthorized' }, 401));

            await expect(sendMessage({ participants: [2], text: 'Hi' })).rejects.toThrow(
                'Для отправки сообщений необходимо авторизоваться'
            );
        });

        it('should propagate other errors', async () => {
            mockedFetch.mockRejectedValueOnce(new Error('Send failed'));

            await expect(sendMessage({ participants: [2], text: 'Hi' })).rejects.toThrow('Send failed');
        });
    });

    describe('deleteMessage', () => {
        it('should delete a message by id', async () => {
            mockedFetch.mockResolvedValueOnce(mockResponse(null, 204));

            const result = await deleteMessage(5);
            expect(result).toBeNull();
        });

        it('should treat 401 as null (graceful)', async () => {
            mockedFetch.mockResolvedValueOnce(mockResponse({ detail: 'Unauthorized' }, 401));

            const result = await deleteMessage(5);
            expect(result).toBeNull();
        });

        it('should treat 404 as null (graceful)', async () => {
            mockedFetch.mockResolvedValueOnce(mockResponse({ detail: 'Not found' }, 404));

            const result = await deleteMessage(5);
            expect(result).toBeNull();
        });
    });

    describe('markThreadRead (stubbed — backend not deployed)', () => {
        it('should return null (no-op stub)', async () => {
            const result = await markThreadRead(7);
            expect(result).toBeNull();
        });
    });

    describe('fetchUnreadCount (stubbed — backend not deployed)', () => {
        it('should return zero (no-op stub)', async () => {
            const result = await fetchUnreadCount();
            expect(result).toEqual({ count: 0 });
        });
    });

    describe('messagingFetch does not invalidate auth', () => {
        it('should include auth token in requests', async () => {
            mockedGetSecureItem.mockResolvedValueOnce('my-token');
            mockedFetch.mockResolvedValueOnce(mockResponse([]));

            await fetchMessageThreads();

            expect(mockedFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Token my-token',
                    }),
                }),
                expect.any(Number),
            );
        });

        it('should work without token (unauthenticated)', async () => {
            mockedGetSecureItem.mockResolvedValueOnce(null as any);
            mockedFetch.mockResolvedValueOnce(mockResponse({ detail: 'Unauthorized' }, 401));

            const result = await fetchMessageThreads();
            expect(result).toEqual([]);
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
