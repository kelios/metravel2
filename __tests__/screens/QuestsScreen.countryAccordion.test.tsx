// Каталог квестов с выбором всей страны на месте (`openspec/specs/quest-catalog-sidebar/spec.md`):
// страна не уводит на лендинг, «Все квесты страны» фильтрует сетку, выбор сохраняется и
// восстанавливается, страны свёрнуты при входе, а в мобильном drawer выбор его закрывает.
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { ComponentProps, ReactElement } from 'react';
import type QuestsContentPanel from '@/screens/tabs/QuestsContentPanel';
import type QuestsMapSection from '@/screens/tabs/QuestsMapSection';
import QuestsScreen from '@/screens/tabs/QuestsScreen';
import { ALL_QUESTS_ID, STORAGE_SELECTED_CITY } from '@/utils/questCatalogSelection';
import type { QuestMeta } from '@/utils/questAdapters';

let mockQuests: QuestMeta[] = [];
let mockMobile = false;
let mockPanelProps: ComponentProps<typeof QuestsContentPanel> | null = null;
let mockMapProps: { coordinates?: { latitude: number; longitude: number } } | null = null;

jest.mock('expo-router', () => ({ useIsFocused: () => true, useRouter: () => ({ push: () => {} }) }));
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('@/components/MapPage/Map', () => (props: typeof mockMapProps) => {
  mockMapProps = props;
  return null;
});
jest.mock('@/screens/tabs/questCatalogLocation', () => ({ requestQuestCatalogLocation: async () => null }));
jest.mock('@/components/seo/LazyInstantSEO', () => () => null);
jest.mock('@/hooks/useQuestReturnVisit', () => ({ useQuestReturnVisit: () => {} }));
jest.mock('@/hooks/useQuestReviewPrompt', () => ({
  useQuestReviewPrompt: () => ({ prompt: null, dismiss: () => {} }),
}));
jest.mock('@/hooks/useQuestsApi', () => ({
  useQuestsList: () => ({ quests: mockQuests, loading: false, error: null }),
}));
jest.mock('@/hooks/useResponsive', () => ({
  useBreakpoints: () => ({ isMobile: mockMobile, width: mockMobile ? 390 : 1280 }),
}));
jest.mock('@/screens/tabs/QuestsContentPanel', () => (props: ComponentProps<typeof QuestsContentPanel>) => {
  const { Pressable, Text } = require('react-native') as typeof import('react-native');
  const { Suspense } = require('react') as typeof import('react');
  mockPanelProps = props;
  return (
    <>
      {props.mapSlot ? <Suspense fallback={null}>{props.mapSlot}</Suspense> : null}
      <Pressable testID="open-filters" onPress={props.onOpenFilterDrawer} />
      <Text testID="panel-title">{props.selectedCityName ?? ''}</Text>
      <Text testID="panel-quests">{props.questsAll.map((quest) => quest.id).sort().join(',')}</Text>
    </>
  );
});

const quest = (id: string, cityId: string, cityName: string, countryCode = 'BY', lat?: number, lng?: number): QuestMeta => ({
  id, cityId, cityName, countryCode, lat, lng,
  title: id,
  points: 3,
  durationMin: 60,
  difficulty: 'easy',
});

const CATALOG = [
  quest('minsk-center', '4', 'Минск', 'BY', 53.9, 27.56),
  quest('brest-fortress', '5', 'Брест', 'BY', 52.1, 23.7),
  quest('krakow-old-town', '9', 'Краков', 'PL', 50.06, 19.94),
];

describe('страна в каталоге квестов', () => {
  const originalPlatform = Platform.OS;
  beforeEach(async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    mockMobile = false;
    mockQuests = CATALOG;
    mockMapProps = null;
    await AsyncStorage.clear();
  });
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  it('страны свёрнуты при входе, ссылки на лендинг страны нет', async () => {
    const { getByTestId, queryByTestId, queryByText } = render(<QuestsScreen />);
    await waitFor(() => expect(getByTestId('quests-country-toggle-BY').props['aria-expanded']).toBe(false));
    expect(queryByTestId('quests-country-link-BY')).toBeNull();
    expect(queryByText('Минск')).toBeNull();
  });

  it('«Все квесты страны» фильтрует сетку на месте и сохраняет выбор', async () => {
    const { getByTestId } = render(<QuestsScreen />);
    fireEvent.press(getByTestId('quests-country-toggle-BY'));
    fireEvent.press(getByTestId('quests-country-all-BY'));

    await waitFor(() => expect(getByTestId('panel-title').props.children).toBe('Беларусь'));
    expect(getByTestId('panel-quests').props.children).toBe('brest-fortress,minsk-center');
    await waitFor(async () => expect(await AsyncStorage.getItem(STORAGE_SELECTED_CITY)).toBe('__country__:BY'));
  });

  it('сохранённая страна восстанавливается, и её строка раскрыта', async () => {
    await AsyncStorage.setItem(STORAGE_SELECTED_CITY, '__country__:BY');
    const { getByTestId } = render(<QuestsScreen />);

    await waitFor(() => expect(getByTestId('panel-title').props.children).toBe('Беларусь'));
    expect(getByTestId('quests-country-toggle-BY').props['aria-expanded']).toBe(true);
    expect(getByTestId('quests-country-all-BY').props['aria-pressed']).toBe(true);
    expect(getByTestId('quests-country-toggle-PL').props['aria-expanded']).toBe(false);
  });

  it('несуществующая сохранённая страна сбрасывается на все квесты', async () => {
    await AsyncStorage.setItem(STORAGE_SELECTED_CITY, '__country__:FR');
    const { getByTestId } = render(<QuestsScreen />);

    // Экран и так стартует с «Все квесты», поэтому вид сетки сброса не доказывает: он совпал бы
    // и без восстановления. Доказательство — эффект валидности перезаписал сохранённый выбор.
    await waitFor(async () => expect(await AsyncStorage.getItem(STORAGE_SELECTED_CITY)).toBe(ALL_QUESTS_ID));
    expect(getByTestId('panel-quests').props.children).toBe('brest-fortress,krakow-old-town,minsk-center');
    expect(getByTestId('panel-title').props.children).toBe('');
  });

  it('карта при выбранной стране центрируется по её квестам, а не по игроку', async () => {
    const { getByTestId } = render(<QuestsScreen />);
    fireEvent.press(getByTestId('quests-country-toggle-BY'));
    fireEvent.press(getByTestId('quests-country-all-BY'));
    await waitFor(() => expect(getByTestId('panel-title').props.children).toBe('Беларусь'));

    act(() => mockPanelProps?.onToggleViewMode());
    await waitFor(() => expect(mockMapProps).not.toBeNull());

    // Игрок далеко от страны: центр по нему увёл бы карту от квестов страны.
    const mapSection = mockPanelProps?.mapSlot as ReactElement<ComponentProps<typeof QuestsMapSection>>;
    act(() => mapSection.props.onUserLocationChange({ latitude: 41.72, longitude: 44.79 }));

    await waitFor(() => expect(mockMapProps?.coordinates?.latitude).toBeCloseTo(53, 1));
    expect(mockMapProps?.coordinates?.longitude).toBeCloseTo(25.63, 1);
  });

  it('в мобильном drawer раскрытие страны его не закрывает, а выбор страны закрывает', async () => {
    mockMobile = true;
    const previousOverflow = document.body.style.overflow;
    const { getByTestId, queryByTestId } = render(<QuestsScreen />);
    fireEvent.press(getByTestId('open-filters'));
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.press(getByTestId('quests-country-toggle-BY'));
    expect(document.body.style.overflow).toBe('hidden');
    expect(getByTestId('quests-country-all-BY')).toBeTruthy();

    fireEvent.press(getByTestId('quests-country-all-BY'));
    await waitFor(() => expect(queryByTestId('quests-country-toggle-BY')).toBeNull());
    expect(document.body.style.overflow).toBe(previousOverflow);
  });
});
