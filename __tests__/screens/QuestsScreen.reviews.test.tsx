import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { ComponentProps } from 'react';
import type QuestsContentPanel from '@/screens/tabs/QuestsContentPanel';
import type { QuestMeta } from '@/utils/questAdapters';
import { ALL_QUESTS_ID, REVIEWED_FILTER_ID, STORAGE_SELECTED_CITY } from '@/screens/tabs/QuestsScreen.helpers';
import QuestsScreen from '@/screens/tabs/QuestsScreen';

type ContentProps = ComponentProps<typeof QuestsContentPanel>;
let mockContentProps: ContentProps;
let mockQuests: QuestMeta[] = [];
let mockLoading = false;
let mockError: string | null = null;
let mockMobile = false;

jest.mock('expo-router', () => ({ useIsFocused: () => true }));
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('@/components/MapPage/Map.web', () => () => null);
jest.mock('@/components/seo/LazyInstantSEO', () => () => null);
jest.mock('@/hooks/useQuestReturnVisit', () => ({ useQuestReturnVisit: () => {} }));
jest.mock('@/hooks/useQuestsApi', () => ({
    useQuestsList: () => ({ quests: mockQuests, loading: mockLoading, error: mockError }),
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

const quest = (id: string, ratingCount: number): QuestMeta => ({
    id, ratingCount, title: id, cityId: 'minsk', cityName: 'Минск', countryCode: 'BY',
    lat: 53.9, lng: 27.56, points: 3, durationMin: 60, difficulty: 'easy',
    ratingAvg: ratingCount ? 4 : null, completionsCount: 20,
    isCompletedByMe: false, firstCompleter: null,
});

beforeEach(async () => {
    (Platform as { OS: string }).OS = 'web';
    mockMobile = false;
    mockLoading = false;
    mockError = null;
    mockQuests = [quest('unreviewed', 0), quest('one-review', 1), quest('three-reviews', 3)];
    await AsyncStorage.clear();
    jest.clearAllMocks();
});

describe.each([false, true])('catalog reviews slice (mobile=%s)', (mobile) => {
    it('selects only positive ratingCount quests and marks the slice active', async () => {
        mockMobile = mobile;
        const { getByTestId } = render(<QuestsScreen />);
        await waitFor(() => expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID));
        if (mobile) fireEvent.press(getByTestId('open-filters'));
        const button = getByTestId('quests-sidebar-reviewed-button');
        expect(button.props.accessibilityLabel).toBe('Квесты с отзывами, 2 квеста');
        fireEvent.press(button);
        await waitFor(() => expect(mockContentProps.questsAll.map((q) => q.id)).toEqual(['one-review', 'three-reviews']));
        expect(mockContentProps.selectedCityId).toBe(REVIEWED_FILTER_ID);
        expect(mockContentProps.filtersActive).toBe(true);
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(STORAGE_SELECTED_CITY, REVIEWED_FILTER_ID);
        if (mobile) fireEvent.press(getByTestId('open-filters'));
        expect(getByTestId('quests-sidebar-reviewed-button').props.accessibilityState.selected).toBe(true);
    });

    it('hides the slice when every quest has zero reviews', async () => {
        mockMobile = mobile;
        mockQuests = [quest('unreviewed', 0)];
        const { getByTestId, queryByTestId } = render(<QuestsScreen />);
        await waitFor(() => expect(mockContentProps.questsAll).toHaveLength(1));
        if (mobile) fireEvent.press(getByTestId('open-filters'));
        expect(queryByTestId('quests-sidebar-reviewed-button')).toBeNull();
    });
});

it.each([false, true])('resets an active slice when its last review disappears (catalogEmpty=%s)', async (catalogEmpty) => {
    mockQuests = [quest('last-reviewed', 1)];
    const { getByTestId, queryByTestId, rerender } = render(<QuestsScreen />);
    fireEvent.press(getByTestId('quests-sidebar-reviewed-button'));
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(REVIEWED_FILTER_ID));
    mockQuests = catalogEmpty ? [] : [quest('last-reviewed', 0)];
    rerender(<QuestsScreen />);
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID));
    expect(mockContentProps.filtersActive).toBe(false);
    expect(mockContentProps.questsAll).toHaveLength(catalogEmpty ? 0 : 1);
    expect(queryByTestId('quests-sidebar-reviewed-button')).toBeNull();
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(STORAGE_SELECTED_CITY, ALL_QUESTS_ID);
});

it('waits for loaded data before validating a persisted reviews slice', async () => {
    await AsyncStorage.setItem(STORAGE_SELECTED_CITY, REVIEWED_FILTER_ID);
    mockLoading = true;
    mockQuests = [];
    const { rerender } = render(<QuestsScreen />);
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(REVIEWED_FILTER_ID));
    mockLoading = false;
    mockQuests = [quest('reviewed', 1)];
    rerender(<QuestsScreen />);
    await waitFor(() => expect(mockContentProps.questsAll.map((q) => q.id)).toEqual(['reviewed']));
    expect(mockContentProps.selectedCityId).toBe(REVIEWED_FILTER_ID);
});

it('resets a persisted reviews slice when the loaded catalog has no reviews', async () => {
    await AsyncStorage.setItem(STORAGE_SELECTED_CITY, REVIEWED_FILTER_ID);
    mockQuests = [quest('unreviewed', 0)];
    render(<QuestsScreen />);
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(STORAGE_SELECTED_CITY, ALL_QUESTS_ID));
    expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID);
    expect(mockContentProps.questsAll).toHaveLength(1);
});

it.each(['minsk', REVIEWED_FILTER_ID])('preserves persisted selection %s after a failed fetch until a successful empty response', async (selection) => {
    await AsyncStorage.setItem(STORAGE_SELECTED_CITY, selection);
    mockQuests = [];
    mockError = 'Network unavailable';
    const { rerender } = render(<QuestsScreen />);
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(selection));
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith(STORAGE_SELECTED_CITY, ALL_QUESTS_ID);

    mockError = null;
    rerender(<QuestsScreen />);
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID));
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(STORAGE_SELECTED_CITY, ALL_QUESTS_ID);
});
