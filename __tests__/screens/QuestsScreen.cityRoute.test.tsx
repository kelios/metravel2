/**
 * `/quests/<city>` — экран каталога со срезом из URL (#2654).
 *
 * Роут города мокает экран каталога, поэтому здесь сторожится сам экран:
 * нормализующий эффект не считает срез маршрута невалидным и не уводит со
 * страницы, смена города в URL меняет срез на том же экземпляре, сброс уходит
 * через `route.onLeave`, а «Искать в этой области» — фильтр на месте поверх
 * среза, которым владеет URL, — на странице города не предлагается.
 */
import { act, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Text } from 'react-native';
import type { ComponentProps, ReactElement } from 'react';
import type QuestsContentPanel from '@/screens/tabs/QuestsContentPanel';
import type QuestsMapSection from '@/screens/tabs/QuestsMapSection';
import type { QuestMeta } from '@/utils/questAdapters';
import { ALL_QUESTS_ID } from '@/screens/tabs/QuestsScreen.helpers';
import QuestsScreen, { type QuestsCatalogRoute } from '@/screens/tabs/QuestsScreen';

type ContentProps = ComponentProps<typeof QuestsContentPanel>;
let mockContentProps: ContentProps;
const mapSectionProps = () => (mockContentProps.mapSlot as ReactElement<ComponentProps<typeof QuestsMapSection>>).props;

jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({}), useIsFocused: () => true }));
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('@/components/MapPage/Map.web', () => () => null);
jest.mock('@/screens/tabs/questCatalogLocation', () => ({ requestQuestCatalogLocation: async () => null }));
jest.mock('@/components/seo/LazyInstantSEO', () => () => null);
jest.mock('@/hooks/useQuestReturnVisit', () => ({ useQuestReturnVisit: () => {} }));
jest.mock('@/hooks/useQuestReviewPrompt', () => ({
    useQuestReviewPrompt: () => ({ prompt: null, dismiss: () => {} }),
}));
jest.mock('@/hooks/useQuestsApi', () => {
    const quest = (id: string, cityId: string, cityName: string) => ({
        id, numericId: 0, title: id, cityId, cityName, countryCode: 'BY', lat: 53.9, lng: 27.56,
        points: 3, durationMin: 60, difficulty: 'easy', ratingAvg: null, ratingCount: 0,
        completionsCount: 0, viewsCount: 0, isCompletedByMe: false, firstCompleter: null,
    });
    const quests = [quest('minsk-a', '4', 'Минск'), quest('minsk-b', '4', 'Минск'), quest('grodno-a', '5', 'Гродно')];
    return { useQuestsList: () => ({ quests, loading: false, error: null }) };
});
jest.mock('@/hooks/useResponsive', () => ({
    useResponsive: () => ({ isMobile: false }),
    useBreakpoints: () => ({ isMobile: false, width: 1280 }),
}));
jest.mock('@/screens/tabs/QuestsContentPanel', () => (props: ContentProps) => {
    mockContentProps = props;
    return null;
});

const ids = (quests: QuestMeta[]) => quests.map((quest) => quest.id);

beforeEach(async () => {
    (Platform as { OS: string }).OS = 'web';
    await AsyncStorage.clear();
    jest.clearAllMocks();
});

it('keeps the URL slice: no normalizing leave, the city grid and the route footer', async () => {
    const onLeave = jest.fn();
    const footer = <Text>footer</Text>;
    const route: QuestsCatalogRoute = { selectionId: '4', onLeave, seo: null, footer };
    const { rerender } = await render(<QuestsScreen route={route} />);

    await waitFor(() => expect(ids(mockContentProps.questsAll)).toEqual(['minsk-a', 'minsk-b']));
    await act(async () => { await Promise.resolve(); });
    expect(mockContentProps.selectedCityId).toBe('4');
    expect(mockContentProps.footerSlot).toBe(footer);
    expect(onLeave).not.toHaveBeenCalled();

    // /quests/minsk → /quests/grodno на том же экземпляре экрана вкладки.
    await rerender(<QuestsScreen route={{ ...route, selectionId: '5' }} />);
    await waitFor(() => expect(ids(mockContentProps.questsAll)).toEqual(['grodno-a']));
    expect(mockContentProps.selectedCityId).toBe('5');
    expect(onLeave).not.toHaveBeenCalled();

    await act(async () => { await mockContentProps.onResetFilters(); });
    expect(onLeave).toHaveBeenCalledWith(ALL_QUESTS_ID);
});

it('does not offer the in-place map-area search over the URL-owned slice', async () => {
    const route: QuestsCatalogRoute = { selectionId: '4', onLeave: jest.fn(), seo: null };
    await render(<QuestsScreen route={route} />);
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe('4'));

    await act(() => { mockContentProps.onToggleViewMode(); });
    await waitFor(() => expect(mockContentProps.mapSlot).toBeTruthy());
    await act(() => { mapSectionProps().onMapMove({ latitude: 53.9, longitude: 27.56 }); });
    await act(async () => { await Promise.resolve(); });

    expect(mapSectionProps().showMapAreaSearch).toBe(false);
    expect(route.onLeave).not.toHaveBeenCalled();
});
