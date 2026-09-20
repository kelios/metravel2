import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { ComponentProps } from 'react';
import type QuestsContentPanel from '@/screens/tabs/QuestsContentPanel';
import QuestsScreen from '@/screens/tabs/QuestsScreen';
import { buildQuestCityCatalog } from '@/screens/tabs/QuestsScreen.helpers';
import type { QuestMeta } from '@/utils/questAdapters';

let mockQuests: QuestMeta[] = [];
let mockMobile = false;

jest.mock('expo-router', () => {
  const React = require('react') as typeof import('react');
  return {
    useIsFocused: () => true,
    Link: ({ children, href, onPress }: {
      children: React.ReactElement;
      href: string;
      onPress?: () => void;
    }) => React.cloneElement(children as React.ReactElement<Record<string, unknown>>, { href, onPress }),
  };
});
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
  useBreakpoints: () => ({ isMobile: mockMobile, width: mockMobile ? 390 : 1280 }),
}));
jest.mock('@/screens/tabs/QuestsContentPanel', () => (props: ComponentProps<typeof QuestsContentPanel>) => {
  const { Pressable } = require('react-native') as typeof import('react-native');
  return <Pressable testID="open-filters" onPress={props.onOpenFilterDrawer} />;
});

const quest = (id: string, cityId: string, cityName: string): QuestMeta => ({
  id, cityId, cityName,
  title: id,
  countryCode: 'BY',
  points: 3,
  durationMin: 60,
  difficulty: 'easy',
});

describe('country landing eligibility in the catalog sidebar', () => {
  const originalPlatform = Platform.OS;
  beforeEach(async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    mockMobile = false;
    await AsyncStorage.clear();
  });
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  it('does not link two sidebar records that merge into one landing alias', () => {
    mockQuests = [
      quest('slavgorod-center', '1', 'Славгород'),
      quest('slavgorod-blue-spring', '2', 'Голубая криница (Славгородский район)'),
    ];
    expect(buildQuestCityCatalog(mockQuests).cities).toHaveLength(2);
    const { queryByTestId, getByTestId } = render(<QuestsScreen />);
    expect(queryByTestId('quests-country-link-BY')).toBeNull();
    expect(getByTestId('quests-country-toggle-BY').props.accessibilityRole).toBe('button');
  });

  it('links a country with two landing aliases even when its sidebar records merge', () => {
    mockQuests = [quest('gomel-center', '19', 'Гомель'), quest('homel-park', '92', 'Гомель')];
    expect(buildQuestCityCatalog(mockQuests).cities).toHaveLength(1);
    const { getByTestId } = render(<QuestsScreen />);
    expect(getByTestId('quests-country-link-BY').props.href).toBe('/quests/country/belarus');
  });

  it('closes the mobile drawer and releases its scroll lock when a country link activates', async () => {
    mockMobile = true;
    mockQuests = [quest('minsk-center', '4', 'Минск'), quest('brest-fortress', '5', 'Брест')];
    const previousOverflow = document.body.style.overflow;
    const { getByTestId, queryByTestId } = render(<QuestsScreen />);
    fireEvent.press(getByTestId('open-filters'));
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.press(getByTestId('quests-country-link-BY'));
    await waitFor(() => expect(queryByTestId('quests-country-link-BY')).toBeNull());
    expect(document.body.style.overflow).toBe(previousOverflow);
  });
});
