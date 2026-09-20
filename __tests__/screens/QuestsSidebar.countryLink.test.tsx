// #1989: страница страны `/quests/country/<slug>` существовала и работала, но
// из приложения на неё было не попасть — заголовок страны в сайдбаре только
// сворачивал список городов. Набор держит разделение двух действий: имя ведёт
// на лендинг, счётчик с шевроном остаётся тумблером.

import { render, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import QuestsSidebar from '@/screens/tabs/QuestsSidebar';
import { getStyles } from '@/screens/tabs/QuestsScreen.styles';
import { DESIGN_TOKENS } from '@/constants/designSystem';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const colors = {
  primary: '#f5842c',
  textOnPrimary: '#fff',
  textMuted: '#888',
  text: '#111',
  textSubtle: '#555',
  background: '#fff',
  backgroundSecondary: '#eee',
  backgroundTertiary: '#ddd',
  border: '#ccc',
  textOnDark: '#fff',
} as never;

const city = (id: string, name: string) => ({ id, name });

const baseProps = (overrides: Record<string, unknown> = {}) => ({
  styles: getStyles(colors, 1440),
  colors,
  viewMode: 'list' as const,
  selectedCityId: null,
  nearbyRequesting: false,
  nearbyId: 'nearby',
  kidsFilterId: 'kids',
  bikeFilterId: 'bike',
  areAllCountryGroupsCollapsed: false,
  collapsedCountryCodes: {},
  citiesByCountry: [
    { code: 'BY', name: 'Беларусь', cities: [city('minsk', 'Минск'), city('brest', 'Брест')] },
    // Одна страна с единственным городом: лендинга у неё нет
    // (`QUEST_COUNTRY_LANDING_MIN_CITIES = 2`), значит и ссылки быть не должно.
    { code: 'EE', name: 'Эстония', cities: [city('tallinn', 'Таллин')] },
  ],
  cityQuestCountById: { minsk: 7, brest: 5, tallinn: 3 },
  spacingMd: DESIGN_TOKENS.spacing.md,
  onSelectCity: jest.fn(),
  onSetViewMode: jest.fn(),
  onToggleCountryGroup: jest.fn(),
  onToggleAllCountryGroups: jest.fn(),
  ...overrides,
});

describe('вход на страницу страны из сайдбара каталога', () => {
  beforeEach(() => jest.clearAllMocks());

  it('имя страны ведёт на лендинг и НЕ сворачивает группу', () => {
    const props = baseProps();
    const { getByTestId } = render(<QuestsSidebar {...props} />);

    fireEvent.press(getByTestId('quests-country-link-BY'));

    expect(router.push).toHaveBeenCalledWith('/quests/country/belarus');
    expect(props.onToggleCountryGroup).not.toHaveBeenCalled();
  });

  it('счётчик с шевроном сворачивает группу и НЕ уводит со страницы', () => {
    const props = baseProps();
    const { getByTestId } = render(<QuestsSidebar {...props} />);

    fireEvent.press(getByTestId('quests-country-toggle-BY'));

    expect(props.onToggleCountryGroup).toHaveBeenCalledWith('BY');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('у страны без лендинга имя остаётся тумблером, а не битой ссылкой', () => {
    const props = baseProps();
    const { getByTestId } = render(<QuestsSidebar {...props} />);

    const link = getByTestId('quests-country-link-EE');
    expect(link.props.accessibilityRole).toBe('button');

    fireEvent.press(link);
    expect(router.push).not.toHaveBeenCalled();
    expect(props.onToggleCountryGroup).toHaveBeenCalledWith('EE');
  });

  it('ссылка объявлена ссылкой для вспомогательных технологий', () => {
    const { getByTestId } = render(<QuestsSidebar {...baseProps()} />);
    const link = getByTestId('quests-country-link-BY');
    expect(link.props.accessibilityRole).toBe('link');
    expect(link.props.accessibilityLabel).toContain('Беларусь');
  });
});
