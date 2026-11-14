/**
 * #3379: состояние движка поиска доходит до обоих режимов экрана.
 * (ж) Пока чанк движков не пришёл, карта получает «данные не готовы» и рисует
 * загрузку, а не карту без меток: раньше в неё уходил голый `dataLoaded`.
 * (д) Исчерпанные повторы — `retrySearch` у панели, ожидание снято.
 */
import { act, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { ComponentProps, ReactElement } from 'react';
import type QuestsContentPanel from '@/screens/tabs/QuestsContentPanel';
import type QuestsMapSection from '@/screens/tabs/QuestsMapSection';
import type { QuestMeta } from '@/utils/questAdapters';
import QuestsScreen from '@/screens/tabs/QuestsScreen';

type ContentProps = ComponentProps<typeof QuestsContentPanel>;
let mockContentProps: ContentProps;
let mockSearchState: { pending: boolean; failed: boolean } = { pending: true, failed: false };
const mockRetry = jest.fn();
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
const mockQuests: QuestMeta[] = [
    { id: 'krakow', numericId: 1, title: 'Kraków', cityId: 'krakow', cityName: 'Kraków', countryCode: 'PL', lat: 50.06, lng: 19.94, points: 3, durationMin: 60 } as QuestMeta,
];
jest.mock('@/hooks/useQuestsApi', () => ({
    useQuestsList: () => ({ quests: mockQuests, loading: false, failed: false }),
}));
jest.mock('@/hooks/useResponsive', () => ({
    useResponsive: () => ({ isMobile: false }),
    useBreakpoints: () => ({ isMobile: false, width: 1280 }),
}));
jest.mock('@/screens/tabs/useQuestCatalogEngines', () => ({
    ...jest.requireActual('@/screens/tabs/useQuestCatalogEngines'),
    useQuestCatalogSearchResult: (_quests: unknown, _ids: unknown, term: string, ready: boolean) =>
        ready && term ? { quests: [], approximate: false, ...mockSearchState, retry: mockRetry } : null,
}));
jest.mock('@/screens/tabs/QuestsContentPanel', () => (props: ContentProps) => {
    mockContentProps = props;
    return null;
});

async function searchInMapMode() {
    await render(<QuestsScreen />);
    await waitFor(() => expect(mockContentProps).toBeDefined());
    await act(() => { mockContentProps.onToggleViewMode(); });
    await act(() => { mockContentProps.onSearchChange('краков'); });
    await waitFor(() => expect(mockContentProps.appliedSearchTerm).toBe('краков'));
}

beforeEach(async () => {
    (Platform as { OS: string }).OS = 'web';
    await AsyncStorage.clear();
    jest.clearAllMocks();
});

it('shows the map loading, not an empty map, while the search engine chunk is on its way', async () => {
    mockSearchState = { pending: true, failed: false };
    await searchInMapMode();
    expect(mapSectionProps().dataLoaded).toBe(false);
    expect(mockContentProps.dataLoaded).toBe(false);
    expect(mockContentProps.retrySearch).toBeUndefined();
});

it('hands the panel a retry once the engine chunk failed for good', async () => {
    mockSearchState = { pending: false, failed: true };
    await searchInMapMode();
    expect(mockContentProps.retrySearch).toBe(mockRetry);
    expect(mockContentProps.dataLoaded).toBe(true);
});
