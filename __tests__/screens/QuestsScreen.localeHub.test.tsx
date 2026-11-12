/**
 * #3217 / #3349: the hub `/{locale}/quests` lists only quests whose page in
 * that locale the server serves (`servedLocales`). A published translation
 * (`availableLocales`) is not enough, and every slice of the hub — the list,
 * its total and the search inside it — reads that one membership. The Russian
 * `/quests` stays unfiltered.
 */
import { act, render, waitFor } from '@testing-library/react-native';
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
jest.mock('@/components/quests/runtime/QuestDiscoveryContext', () => ({ useQuestDiscovery: () => null }));
jest.mock('@/screens/tabs/QuestsContentPanel', () => (props: ContentProps) => {
    mockContentProps = props;
    return null;
});

const ALL_LOCALES = ['ru', 'be', 'uk', 'pl', 'en'];
const quest = (id: string, extra: Partial<QuestMeta>): QuestMeta => ({
    id,
    numericId: id.length,
    title: `Брест ${id}`,
    cityId: 'brest',
    cityName: 'Брест',
    countryCode: 'BY',
    lat: 52.1,
    lng: 23.7,
    points: 3,
    durationMin: 60,
    difficulty: 'easy',
    ratingAvg: null,
    ratingCount: 0,
    completionsCount: 0,
    viewsCount: 0,
    isCompletedByMe: false,
    firstCompleter: null,
    contentLocale: 'ru',
    availableLocales: ALL_LOCALES,
    ...extra,
} as QuestMeta);
const mockQuests = () => [
    quest('served', { servedLocales: ALL_LOCALES }),
    // Translated, but the server withholds the noindex page.
    quest('noindex', { servedLocales: ['ru'] }),
    // No field (offline copy, older backend): fail-closed.
    quest('nofield', {}),
];
const listed = () => mockContentProps.questsAll.map((item) => item.id);

beforeEach(async () => {
    (Platform as { OS: string }).OS = 'web';
    await AsyncStorage.clear();
});

it('lists, counts and searches only the quests the server serves in the hub locale', async () => {
    await render(<QuestsScreen localeHub="pl" />);
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID));
    await waitFor(() => expect(listed()).toEqual(['served']));
    expect(mockContentProps.catalogTotal).toBe(1);

    await act(() => mockContentProps.onSearchChange('Брест'));
    await waitFor(() => expect(mockContentProps.appliedSearchTerm).toBeTruthy());
    expect(listed()).toEqual(['served']);
});

it('keeps the Russian catalogue unfiltered', async () => {
    await render(<QuestsScreen />);
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID));
    await waitFor(() => expect(listed()).toEqual(['served', 'noindex', 'nofield']));
    expect(mockContentProps.catalogTotal).toBe(3);
});
