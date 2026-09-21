// Строка страны в сайдбаре каталога — только тумблер раскрытия её городов, а обзор всей страны —
// первым пунктом раскрытого списка (`openspec/specs/quest-catalog-sidebar/spec.md`). До этого
// (#1989) имя страны вело на отдельный экран `/quests/country/<slug>`, а счётчик с шевроном
// сворачивал список — одна строка делала два разных действия.

import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';

import QuestsSidebar from '@/screens/tabs/QuestsSidebar';
import { getStyles } from '@/screens/tabs/QuestsScreen.styles';
import { DESIGN_TOKENS } from '@/constants/designSystem';

// Сайдбар больше не ведёт на другой экран: если навигация вернётся, эти проверки её увидят.
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const colors = {
  primary: '#f5842c',
  brand: '#f5842c',
  brandDark: '#c25e10',
  brandText: '#a95000',
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

const baseProps = (overrides: Partial<ComponentProps<typeof QuestsSidebar>> = {}) => ({
  styles: getStyles(colors, 1440),
  colors,
  viewMode: 'list' as const,
  selectedCityId: null,
  activeCountryCode: null,
  nearbyRequesting: false,
  nearbyId: 'nearby',
  kidsFilterId: 'kids',
  bikeFilterId: 'bike',
  areAllCountryGroupsCollapsed: false,
  collapsedCountryCodes: { BY: false, EE: false, OTHER: false },
  citiesByCountry: [
    { code: 'BY', name: 'Беларусь', cities: [city('brest', 'Брест'), city('minsk', 'Минск')] },
    { code: 'EE', name: 'Эстония', cities: [city('tallinn', 'Таллин')] },
    { code: 'OTHER', name: '', cities: [city('x1', 'Без страны 1'), city('x2', 'Без страны 2')] },
  ],
  cityQuestCountById: { minsk: 7, brest: 5, tallinn: 3, x1: 1, x2: 1 },
  spacingMd: DESIGN_TOKENS.spacing.md,
  onSelectCity: jest.fn(),
  onSetViewMode: jest.fn(),
  onToggleCountryGroup: jest.fn(),
  onToggleAllCountryGroups: jest.fn(),
  ...overrides,
});

describe('страна в сайдбаре каталога', () => {
  beforeEach(() => jest.clearAllMocks());

  it('нажатие по имени страны раскрывает её и никуда не ведёт', () => {
    const props = baseProps({ collapsedCountryCodes: { BY: true, EE: true, OTHER: true } });
    const { getByText, queryByTestId } = render(<QuestsSidebar {...props} />);

    fireEvent.press(getByText('Беларусь'));

    expect(props.onToggleCountryGroup).toHaveBeenCalledWith('BY');
    expect(props.onSelectCity).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
    expect(queryByTestId('quests-country-link-BY')).toBeNull();
  });

  it('состояние раскрытия объявлено скринридеру и в ARIA', () => {
    const props = baseProps({ collapsedCountryCodes: { BY: true, EE: false, OTHER: false } });
    const { getByTestId } = render(<QuestsSidebar {...props} />);

    const collapsed = getByTestId('quests-country-toggle-BY');
    expect(collapsed.props['aria-expanded']).toBe(false);
    expect(collapsed.props.accessibilityState).toEqual({ expanded: false });
    const expanded = getByTestId('quests-country-toggle-EE');
    expect(expanded.props['aria-expanded']).toBe(true);
    expect(expanded.props.accessibilityRole).toBe('button');
  });

  it('у страны с несколькими городами первым пунктом идёт «Все квесты страны»', () => {
    const props = baseProps();
    const { getByTestId, getAllByRole } = render(<QuestsSidebar {...props} />);

    const allCountry = getByTestId('quests-country-all-BY');
    expect(allCountry.props.accessibilityLabel).toBe('Все квесты страны Беларусь — 12 квестов');
    expect(allCountry.props['aria-pressed']).toBe(false);

    const byButtons = getAllByRole('button').map((button) => button.props.testID ?? button.props.accessibilityLabel);
    const allIndex = byButtons.indexOf('quests-country-all-BY');
    expect(byButtons[allIndex + 1]).toBe('Брест, 5 квестов');

    fireEvent.press(allCountry);
    expect(props.onSelectCity).toHaveBeenCalledWith('__country__:BY');
    expect(props.onToggleCountryGroup).not.toHaveBeenCalled();
  });

  it('у страны с одним городом и у группы без страны пункта «вся страна» нет', () => {
    const { queryByTestId } = render(<QuestsSidebar {...baseProps()} />);
    expect(queryByTestId('quests-country-all-EE')).toBeNull();
    expect(queryByTestId('quests-country-all-OTHER')).toBeNull();
  });

  it('свёрнутая страна прячет свои пункты', () => {
    const props = baseProps({ collapsedCountryCodes: { BY: true, EE: false, OTHER: false } });
    const { queryByTestId, queryByText } = render(<QuestsSidebar {...props} />);
    expect(queryByTestId('quests-country-all-BY')).toBeNull();
    expect(queryByText('Минск')).toBeNull();
  });

  it('выбранная страна отмечена как нажатая', () => {
    const { getByTestId } = render(<QuestsSidebar {...baseProps({ selectedCityId: '__country__:BY' })} />);
    expect(getByTestId('quests-country-all-BY').props['aria-pressed']).toBe(true);
  });

  // Маркер идёт от `activeCountryCode` экрана — того же вывода, что раскрывает страну выбора.
  it.each([
    ['город', 'minsk'],
    ['вся страна', '__country__:BY'],
  ])('свёрнутая страна с выбором внутри (%s) показывает маркер', (_label, selectedCityId) => {
    const props = baseProps({
      selectedCityId,
      activeCountryCode: 'BY',
      collapsedCountryCodes: { BY: true, EE: true, OTHER: true },
    });
    const { getByTestId, getByText, queryByTestId } = render(<QuestsSidebar {...props} />);

    expect(getByTestId('quests-country-active-BY')).toBeTruthy();
    expect(getByTestId('quests-country-toggle-BY').props.accessibilityLabel).toMatch(/, выбрано$/);
    expect(queryByTestId('quests-country-active-EE')).toBeNull();
    // Оранжевый текст на светлой поверхности — `brandText` (`docs/DESIGN_SYSTEM.md`), не `brandDark`.
    expect(StyleSheet.flatten(getByText('Беларусь').props.style).color).toBe('#a95000');
  });

  it('у раскрытой страны маркера нет — выбор виден в самом списке', () => {
    const { queryByTestId } = render(<QuestsSidebar {...baseProps({ selectedCityId: 'minsk', activeCountryCode: 'BY' })} />);
    expect(queryByTestId('quests-country-active-BY')).toBeNull();
  });

  it('раскрытие страны не закрывает мобильный drawer', () => {
    const onCloseDrawer = jest.fn();
    const { getByTestId } = render(<QuestsSidebar {...baseProps({ onCloseDrawer })} />);
    fireEvent.press(getByTestId('quests-country-toggle-BY'));
    expect(onCloseDrawer).not.toHaveBeenCalled();
  });

  it.each([390, 1440])('строка страны — зона нажатия не меньше 44 px при ширине %s', (width) => {
    const { getByTestId } = render(<QuestsSidebar {...baseProps({ styles: getStyles(colors, width) })} />);
    const style = StyleSheet.flatten(getByTestId('quests-country-toggle-BY').props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
  });
});
