/**
 * #3218: указатель «Квесты по странам / по городам» — подвал только общего
 * каталога. Под выдачей города, фильтра или поиска он выглядел как чужой хвост
 * страницы (скрин владельца 11.11: «Квесты: Несвиж» + сотни ссылок ниже).
 */
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { ComponentProps } from 'react';
import type QuestsContentPanel from '@/screens/tabs/QuestsContentPanel';
import type { QuestMeta } from '@/utils/questAdapters';
import { ALL_QUESTS_ID } from '@/screens/tabs/QuestsScreen.helpers';
import QuestsScreen from '@/screens/tabs/QuestsScreen';

type ContentProps = ComponentProps<typeof QuestsContentPanel>;
let mockContentProps: ContentProps;

jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({}), useIsFocused: () => true }));
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('@/components/MapPage/Map.web', () => () => null);
jest.mock('@/components/seo/LazyInstantSEO', () => () => null);
// С discovery JSON-LD уходит в тело как `<script>`, а нативный тест-рендерер его не рисует.
jest.mock('@/components/seo/jsonLdScript', () => ({ jsonLdScript: () => null }));
jest.mock('@/hooks/useQuestReturnVisit', () => ({ useQuestReturnVisit: () => {} }));
jest.mock('@/hooks/useQuestReviewPrompt', () => ({
    useQuestReviewPrompt: () => ({ prompt: null, dismiss: () => {} }),
}));
jest.mock('@/hooks/useQuestsApi', () => ({
    useQuestsList: () => ({ quests: mockQuests(), loading: false, failed: false }),
}));
jest.mock('@/hooks/useResponsive', () => ({
    useResponsive: () => ({ isMobile: false }),
    useBreakpoints: () => ({ isMobile: false, width: 1280 }),
}));
jest.mock('@/components/quests/runtime/QuestDiscoveryContext', () => ({
    useQuestDiscovery: () => ({
        countries: [{ title: 'Беларусь', path: '/quests/country/by' }],
        cities: [{ title: 'Минск', path: '/quests/minsk' }],
        quests: [],
    }),
}));
jest.mock('@/screens/tabs/QuestsContentPanel', () => (props: ContentProps) => {
    mockContentProps = props;
    return null;
});

const quest = (id: string): QuestMeta => ({
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
});
const mockQuests = () => [quest('one'), quest('two')];

beforeEach(async () => {
    (Platform as { OS: string }).OS = 'web';
    await AsyncStorage.clear();
});

it('shows the directory only under the unfiltered catalog', async () => {
    const { getByTestId, getByLabelText } = await render(<QuestsScreen />);
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID));
    expect(mockContentProps.footerSlot).toBeTruthy();

    await act(() => mockContentProps.onSearchChange('one'));
    await waitFor(() => expect(mockContentProps.footerSlot).toBeNull());
    await act(() => mockContentProps.onSearchChange(''));
    await waitFor(() => expect(mockContentProps.footerSlot).toBeTruthy());

    await fireEvent.press(getByTestId('quests-country-toggle-BY'));
    await fireEvent.press(getByLabelText('Минск, 2 квеста'));
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe('minsk'));
    expect(mockContentProps.footerSlot).toBeNull();
});
