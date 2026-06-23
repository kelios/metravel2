import AsyncStorage from '@react-native-async-storage/async-storage';

import { markTravelAsFavorite, unmarkTravelAsFavorite } from '@/api/travelsFavorites';
import { fetchUserFavoriteTravels } from '@/api/user';
import { useFavoritesStore } from '@/stores/favoritesStore';

jest.mock('@/api/travelsFavorites', () => ({
    markTravelAsFavorite: jest.fn(async () => ({})),
    unmarkTravelAsFavorite: jest.fn(async () => ({})),
}));

jest.mock('@/api/user', () => ({
    clearUserFavorites: jest.fn(async () => null),
    fetchUserFavoriteTravels: jest.fn(async () => []),
}));

describe('favoritesStore server favorite API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (AsyncStorage as any).__reset?.();
        useFavoritesStore.setState({
            favorites: [],
            _inFlight: new Set(),
            _fetched: false,
            _userId: null,
        });
    });

    it('marks an authenticated roulette travel as favorite through the server endpoint', async () => {
        (fetchUserFavoriteTravels as jest.Mock).mockResolvedValueOnce([
            {
                id: 514,
                name: 'Random travel',
                slug: 'random-travel',
                travel_image_thumb_url: 'https://metravel.by/media/random.jpg',
                updated_at: '2026-06-23T20:00:00Z',
                countryName: 'Польша',
            },
        ]);

        await useFavoritesStore.getState().addFavorite(
            {
                id: 514,
                type: 'travel',
                title: 'Random travel',
                url: '/travels/random-travel',
                imageUrl: 'https://metravel.by/media/random.jpg',
                country: 'Польша',
            },
            { isAuthenticated: true, userId: '104' },
        );

        expect(markTravelAsFavorite).toHaveBeenCalledWith(514);
        expect(fetchUserFavoriteTravels).toHaveBeenCalledWith('104');
        expect(useFavoritesStore.getState().isFavorite(514, 'travel')).toBe(true);
    });

    it('unmarks an authenticated roulette travel through the server endpoint', async () => {
        useFavoritesStore.setState({
            favorites: [
                {
                    id: 514,
                    type: 'travel',
                    title: 'Random travel',
                    url: '/travels/random-travel',
                    addedAt: Date.now(),
                },
            ],
        });
        (fetchUserFavoriteTravels as jest.Mock).mockResolvedValueOnce([]);

        await useFavoritesStore.getState().removeFavorite(514, 'travel', {
            isAuthenticated: true,
            userId: '104',
        });

        expect(unmarkTravelAsFavorite).toHaveBeenCalledWith(514);
        expect(fetchUserFavoriteTravels).toHaveBeenCalledWith('104');
        expect(useFavoritesStore.getState().isFavorite(514, 'travel')).toBe(false);
    });
});
