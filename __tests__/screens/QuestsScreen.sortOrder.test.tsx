/**
 * Порядок каталога квестов.
 *
 * #1790: каталог 182 квестов шёл в порядке id бэкенда, поэтому квест с тремя
 * прохождениями стоял там же, где квест без единого. Тест сторожит: порядок
 * совпадает с правилом `utils/questPopularity` (то же, что у серверного
 * `?sort=popular` и промо главной), вариант не появляется на данных ниже
 * порога, и он не перебивает списки, упорядоченные по расстоянию.
 *
 * #1988: порядок перестал быть тумблером и стал ВЫБОРОМ из «Популярные» и
 * «По рейтингу». Отсюда ещё два инварианта: выбор второго варианта заменяет
 * первый, а не складывается с ним, и рейтинговый порядок считает публичный
 * рейтинг (`utils/questRatingOrder`, три отзыва), а не сырой `rating_avg` —
 * иначе квест с одним отзывом на пятёрку возглавил бы каталог.
 */
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { ComponentProps } from 'react';
import type QuestsContentPanel from '@/screens/tabs/QuestsContentPanel';
import type { QuestMeta } from '@/utils/questAdapters';
import { ALL_QUESTS_ID } from '@/screens/tabs/QuestsScreen.helpers';
import QuestsScreen from '@/screens/tabs/QuestsScreen';

type ContentProps = ComponentProps<typeof QuestsContentPanel>;
let mockContentProps: ContentProps;
let mockQuests: QuestMeta[] = [];

jest.mock('expo-router', () => ({ useIsFocused: () => true }));
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('@/components/MapPage/Map.web', () => () => null);
jest.mock('@/components/seo/LazyInstantSEO', () => () => null);
jest.mock('@/hooks/useQuestReturnVisit', () => ({ useQuestReturnVisit: () => {} }));
jest.mock('@/hooks/useQuestReviewPrompt', () => ({
    useQuestReviewPrompt: () => ({ prompt: null, dismiss: () => {} }),
}));
jest.mock('@/hooks/useQuestsApi', () => ({
    useQuestsList: () => ({ quests: mockQuests, loading: false, error: null }),
}));
jest.mock('@/hooks/useResponsive', () => ({
    useResponsive: () => ({ isMobile: false }),
    useBreakpoints: () => ({ isMobile: false, width: 1280 }),
}));
jest.mock('@/screens/tabs/QuestsContentPanel', () => (props: ContentProps) => {
    const { Pressable } = require('react-native') as typeof import('react-native');
    mockContentProps = props;
    return <><Pressable testID="toggle-popular" onPress={() => props.onSelectSortOrder?.('popular')}  /><Pressable testID="toggle-rating" onPress={() => props.onSelectSortOrder?.('rating')} /></>;
});

// Числовые id бэкенда намеренно НЕ повторяют ни порядок каталога, ни порядок
// популярности: тай-брейк обязан быть виден отдельно от обоих.
const NUMERIC_IDS: Record<string, number> = {
    cold: 40,
    'played-twice-few-views': 12,
    'played-thrice': 32,
    'played-twice-many-views': 51,
    'far-and-popular': 7,
    'near-and-cold': 9,
};

const quest = (
    id: string,
    completionsCount: number,
    viewsCount = 0,
    coords: { lat: number; lng: number } = { lat: 53.9, lng: 27.56 },
): QuestMeta => ({
    id,
    numericId: NUMERIC_IDS[id] ?? 0,
    title: id,
    cityId: 'minsk',
    cityName: 'Минск',
    countryCode: 'BY',
    lat: coords.lat,
    lng: coords.lng,
    points: 3,
    durationMin: 60,
    difficulty: 'easy',
    ratingAvg: null,
    ratingCount: 0,
    completionsCount,
    viewsCount,
    isCompletedByMe: false,
    firstCompleter: null,
});

// Порядок каталога намеренно НЕ совпадает с популярностью: без сортировки
// экран обязан отдать список ровно в этом порядке.
const CATALOG_ORDER = ['cold', 'played-twice-few-views', 'played-thrice', 'played-twice-many-views'];
const POPULAR_ORDER = ['played-thrice', 'played-twice-many-views', 'played-twice-few-views', 'cold'];

const popularCatalog = (): QuestMeta[] => [
    quest('cold', 0, 30),
    quest('played-twice-few-views', 2, 5),
    quest('played-thrice', 3, 1),
    quest('played-twice-many-views', 2, 20),
];

beforeEach(async () => {
    (Platform as { OS: string }).OS = 'web';
    mockQuests = popularCatalog();
    await AsyncStorage.clear();
    jest.clearAllMocks();
});

it('keeps the backend order until the visitor asks for popular', async () => {
    const { getByTestId } = render(<QuestsScreen />);
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID));

    expect(mockContentProps.questsAll.map((q) => q.id)).toEqual(CATALOG_ORDER);
    expect(mockContentProps.availableSortOrders?.includes('popular')).toBe(true);
    expect(mockContentProps.activeSortOrder).toBe('default');

    fireEvent.press(getByTestId('toggle-popular'));

    await waitFor(() => expect(mockContentProps.activeSortOrder).toBe('popular'));
    // Прохождения → просмотры → id: ничью двух квестов с двумя прохождениями
    // ломают просмотры, иначе каталог разошёлся бы с промо главной (#1798).
    expect(mockContentProps.questsAll.map((q) => q.id)).toEqual(POPULAR_ORDER);
});

it('returns to the catalog order on a second press', async () => {
    const { getByTestId } = render(<QuestsScreen />);
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID));

    fireEvent.press(getByTestId('toggle-popular'));
    await waitFor(() => expect(mockContentProps.questsAll.map((q) => q.id)).toEqual(POPULAR_ORDER));

    fireEvent.press(getByTestId('toggle-popular'));
    await waitFor(() => expect(mockContentProps.questsAll.map((q) => q.id)).toEqual(CATALOG_ORDER));
    expect(mockContentProps.activeSortOrder).toBe('default');
});

it.each([
    ['nothing completed', 0],
    ['a single walkthrough each', 1],
])('hides the sort when the catalog only has %s', async (_label, completions) => {
    mockQuests = popularCatalog().map((entry) => ({ ...entry, completionsCount: completions }));

    render(<QuestsScreen />);
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID));

    expect(mockContentProps.availableSortOrders?.includes('popular')).toBe(false);
    expect(mockContentProps.questsAll.map((q) => q.id)).toEqual(CATALOG_ORDER);
});

it('hides the sort when only one quest passes the threshold', async () => {
    mockQuests = popularCatalog().map((entry) => (
        entry.id === 'played-thrice' ? entry : { ...entry, completionsCount: 0 }
    ));

    render(<QuestsScreen />);
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID));

    expect(mockContentProps.availableSortOrders?.includes('popular')).toBe(false);
});

it('drops an active sort when the current slice loses its popular quests', async () => {
    const { getByTestId, rerender } = render(<QuestsScreen />);
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID));

    fireEvent.press(getByTestId('toggle-popular'));
    await waitFor(() => expect(mockContentProps.activeSortOrder).toBe('popular'));

    mockQuests = popularCatalog().map((entry) => ({ ...entry, completionsCount: 0 }));
    rerender(<QuestsScreen />);

    await waitFor(() => expect(mockContentProps.availableSortOrders?.includes('popular')).toBe(false));
    expect(mockContentProps.activeSortOrder).toBe('default');
    expect(mockContentProps.questsAll.map((q) => q.id)).toEqual(CATALOG_ORDER);
});

/**
 * #1988: рейтинговый порядок — второй вариант того же выбора. Он появляется
 * по своему порогу (`hasPublicQuestRating`, три отзыва) и не отменяет
 * популярность.
 */
it('offers rating sort only once two quests carry a public rating', async () => {
    mockQuests = popularCatalog().map((entry) => (
        entry.id === 'cold' ? { ...entry, ratingAvg: 4.9, ratingCount: 4 } : entry
    ));
    render(<QuestsScreen />);
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID));
    expect(mockContentProps.availableSortOrders?.includes('rating')).toBe(false);
});

it('reorders by public rating and leaves unrated quests in catalog order', async () => {
    mockQuests = popularCatalog().map((entry) => {
        if (entry.id === 'cold') return { ...entry, ratingAvg: 4.2, ratingCount: 5 };
        if (entry.id === 'played-thrice') return { ...entry, ratingAvg: 4.9, ratingCount: 3 };
        // Один отзыв — не публичный рейтинг: этот квест наверх не поднимается.
        if (entry.id === 'played-twice-many-views') return { ...entry, ratingAvg: 5, ratingCount: 1 };
        return entry;
    });

    const { getByTestId } = render(<QuestsScreen />);
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID));
    expect(mockContentProps.availableSortOrders).toEqual(['popular', 'rating']);

    fireEvent.press(getByTestId('toggle-rating'));
    await waitFor(() => expect(mockContentProps.activeSortOrder).toBe('rating'));

    expect(mockContentProps.questsAll.map((q) => q.id)).toEqual([
        'played-thrice',
        'cold',
        'played-twice-few-views',
        'played-twice-many-views',
    ]);

    // Выбор второго варианта заменяет первый, а не складывается с ним.
    fireEvent.press(getByTestId('toggle-popular'));
    await waitFor(() => expect(mockContentProps.activeSortOrder).toBe('popular'));
    expect(mockContentProps.questsAll.map((q) => q.id)).toEqual(POPULAR_ORDER);

    // Повторное нажатие по выбранному возвращает порядок каталога.
    fireEvent.press(getByTestId('toggle-popular'));
    await waitFor(() => expect(mockContentProps.activeSortOrder).toBe('default'));
    expect(mockContentProps.questsAll.map((q) => q.id)).toEqual(CATALOG_ORDER);
});

it('never reorders a distance-ordered map-area list', async () => {
    // «Искать в этой области» уже отсортирован по километрам — популярность
    // перебила бы единственный смысл среза.
    mockQuests = [
        quest('far-and-popular', 5, 50, { lat: 53.95, lng: 27.6 }),
        quest('near-and-cold', 2, 0, { lat: 53.9, lng: 27.56 }),
    ];

    render(<QuestsScreen />);
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID));
    expect(mockContentProps.availableSortOrders?.includes('popular')).toBe(true);

    mockContentProps.onMapMove({ latitude: 53.9, longitude: 27.56 });
    await waitFor(() => expect(mockContentProps.showMapAreaSearch).toBe(true));
    mockContentProps.onSearchMapArea();

    await waitFor(() => expect(mockContentProps.isMapAreaActive).toBe(true));
    expect(mockContentProps.availableSortOrders?.includes('popular')).toBe(false);
    expect(mockContentProps.questsAll.map((q) => q.id)).toEqual(['near-and-cold', 'far-and-popular']);
});

it('offers the sort again once a search overrides the map area', async () => {
    // Свободный поиск идёт по всему каталогу и отменяет и «Рядом», и область
    // карты: его выдача уже НЕ упорядочена по расстоянию, поэтому прятать
    // переключатель здесь значило бы отнимать сортировку у поиска.
    const { getByTestId } = render(<QuestsScreen />);
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID));

    mockContentProps.onMapMove({ latitude: 53.9, longitude: 27.56 });
    await waitFor(() => expect(mockContentProps.showMapAreaSearch).toBe(true));
    mockContentProps.onSearchMapArea();
    await waitFor(() => expect(mockContentProps.isMapAreaActive).toBe(true));
    expect(mockContentProps.availableSortOrders?.includes('popular')).toBe(false);

    mockContentProps.onSearchChange('played');
    await waitFor(() => expect(mockContentProps.availableSortOrders?.includes('popular')).toBe(true));
    expect(mockContentProps.questsAll.map((q) => q.id)).toEqual([
        'played-twice-few-views',
        'played-thrice',
        'played-twice-many-views',
    ]);

    fireEvent.press(getByTestId('toggle-popular'));
    await waitFor(() => expect(mockContentProps.questsAll.map((q) => q.id)).toEqual([
        'played-thrice',
        'played-twice-many-views',
        'played-twice-few-views',
    ]));
});
