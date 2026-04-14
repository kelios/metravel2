import { resolveInitialQuestCitySelection } from '@/screens/tabs/questLocationSelection';

describe('resolveInitialQuestCitySelection', () => {
    const nearbyId = '__nearby__';
    const cities = [
        { id: 'yerevan', name: 'Yerevan', lat: 40.1792, lng: 44.4991 },
        { id: 'krakow', name: 'Krakow', lat: 50.0647, lng: 19.9450 },
        { id: 'minsk', name: 'Minsk', lat: 53.9006, lng: 27.5590 },
    ];

    it('keeps the nearby selection when it is explicitly stored', () => {
        expect(
            resolveInitialQuestCitySelection({
                cities,
                selectedCityId: nearbyId,
                userLoc: { lat: 50.0647, lng: 19.9450 },
                nearbyId,
            }),
        ).toBe(nearbyId);
    });

    it('switches from a stale saved city to the actual nearby city', () => {
        expect(
            resolveInitialQuestCitySelection({
                cities,
                selectedCityId: 'yerevan',
                userLoc: { lat: 50.0647, lng: 19.9450 },
                nearbyId,
            }),
        ).toBe('krakow');
    });

    it('keeps the saved city when no current user location is available', () => {
        expect(
            resolveInitialQuestCitySelection({
                cities,
                selectedCityId: 'yerevan',
                userLoc: null,
                nearbyId,
            }),
        ).toBe('yerevan');
    });

    it('keeps the saved city when no supported city is actually nearby', () => {
        expect(
            resolveInitialQuestCitySelection({
                cities,
                selectedCityId: 'yerevan',
                userLoc: { lat: 52.5200, lng: 13.4050 },
                nearbyId,
            }),
        ).toBe('yerevan');
    });
});
