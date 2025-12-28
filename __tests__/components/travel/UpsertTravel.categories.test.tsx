jest.mock('react-native-webview', () => ({
    WebView: () => null,
}));

jest.mock('@expo/vector-icons/MaterialIcons', () => 'MaterialIcons');

jest.mock('expo-image-picker', () => {
    const mockFn = jest.fn();
    const permissionHook = () => () => ({ status: 'granted', granted: true, canAskAgain: true });
    return {
        launchImageLibraryAsync: mockFn,
        launchCameraAsync: mockFn,
        requestCameraPermissionsAsync: mockFn,
        requestMediaLibraryPermissionsAsync: mockFn,
        getCameraPermissionsAsync: mockFn,
        getMediaLibraryPermissionsAsync: mockFn,
        MediaTypeOptions: {},
        PermissionStatus: { GRANTED: 'granted', DENIED: 'denied' },
        createPermissionHook: permissionHook,
    };
});

import { normalizeCategoryTravelAddress, normalizeTravelCategories, initFilters } from '@/components/travel/UpsertTravel';

describe('normalizeTravelCategories', () => {
    it('нормализует объекты с разными ключами id/name', () => {
        const input = [
            { id: 1, name: 'Горы' },
            { value: 2, name_ru: 'Море' },
            { category_id: 3, title_ru: 'Города' },
            { pk: 4, title: 'Природа' },
        ];
        expect(normalizeTravelCategories(input)).toEqual([
            { id: '1', name: 'Горы' },
            { id: '2', name: 'Море' },
            { id: '3', name: 'Города' },
            { id: '4', name: 'Природа' },
        ]);
    });

    it('нормализует примитивы в {id: index, name: value}', () => {
        expect(normalizeTravelCategories(['Горы', 'Море'])).toEqual([
            { id: '0', name: 'Горы' },
            { id: '1', name: 'Море' },
        ]);
    });

    it('возвращает пустой массив для неверных данных', () => {
        expect(normalizeTravelCategories(null as any)).toEqual([]);
        expect(normalizeTravelCategories(undefined as any)).toEqual([]);
        expect(normalizeTravelCategories({} as any)).toEqual([]);
    });
});

describe('normalizeCategoryTravelAddress', () => {
    it('нормализует объекты с разными ключами id/name', () => {
        const input = [
            { id: 1, name: 'Парковка' },
            { value: 2, name_ru: 'Отель' },
            { category_id: 3, title_ru: 'Ресторан' },
            { title: 'Без id' },
        ];
        expect(normalizeCategoryTravelAddress(input)).toEqual([
            { id: '1', name: 'Парковка' },
            { id: '2', name: 'Отель' },
            { id: '3', name: 'Ресторан' },
            { id: '3', name: 'Без id' }, // title fallback, id from index (3)
        ]);
    });

    it('возвращает строковые id/name для примитивов', () => {
        expect(normalizeCategoryTravelAddress(['a', 5])).toEqual([
            { id: 'a', name: 'a' },
            { id: '5', name: '5' },
        ]);
    });

    it('возвращает пустой массив для неверных данных', () => {
        expect(normalizeCategoryTravelAddress(null as any)).toEqual([]);
        expect(normalizeCategoryTravelAddress(undefined as any)).toEqual([]);
    });
});

describe('initFilters', () => {
    it('возвращает пустые списки фильтров по умолчанию', () => {
        expect(initFilters()).toEqual({
            countries: [],
            categories: [
                { id: '1', name: 'Горы' },
                { id: '2', name: 'Море' },
                { id: '3', name: 'Города' },
                { id: '4', name: 'Природа' },
            ],
            companions: [
                { id: '1', name: 'Один' },
                { id: '2', name: 'Пара' },
                { id: '3', name: 'Друзья' },
                { id: '4', name: 'Семья' },
            ],
            complexity: [
                { id: '1', name: 'Легко' },
                { id: '2', name: 'Средне' },
                { id: '3', name: 'Сложно' },
            ],
            month: [
                { id: '1', name: 'Январь' },
                { id: '2', name: 'Февраль' },
                { id: '3', name: 'Март' },
                { id: '4', name: 'Апрель' },
                { id: '5', name: 'Май' },
                { id: '6', name: 'Июнь' },
                { id: '7', name: 'Июль' },
                { id: '8', name: 'Август' },
                { id: '9', name: 'Сентябрь' },
                { id: '10', name: 'Октябрь' },
                { id: '11', name: 'Ноябрь' },
                { id: '12', name: 'Декабрь' },
            ],
            over_nights_stay: [
                { id: '1', name: 'Палатка' },
                { id: '2', name: 'Отель' },
                { id: '3', name: 'Кемпинг' },
                { id: '4', name: 'Без ночёвки' },
            ],
            transports: [
                { id: '1', name: 'Авто' },
                { id: '2', name: 'Поезд' },
                { id: '3', name: 'Самолёт' },
                { id: '4', name: 'Пешком' },
            ],
            categoryTravelAddress: [
                { id: '1', name: 'Парковка' },
                { id: '2', name: 'Отель' },
                { id: '3', name: 'Ресторан' },
                { id: '4', name: 'Достопримечательность' },
                { id: '5', name: 'Смотровая площадка' },
                { id: '6', name: 'Заправка' },
                { id: '7', name: 'Магазин' },
                { id: '8', name: 'Кафе' },
            ],
        });
    });
});
