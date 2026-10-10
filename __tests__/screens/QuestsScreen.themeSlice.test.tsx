/**
 * #2377: тематическая подборка — тот же слот выбора `__theme__:<id>`, что
 * город и страна. Тест сторожит, что валидатор выбора после загрузки каталога
 * не сбрасывает тему в «Все квесты», что сохранённая тема (в том числе вне
 * сезона) восстанавливается со своими квестами, а неизвестная — сбрасывается.
 */
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { ComponentProps } from 'react';
import type QuestsContentPanel from '@/screens/tabs/QuestsContentPanel';
import type { QuestMeta } from '@/utils/questAdapters';
import { ALL_QUESTS_ID, STORAGE_SELECTED_CITY } from '@/screens/tabs/QuestsScreen.helpers';
import { toThemeSelectionId } from '@/utils/questCatalogSelection';
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
    mockContentProps = props;
    return null;
});

const quest = (id: string, tags: string[]): QuestMeta => ({
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
    completionsCount: 0,
    viewsCount: 0,
    isCompletedByMe: false,
    firstCompleter: null,
    tags,
});

const CATALOG = () => [
    quest('ghosts', ['halloween', 'mystic']),
    quest('myths', ['myth']),
    quest('plain', ['history']),
];

beforeEach(async () => {
    (Platform as { OS: string }).OS = 'web';
    mockQuests = CATALOG();
    await AsyncStorage.clear();
    jest.clearAllMocks();
});

it('keeps a selected theme after the catalog validates the selection', async () => {
    const { getByTestId } = render(<QuestsScreen />);
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID));
    // Пустое хранилище само пишет «Все квесты» при восстановлении — считаем записи после.
    jest.clearAllMocks();

    const legends = getByTestId('quests-sidebar-theme-legends');
    expect(legends.props.accessibilityLabel).toBe('Легенды и призраки: 2 квеста');
    fireEvent.press(legends);

    const legendsId = toThemeSelectionId('legends');
    await waitFor(() => expect(mockContentProps.questsAll.map((q) => q.id)).toEqual(['ghosts', 'myths']));
    expect(mockContentProps.selectedCityId).toBe(legendsId);
    expect(mockContentProps.filtersActive).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(STORAGE_SELECTED_CITY, legendsId);
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(STORAGE_SELECTED_CITY, ALL_QUESTS_ID);
});

it('restores a stored seasonal theme with its quests regardless of the season window', async () => {
    const halloweenId = toThemeSelectionId('halloween');
    await AsyncStorage.setItem(STORAGE_SELECTED_CITY, halloweenId);
    jest.clearAllMocks();
    render(<QuestsScreen />);

    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(halloweenId));
    expect(mockContentProps.questsAll.map((q) => q.id)).toEqual(['ghosts']);
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(STORAGE_SELECTED_CITY, ALL_QUESTS_ID);
});

it('resets a stored theme that is no longer in the registry', async () => {
    await AsyncStorage.setItem(STORAGE_SELECTED_CITY, toThemeSelectionId('removed-theme'));
    render(<QuestsScreen />);

    await waitFor(() => {
        expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID);
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(STORAGE_SELECTED_CITY, ALL_QUESTS_ID);
    });
    expect(mockContentProps.questsAll).toHaveLength(3);
});
