// #1989: страница страны `/quests/country/<slug>` существовала и работала, но
// из приложения на неё было не попасть — заголовок страны в сайдбаре только
// сворачивал список городов. Набор держит разделение двух действий: имя ведёт
// на лендинг, счётчик с шевроном остаётся тумблером.

import { render, fireEvent } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';

import QuestsSidebar from '@/screens/tabs/QuestsSidebar';
import { getStyles } from '@/screens/tabs/QuestsScreen.styles';
import { DESIGN_TOKENS } from '@/constants/designSystem';

// Мок повторяет НЕВЫГОДНУЮ часть контракта настоящего `Link`: свой `onPress`
// он кладёт в `rest` и затирает им навигационный обработчик роутера
// (`BaseExpoRouterLink`: `{...props, ...rest}`), а на дочернем элементе оба
// обработчика складывает `Slot` (`@radix-ui/react-slot`: сначала детский,
// потом слотовый). Мок, который навигирует всегда, проверял бы сам себя.
jest.mock('expo-router', () => {
  const React = require('react') as typeof import('react');
  const push = jest.fn();
  return {
    router: { push },
    Link: (props: {
      children: React.ReactElement;
      href: string;
      onPress?: () => void;
    }) => {
      const { children, href } = props;
      const child = children as React.ReactElement<Record<string, unknown>>;
      const childOnPress = child.props.onPress as (() => void) | undefined;
      return React.cloneElement(child, {
        href,
        onPress: 'onPress' in props
          ? props.onPress
          : () => { childOnPress?.(); push(href); },
      });
    },
  };
});

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

const baseProps = (overrides: Partial<ComponentProps<typeof QuestsSidebar>> = {}) => ({
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
    { code: 'BY', name: 'Беларусь', cities: [city('minsk', 'Минск'), city('brest', 'Брест')], countryLandingHref: '/quests/country/belarus' },
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
  const originalPlatform = Platform.OS;
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  });
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  it('имя страны ведёт на лендинг и НЕ сворачивает группу', () => {
    const props = baseProps();
    const { getByTestId } = render(<QuestsSidebar {...props} />);

    const link = getByTestId('quests-country-link-BY');
    expect(link.props.href).toBe('/quests/country/belarus');
    fireEvent.press(link);

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

  it('у страны без лендинга один тумблер строки с доступным состоянием', () => {
    const props = baseProps();
    const { getByTestId, queryByTestId, getAllByRole, rerender } = render(<QuestsSidebar {...props} />);

    expect(queryByTestId('quests-country-link-EE')).toBeNull();
    const toggle = getByTestId('quests-country-toggle-EE');
    expect(toggle.props.accessibilityState).toEqual({ expanded: true });
    expect(getAllByRole('button', { name: /Эстония/ })).toHaveLength(1);

    fireEvent.press(toggle);
    expect(router.push).not.toHaveBeenCalled();
    expect(props.onToggleCountryGroup).toHaveBeenCalledWith('EE');
    rerender(<QuestsSidebar {...props} collapsedCountryCodes={{ EE: true }} />);
    expect(getByTestId('quests-country-toggle-EE').props.accessibilityState).toEqual({ expanded: false });
  });

  it('ссылка объявлена ссылкой для вспомогательных технологий', () => {
    const { getByTestId } = render(<QuestsSidebar {...baseProps()} />);
    const link = getByTestId('quests-country-link-BY');
    expect(link.props.accessibilityRole).toBe('link');
    expect(link.props.accessibilityLabel).toContain('Беларусь');
  });

  it.each(['ios', 'android'] as const)('на %s имя страны сохраняет сворачивание каталога', (platform) => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
    const props = baseProps();
    const { getByText, getByTestId, queryByTestId, getAllByRole } = render(<QuestsSidebar {...props} />);

    expect(queryByTestId('quests-country-link-BY')).toBeNull();
    expect(getAllByRole('button', { name: /Беларусь/ })).toHaveLength(1);
    expect(getByTestId('quests-country-toggle-BY').props.accessibilityState).toEqual({ expanded: true });
    fireEvent.press(getByText('Беларусь'));
    expect(props.onToggleCountryGroup).toHaveBeenCalledWith('BY');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('ссылка закрывает мобильный drawer, тумблер оставляет его открытым', () => {
    const onCloseDrawer = jest.fn();
    const { getByTestId } = render(<QuestsSidebar {...baseProps({ onCloseDrawer })} />);

    fireEvent.press(getByTestId('quests-country-toggle-BY'));
    expect(onCloseDrawer).not.toHaveBeenCalled();
    fireEvent.press(getByTestId('quests-country-link-BY'));
    expect(onCloseDrawer).toHaveBeenCalledTimes(1);
    expect(onCloseDrawer.mock.invocationCallOrder[0]).toBeLessThan((router.push as jest.Mock).mock.invocationCallOrder[0]);
  });

  it.each([390, 1440])('зоны ссылки и тумблера имеют минимум 44×44 при ширине %s', (width) => {
    const { getByTestId } = render(<QuestsSidebar {...baseProps({ styles: getStyles(colors, width) })} />);
    for (const action of ['link', 'toggle']) {
      const style = StyleSheet.flatten(getByTestId(`quests-country-${action}-BY`).props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
      expect(style.minWidth).toBeGreaterThanOrEqual(44);
    }
  });
});
