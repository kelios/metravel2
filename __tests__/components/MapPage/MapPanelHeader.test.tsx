import React from 'react'
import { Platform } from 'react-native'
import Feather from '@expo/vector-icons/Feather'
import { fireEvent, render } from '@testing-library/react-native'

import MapPanelHeader from '@/components/MapPage/MapPanelHeader'
import { getOnboardingSteps } from '@/components/MapPage/MapOnboarding'
import {
  MAP_PANEL_TAB_COUNT,
  MAP_PANEL_TAB_LABEL_MAX_CHARS,
  MAP_PANEL_TAB_MAX_FONT_SCALE,
  getStyles,
} from '@/screens/tabs/map.styles'
import { formatInteger } from '@/i18n/format'
import { resources } from '@/i18n/resources'
import { translate as i18nT } from '@/i18n'
import { getTabRoles } from '@/utils/a11yTabRoles'

// #2217 — the desktop-branch panel header (web, iPad, Android tablet): the row
// belongs to the tabs only. Norms: docs/design/map-panel-header-tablet.md.

const themedColors: any = {
  background: '#ffffff',
  backgroundSecondary: '#f7f7f7',
  surface: '#ffffff',
  surfaceMuted: '#f5f5f5',
  surfaceAlpha40: 'rgba(255,255,255,0.25)',
  border: '#e5e5e5',
  borderLight: '#eeeeee',
  overlay: 'rgba(0,0,0,0.35)',
  overlayLight: 'rgba(0,0,0,0.1)',
  primary: '#7a9d8f',
  primaryAlpha30: 'rgba(122,157,143,0.3)',
  primaryLight: '#f0f5f3',
  text: '#111111',
  textMuted: '#666666',
  // Distinct on purpose: the selected icon follows the label (textOnPrimary),
  // the white textInverse vanished on the light segment.
  textInverse: '#ffffff',
  textOnPrimary: '#111827',
  shadows: {
    light: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
    medium: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
    heavy: { shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  },
  boxShadows: { card: '0 1px 2px rgba(0,0,0,0.1)', medium: '0 6px 16px rgba(0,0,0,0.12)' },
}

type PanelTab = 'search' | 'route' | 'travels'

// The order of the collapsed 56 strip.
const TAB_IDS = ['map-panel-tab-travels', 'map-panel-tab-route', 'map-panel-tab-filters']
const PLACES = () => i18nT('map:components.MapPage.MapPanelHeader.mesta_3ad2b948')
const ROUTE = () => i18nT('map:components.MapPage.MapPanelHeader.marshrut_486762dc')
const FILTERS = () => i18nT('map:components.MapPage.MapPanelHeader.filtry_95c57b1d')

// `accessibilityState.selected`, not the `selected` query option: the jest
// Pressable mock (`__tests__/setup.ts`) mirrors it into a string `aria-selected`.
const selectedTabIds = (tabs: any[]) =>
  tabs.filter((tab) => tab.props.accessibilityState?.selected === true).map((tab) => tab.props.testID)

const renderHeader = (activeTab: PanelTab, travelsCount = 1234) => {
  const handlers = {
    selectSearchTab: jest.fn(),
    selectRouteTab: jest.fn(),
    selectTravelsTab: jest.fn(),
  }
  const utils = render(
    <MapPanelHeader
      activeTab={activeTab}
      travelsCount={travelsCount}
      themedColors={themedColors}
      styles={getStyles(false, 0, themedColors)}
      {...handlers}
    />,
  )
  return { ...utils, ...handlers }
}

// #2262: roles come from utils/a11yTabRoles — `tab`/`tablist` on web and
// Android, `button` + selected / `tabbar` on iOS (no trait for `tab` there).
describe.each(['web', 'ios', 'android'])('MapPanelHeader on %s (#2217)', (os) => {
  const originalOS = Platform.OS
  let tabRole = 'tab'
  let tablistRole = 'tablist'

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: os })
    ;({ tab: tabRole, tablist: tablistRole } = getTabRoles())
  })

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS })
  })

  it('the row holds one tablist of exactly three tabs, in the order of the strip', () => {
    const utils = renderHeader('search')

    expect(tabRole).toBe(os === 'ios' ? 'button' : 'tab')
    expect(utils.getAllByRole(tabRole).map((tab) => tab.props.testID)).toEqual(TAB_IDS)
    expect(TAB_IDS).toHaveLength(MAP_PANEL_TAB_COUNT)

    // tabsContainer → tabsRow → the segment is the row's only child.
    const container = utils.toJSON() as any
    expect(container.children).toHaveLength(1)
    const row = container.children[0]
    expect(row.children).toHaveLength(1)
    expect(tablistRole).toBe(os === 'ios' ? 'tabbar' : 'tablist')
    expect(row.children[0].props.accessibilityRole).toBe(tablistRole)
    expect(row.children[0].children).toHaveLength(MAP_PANEL_TAB_COUNT)
  })

  it('carries no header actions: «Подсказки» live on the map, «Сбросить» in the filters footer', () => {
    const utils = renderHeader('search')

    for (const testID of ['map-filters-button', 'map-help-button', 'map-reset-filters-button']) {
      expect(utils.queryByTestId(testID)).toBeNull()
    }
    // On iOS the tabs themselves are buttons (#2262): count only non-tab buttons.
    expect(
      utils.queryAllByRole('button').filter((node) => !TAB_IDS.includes(node.props.testID)),
    ).toHaveLength(0)
  })

  it.each([
    ['search', 'map-panel-tab-filters'],
    ['route', 'map-panel-tab-route'],
    ['travels', 'map-panel-tab-travels'],
  ] as const)('activeTab «%s» selects exactly %s', (activeTab, testID) => {
    const utils = renderHeader(activeTab)

    expect(selectedTabIds(utils.getAllByRole(tabRole))).toEqual([testID])
  })

  it('each tab switches its own view', () => {
    const utils = renderHeader('search')

    fireEvent.press(utils.getByTestId('map-panel-tab-travels'))
    fireEvent.press(utils.getByTestId('map-panel-tab-route'))
    fireEvent.press(utils.getByTestId('map-panel-tab-filters'))

    expect(utils.selectTravelsTab).toHaveBeenCalledTimes(1)
    expect(utils.selectRouteTab).toHaveBeenCalledTimes(1)
    expect(utils.selectSearchTab).toHaveBeenCalledTimes(1)
  })

  // WCAG 2.5.3 Label in Name: the accessible name starts with the visible label.
  it('names start with the visible label; «Места» carries the full count, the badge caps it', () => {
    const utils = renderHeader('search', 1234)

    expect(utils.getByRole(tabRole, { name: `${PLACES()} (${formatInteger(1234)})` }).props.testID).toBe(
      'map-panel-tab-travels',
    )
    expect(utils.getByRole(tabRole, { name: ROUTE() }).props.testID).toBe('map-panel-tab-route')
    expect(utils.getByRole(tabRole, { name: FILTERS() }).props.testID).toBe('map-panel-tab-filters')
    expect(utils.getByText('999+')).toBeTruthy()
  })

  it('no count yet: no badge, the name is the label', () => {
    const utils = renderHeader('search', 0)

    expect(utils.getByRole(tabRole, { name: PLACES() }).props.testID).toBe('map-panel-tab-travels')
    expect(utils.queryByText('0')).toBeNull()
  })

  it('labels and the badge stay on one line and cap the font scale', () => {
    const utils = renderHeader('travels', 1234)

    for (const text of [PLACES(), ROUTE(), FILTERS(), '999+']) {
      const node = utils.getByText(text)
      expect(node.props.numberOfLines).toBe(1)
      expect(node.props.maxFontSizeMultiplier).toBe(MAP_PANEL_TAB_MAX_FONT_SCALE)
    }
  })

  it('the selected icon takes the label colour (textOnPrimary), the others stay muted', () => {
    const utils = renderHeader('travels')

    expect(
      utils.UNSAFE_getAllByType(Feather).map((icon) => [icon.props.name, icon.props.color]),
    ).toEqual([
      ['list', themedColors.textOnPrimary],
      ['navigation', themedColors.textMuted],
      ['sliders', themedColors.textMuted],
    ])
  })

  // #2172: on native a hitSlop wider than the 2 pt gap reached into the
  // neighbour's box; the tab's own 44 box is the target.
  it('tabs carry no hitSlop', () => {
    const utils = renderHeader('search')

    for (const testID of TAB_IDS) {
      expect(utils.getByTestId(testID).props.hitSlop).toBeUndefined()
    }
  })

  // #2263 — iOS-only traits (web and Android ignore them, so neither the site
  // e2e nor an Android pass would notice their loss): at the accessibility sizes
  // a long press shows the capped label in the Large Content Viewer, and
  // «Маршрут» tells what it builds. Tabs by testID: #2262 may change the role.
  it('every tab carries the Large Content Viewer title; «Маршрут» carries its hint', () => {
    const utils = renderHeader('search')
    const labels: Record<string, string> = {
      'map-panel-tab-travels': i18nT('map:components.MapPage.MapPanelHeader.mesta_3ad2b948'),
      'map-panel-tab-route': i18nT('map:components.MapPage.MapPanelHeader.marshrut_486762dc'),
      'map-panel-tab-filters': i18nT('map:components.MapPage.MapPanelHeader.filtry_95c57b1d'),
    }

    for (const testID of TAB_IDS) {
      const tab = utils.getByTestId(testID)
      expect(tab.props.accessibilityShowsLargeContentViewer).toBe(true)
      expect(tab.props.accessibilityLargeContentTitle).toBe(labels[testID])
    }
    expect(utils.getByTestId('map-panel-tab-route').props.accessibilityHint).toBe(
      i18nT('map:components.MapPage.MapPanelHeader.postroenie_marshruta_7aa011b1'),
    )
  })

  // The tour used to point «Стройте маршруты» at `filters-panel-header`, which
  // the desktop branch hides, «Настройте фильтры» at a tab that did not exist and
  // the intro at a `map-panel` nobody rendered: a step whose target is missing
  // shows its card with no highlight. Every target the desktop tour names must
  // be rendered by this header.
  it('the desktop tour points every step with a target at a tab this header renders', () => {
    const utils = renderHeader('search')
    const targets = getOnboardingSteps()
      .map((step) => step.targetTestID)
      .filter((target): target is string => Boolean(target))

    expect(targets).toEqual(['map-panel-tab-filters', 'map-panel-tab-travels', 'map-panel-tab-route'])
    for (const target of targets) {
      expect(utils.getByTestId(target)).toBeTruthy()
    }
  })
})

// The width budget (`__tests__/app/mapLayout.test.ts`) holds for labels up to
// MAP_PANEL_TAB_LABEL_MAX_CHARS; a longer translation would break it in one
// language only, so every locale is checked.
// RN-web 0.21 drops `accessibilityState.selected`: on production the tabs had
// role="tab" and no `aria-selected` (production smoke of #2217, 05.10). The jest
// Pressable mock (`__tests__/setup.ts`) mirrors accessibilityState into
// `aria-selected` and would hide that, so the raw prop is read from the
// component element, not from the mocked host.
describe('MapPanelHeader on web: the tabs carry aria-selected themselves (#2217)', () => {
  const originalOS = Platform.OS

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web' })
  })

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS })
  })

  it.each([
    ['search', 'map-panel-tab-filters'],
    ['route', 'map-panel-tab-route'],
    ['travels', 'map-panel-tab-travels'],
  ] as const)('activeTab «%s»: only %s has aria-selected true', (activeTab, selectedId) => {
    const utils = renderHeader(activeTab)
    const rawAriaSelected = (testID: string) =>
      utils
        .UNSAFE_getAllByProps({ testID })
        .find((node) => typeof node.props['aria-selected'] === 'boolean')?.props['aria-selected']

    for (const testID of ['map-panel-tab-travels', 'map-panel-tab-route', 'map-panel-tab-filters']) {
      expect(rawAriaSelected(testID)).toBe(testID === selectedId)
    }
  })
})

describe('panel tab labels stay short in every language (#2217)', () => {
  const TAB_LABEL_KEYS = ['mesta_3ad2b948', 'marshrut_486762dc', 'filtry_95c57b1d']

  it.each(Object.keys(resources) as (keyof typeof resources)[])('%s', (locale) => {
    const bundle = resources[locale].map as Record<string, string>
    for (const key of TAB_LABEL_KEYS) {
      const label = bundle[`components.MapPage.MapPanelHeader.${key}`]
      expect(typeof label).toBe('string')
      expect([...label].length).toBeLessThanOrEqual(MAP_PANEL_TAB_LABEL_MAX_CHARS)
    }
  })
})
