/**
 * #1791: личный статус прохождения приходил в каждом элементе каталога, но
 * отобрать по нему было нечем — «Пройден» жил только бейджем на карточке.
 * Тест сторожит границу видимости (гость не получает новых элементов
 * управления), сами срезы, счётчики и то, что выход из аккаунта не оставляет
 * каталог в личном фильтре.
 */
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { ComponentProps } from 'react';
import type QuestsContentPanel from '@/screens/tabs/QuestsContentPanel';
import type { QuestMeta } from '@/utils/questAdapters';
import {
    ALL_QUESTS_ID,
    COMPLETED_FILTER_ID,
    STORAGE_SELECTED_CITY,
    UNCOMPLETED_FILTER_ID,
} from '@/screens/tabs/QuestsScreen.helpers';
import { useAuthStore } from '@/stores/authStore';
import QuestsScreen from '@/screens/tabs/QuestsScreen';

type ContentProps = ComponentProps<typeof QuestsContentPanel>;
let mockContentProps: ContentProps;
let mockQuests: QuestMeta[] = [];
let mockMobile = false;

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
    useResponsive: () => ({ isMobile: mockMobile }),
    useBreakpoints: () => ({ isMobile: mockMobile, width: mockMobile ? 390 : 1280 }),
}));
jest.mock('@/screens/tabs/QuestsContentPanel', () => (props: ContentProps) => {
    const { Pressable } = require('react-native') as typeof import('react-native');
    mockContentProps = props;
    return <Pressable testID="open-filters" onPress={props.onOpenFilterDrawer} />;
});

const quest = (id: string, isCompletedByMe: boolean): QuestMeta => ({
    id,
    numericId: id.length,
    title: id,
    cityId: 'minsk',
    cityName: 'Минск',
    countryCode: 'BY',
    lat: 53.9,
    lng: 27.56,
    points: 3,
    durationMin: 60,
    difficulty: 'easy',
    ratingAvg: null,
    ratingCount: 0,
    completionsCount: isCompletedByMe ? 1 : 0,
    viewsCount: 0,
    isCompletedByMe,
    firstCompleter: null,
});

const CATALOG = () => [
    quest('walked-one', true),
    quest('fresh-one', false),
    quest('walked-two', true),
    quest('fresh-two', false),
];

const signIn = () => useAuthStore.setState({ isAuthenticated: true, authReady: true, userId: '109' });
const signOut = () => useAuthStore.setState({ isAuthenticated: false, authReady: true, userId: null });

beforeEach(async () => {
    (Platform as { OS: string }).OS = 'web';
    mockMobile = false;
    mockQuests = CATALOG();
    signOut();
    await AsyncStorage.clear();
    jest.clearAllMocks();
});

afterAll(() => {
    useAuthStore.setState({ isAuthenticated: false, authReady: false, userId: null });
});

describe.each([false, true])('personal catalog slices (mobile=%s)', (mobile) => {
    it('keeps the guest catalog free of personal controls', async () => {
        mockMobile = mobile;
        const { getByTestId, queryByTestId } = render(<QuestsScreen />);
        await waitFor(() => expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID));
        if (mobile) fireEvent.press(getByTestId('open-filters'));

        expect(queryByTestId('quests-sidebar-completed-button')).toBeNull();
        expect(queryByTestId('quests-sidebar-uncompleted-button')).toBeNull();
        expect(mockContentProps.questsAll).toHaveLength(4);
    });

    it('slices the catalog by personal completion for a signed-in player', async () => {
        mockMobile = mobile;
        signIn();
        const { getByTestId } = render(<QuestsScreen />);
        await waitFor(() => expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID));
        if (mobile) fireEvent.press(getByTestId('open-filters'));

        const completed = getByTestId('quests-sidebar-completed-button');
        expect(completed.props.accessibilityLabel).toBe('Пройденные мной квесты, 2 квеста');
        fireEvent.press(completed);

        await waitFor(() => expect(mockContentProps.questsAll.map((q) => q.id)).toEqual(['walked-one', 'walked-two']));
        expect(mockContentProps.selectedCityId).toBe(COMPLETED_FILTER_ID);
        expect(mockContentProps.filtersActive).toBe(true);
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(STORAGE_SELECTED_CITY, COMPLETED_FILTER_ID);

        if (mobile) fireEvent.press(getByTestId('open-filters'));
        expect(getByTestId('quests-sidebar-completed-button').props.accessibilityState.selected).toBe(true);

        fireEvent.press(getByTestId('quests-sidebar-uncompleted-button'));
        await waitFor(() => expect(mockContentProps.questsAll.map((q) => q.id)).toEqual(['fresh-one', 'fresh-two']));
        expect(mockContentProps.selectedCityId).toBe(UNCOMPLETED_FILTER_ID);
    });
});

it('offers «Пройденные» to a player with nothing completed, but not the redundant inverse', async () => {
    // «Не пройденные» при нуле прохождений дословно повторяют весь каталог —
    // второй кнопки «Все квесты» в сайдбаре быть не должно.
    mockQuests = [quest('fresh-one', false), quest('fresh-two', false)];
    signIn();

    const { getByTestId, queryByTestId } = render(<QuestsScreen />);
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID));

    const completed = getByTestId('quests-sidebar-completed-button');
    expect(completed.props.accessibilityLabel).toBe('Пройденные мной квесты, 0 квестов');
    expect(queryByTestId('quests-sidebar-uncompleted-button')).toBeNull();

    fireEvent.press(completed);
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(COMPLETED_FILTER_ID));
    expect(mockContentProps.questsAll).toHaveLength(0);
});

it('hides «Не пройденные» when the player has closed the whole catalog', async () => {
    // Зеркальный тупик: строка со счётчиком 0 вела бы в пустую сетку, которую
    // (в отличие от «Пройденных») объяснить нечем.
    mockQuests = [quest('walked-one', true), quest('walked-two', true)];
    signIn();

    const { getByTestId, queryByTestId } = render(<QuestsScreen />);
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID));

    expect(getByTestId('quests-sidebar-completed-button')).toBeTruthy();
    expect(queryByTestId('quests-sidebar-uncompleted-button')).toBeNull();
});

it('drops a personal slice when the player signs out', async () => {
    signIn();
    const { getByTestId, rerender } = render(<QuestsScreen />);
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID));
    fireEvent.press(getByTestId('quests-sidebar-completed-button'));
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(COMPLETED_FILTER_ID));

    signOut();
    rerender(<QuestsScreen />);

    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID));
    expect(mockContentProps.questsAll).toHaveLength(4);
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(STORAGE_SELECTED_CITY, ALL_QUESTS_ID);
});

it('holds a restored personal slice until auth is resolved', async () => {
    // Web-сессия стартует гостевой и опознаётся позже. Сброс до `authReady`
    // отбирал бы у вернувшегося игрока сохранённый фильтр на каждом заходе.
    await AsyncStorage.setItem(STORAGE_SELECTED_CITY, COMPLETED_FILTER_ID);
    useAuthStore.setState({ isAuthenticated: false, authReady: false, userId: null });

    const { rerender } = render(<QuestsScreen />);
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(COMPLETED_FILTER_ID));
    // Каталог приходит персональным (`Vary: Authorization`), поэтому срез
    // наполнен ещё до опознания сессии: гейт по `isAuthenticated` показывал бы
    // вернувшемуся игроку «вы ещё не прошли ни одного квеста».
    expect(mockContentProps.questsAll.map((q) => q.id)).toEqual(['walked-one', 'walked-two']);

    signIn();
    rerender(<QuestsScreen />);

    await waitFor(() => expect(mockContentProps.questsAll.map((q) => q.id)).toEqual(['walked-one', 'walked-two']));
    expect(mockContentProps.selectedCityId).toBe(COMPLETED_FILTER_ID);
});

it('leaves the city slice untouched by the personal filters', async () => {
    // Regression control карточки: счётчики и состав городов не должны
    // зависеть от того, что игрок уже прошёл.
    signIn();
    const { getByLabelText, getByTestId } = render(<QuestsScreen />);
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID));

    fireEvent.press(getByTestId('quests-sidebar-completed-button'));
    await waitFor(() => expect(mockContentProps.questsAll).toHaveLength(2));

    fireEvent.press(getByLabelText('Минск, 4 квеста'));
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe('minsk'));
    expect(mockContentProps.questsAll.map((q) => q.id)).toEqual([
        'walked-one', 'fresh-one', 'walked-two', 'fresh-two',
    ]);
});
