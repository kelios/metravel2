import {
    deleteUserTravelStatus,
    fetchUserTravelStatuses,
    subscribeToUser,
    unsubscribeFromUser,
    fetchMySubscriptions,
    fetchMySubscribers,
    upsertUserTravelStatus,
} from '@/api/user';

jest.mock('@/api/client', () => ({
    apiClient: {
        post: jest.fn(),
        delete: jest.fn(),
        get: jest.fn(),
    },
}));

const { apiClient } = require('@/api/client');
const mockedPost = apiClient.post as jest.Mock;
const mockedDelete = apiClient.delete as jest.Mock;
const mockedGet = apiClient.get as jest.Mock;

describe('api/user subscriptions', () => {
    beforeEach(() => {
        mockedPost.mockReset();
        mockedDelete.mockReset();
        mockedGet.mockReset();
    });

    describe('subscribeToUser', () => {
        it('calls POST /user/{id}/subscribe/', async () => {
            mockedPost.mockResolvedValueOnce(null);
            await subscribeToUser(42);
            expect(mockedPost).toHaveBeenCalledWith('/user/42/subscribe/');
        });

        it('accepts string userId', async () => {
            mockedPost.mockResolvedValueOnce(null);
            await subscribeToUser('99');
            expect(mockedPost).toHaveBeenCalledWith('/user/99/subscribe/');
        });
    });

    describe('unsubscribeFromUser', () => {
        it('calls DELETE /user/{id}/unsubscribe/', async () => {
            mockedDelete.mockResolvedValueOnce(null);
            await unsubscribeFromUser(42);
            expect(mockedDelete).toHaveBeenCalledWith('/user/42/unsubscribe/');
        });
    });

    describe('fetchMySubscriptions', () => {
        it('returns unwrapped array from API', async () => {
            const profiles = [
                { id: 1, first_name: 'A', last_name: 'B', user: 10 },
                { id: 2, first_name: 'C', last_name: 'D', user: 20 },
            ];
            mockedGet.mockResolvedValueOnce(profiles);
            const result = await fetchMySubscriptions();
            expect(mockedGet).toHaveBeenCalledWith('/user/subscriptions/');
            expect(result).toEqual(profiles);
        });

        it('handles paginated response', async () => {
            const profiles = [{ id: 1, first_name: 'A', last_name: 'B', user: 10 }];
            mockedGet.mockResolvedValueOnce({ results: profiles });
            const result = await fetchMySubscriptions();
            expect(result).toEqual(profiles);
        });

        it('returns empty array for null response', async () => {
            mockedGet.mockResolvedValueOnce(null);
            const result = await fetchMySubscriptions();
            expect(result).toEqual([]);
        });
    });

    describe('fetchMySubscribers', () => {
        it('calls GET /user/subscribers/', async () => {
            const profiles = [{ id: 3, first_name: 'E', last_name: 'F', user: 30 }];
            mockedGet.mockResolvedValueOnce(profiles);
            const result = await fetchMySubscribers();
            expect(mockedGet).toHaveBeenCalledWith('/user/subscribers/');
            expect(result).toEqual(profiles);
        });
    });

    describe('travel statuses', () => {
        it('fetches travel statuses with schema query params', async () => {
            const statuses = [
                { travel_id: 123, status: 'planned', planned_date: '2026-07-15', visited_date: null },
            ];
            mockedGet.mockResolvedValueOnce({ count: 1, results: statuses });

            const result = await fetchUserTravelStatuses('42', {
                status: 'planned',
                year: 2026,
                month: 7,
                perPage: 50,
            });

            expect(mockedGet).toHaveBeenCalledWith('/user/42/travel-statuses/?status=planned&year=2026&month=7&perPage=50');
            expect(result).toEqual(statuses);
        });

        it('upserts one travel status through POST /user/{id}/travel-statuses/', async () => {
            const payload = {
                travel_id: 123,
                status: 'planned' as const,
                planned_date: '2026-07-15',
                visited_date: null,
            };
            mockedPost.mockResolvedValueOnce({ ...payload, added_at: '2026-05-20T10:00:00Z', updated_at: null });

            await upsertUserTravelStatus('42', payload);

            expect(mockedPost).toHaveBeenCalledWith('/user/42/travel-statuses/', payload);
        });

        it('deletes one travel status through DELETE /user/{id}/travel-statuses/{travel_id}/', async () => {
            mockedDelete.mockResolvedValueOnce(null);

            await deleteUserTravelStatus('42', 123);

            expect(mockedDelete).toHaveBeenCalledWith('/user/42/travel-statuses/123/');
        });
    });
});
