import { apiClient } from '@/api/client';
import { fetchQuestStats } from '@/api/quests';

jest.mock('@/api/client', () => {
    const actual = jest.requireActual('@/api/client');
    return { ...actual, apiClient: { get: jest.fn() } };
});

const mockGet = apiClient.get as jest.Mock;

describe('fetchQuestStats (#2761)', () => {
    beforeEach(() => mockGet.mockReset());

    it('reads the distinct player count from the public stats endpoint', async () => {
        mockGet.mockResolvedValue({ players_count: 26 });

        await expect(fetchQuestStats()).resolves.toEqual({ players_count: 26 });
        expect(mockGet).toHaveBeenCalledWith('/quests/stats/', undefined, undefined);
    });

    it.each([[{}], [null], [{ players_count: '26' }], [{ players_count: -1 }], [{ players_count: 2.5 }]])(
        'treats an unexpected body %j as no number',
        async (body) => {
            mockGet.mockResolvedValue(body);

            await expect(fetchQuestStats()).resolves.toBeNull();
        },
    );

    it('lets request failures reach the query layer', async () => {
        mockGet.mockRejectedValue(new Error('offline'));

        await expect(fetchQuestStats()).rejects.toThrow('offline');
    });
});
