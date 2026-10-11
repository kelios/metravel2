/**
 * «Рядом» в каталоге квестов (#2389): запрос позиции живёт отдельным чанком
 * `questCatalogLocation`. Экран обязан одинаково объяснить игроку и отказ в
 * доступе, и сбой самой загрузки чанка, а не молча сбросить выбор.
 */
import { act, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { ComponentProps } from 'react';
import type QuestsContentPanel from '@/screens/tabs/QuestsContentPanel';
import QuestsScreen from '@/screens/tabs/QuestsScreen';
import { ALL_QUESTS_ID, NEARBY_ID } from '@/screens/tabs/QuestsScreen.helpers';
import { STORAGE_SELECTED_CITY } from '@/utils/questCatalogSelection';
import type { QuestMeta } from '@/utils/questAdapters';

type ContentProps = ComponentProps<typeof QuestsContentPanel>;
let mockContentProps: ContentProps;
const mockRequestLocation = jest.fn();

jest.mock('expo-router', () => ({ useIsFocused: () => true }));
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('@/screens/tabs/questCatalogLocation', () => ({
    requestQuestCatalogLocation: (...args: unknown[]) => mockRequestLocation(...args),
}));
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

const mockQuests: QuestMeta[] = [{
    id: 'minsk-center',
    numericId: 1,
    title: 'minsk-center',
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
    contentLocale: 'ru',
    availableLocales: ['ru'],
}];

const DENIED = 'Геолокация запрещена. Показываем весь каталог, пока доступ не разрешён.';

const askNearby = async () => {
    render(<QuestsScreen />);
    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID));
    await act(async () => { mockContentProps.onShowNearby(); });
};

beforeEach(async () => {
    (Platform as { OS: string }).OS = 'web';
    mockRequestLocation.mockReset();
    await AsyncStorage.clear();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

it('keeps «nearby» with the player position once it is granted', async () => {
    mockRequestLocation.mockResolvedValue({ coords: { lat: 53.91, lng: 27.57 } });

    await askNearby();

    await waitFor(() => expect(mockContentProps.userLoc).toEqual({ lat: 53.91, lng: 27.57 }));
    expect(mockContentProps.selectedCityId).toBe(NEARBY_ID);
    expect(mockContentProps.geoMessage).toBeNull();
    expect(mockContentProps.geoRequesting).toBe(false);
});

it('falls back to the whole catalog with the refusal reason', async () => {
    mockRequestLocation.mockResolvedValue({ failure: DENIED });

    await askNearby();

    await waitFor(() => expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID));
    expect(mockContentProps.geoMessage).toBe(DENIED);
    expect(mockContentProps.geoRequesting).toBe(false);
    expect(await AsyncStorage.getItem(STORAGE_SELECTED_CITY)).toBe(ALL_QUESTS_ID);
});

it('explains a failed location chunk instead of silently resetting «nearby»', async () => {
    mockRequestLocation.mockRejectedValue(new Error('Loading chunk questCatalogLocation failed'));

    await askNearby();

    await waitFor(() => expect(mockContentProps.geoMessage).toBe(
        'Не удалось определить местоположение. Проверьте разрешения браузера и попробуйте ещё раз.',
    ));
    expect(mockContentProps.selectedCityId).toBe(ALL_QUESTS_ID);
    expect(mockContentProps.geoRequesting).toBe(false);
});
