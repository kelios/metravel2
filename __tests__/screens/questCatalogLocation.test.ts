import { requestQuestCatalogLocation } from '@/screens/tabs/questCatalogLocation';

const mockRequestPermission = jest.fn();
const mockGetPosition = jest.fn();

jest.mock('expo-location', () => ({
    requestForegroundPermissionsAsync: (...args: unknown[]) => mockRequestPermission(...args),
    getCurrentPositionAsync: (...args: unknown[]) => mockGetPosition(...args),
    LocationAccuracy: { Balanced: 3 },
}));

beforeEach(() => {
    mockRequestPermission.mockReset();
    mockGetPosition.mockReset();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('requestQuestCatalogLocation (#2389)', () => {
    it('returns the player position once permission is granted', async () => {
        mockRequestPermission.mockResolvedValue({ status: 'granted' });
        mockGetPosition.mockResolvedValue({ coords: { latitude: 53.91, longitude: 27.57 } });

        await expect(requestQuestCatalogLocation(() => false)).resolves.toEqual({
            coords: { lat: 53.91, lng: 27.57 },
        });
        expect(mockGetPosition).toHaveBeenCalledWith({ accuracy: 3 });
    });

    it('explains a refused permission without asking for the position', async () => {
        mockRequestPermission.mockResolvedValue({ status: 'denied' });

        await expect(requestQuestCatalogLocation(() => false)).resolves.toEqual({
            failure: 'Геолокация запрещена. Показываем весь каталог, пока доступ не разрешён.',
        });
        expect(mockGetPosition).not.toHaveBeenCalled();
    });

    it('explains a failed position lookup', async () => {
        mockRequestPermission.mockResolvedValue({ status: 'granted' });
        mockGetPosition.mockRejectedValue(new Error('timeout'));

        await expect(requestQuestCatalogLocation(() => false)).resolves.toEqual({
            failure: 'Не удалось определить местоположение. Проверьте разрешения браузера и попробуйте ещё раз.',
        });
    });

    it('stops after the permission prompt when the request was cancelled', async () => {
        mockRequestPermission.mockResolvedValue({ status: 'granted' });

        await expect(requestQuestCatalogLocation(() => true)).resolves.toBeNull();
        expect(mockGetPosition).not.toHaveBeenCalled();
    });
});
