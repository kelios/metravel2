// __tests__/components/UserPoints/PointsListHeader.test.tsx
// #1414 (TestFlight 1.0.5 (8), iPhone 16 Pro): «Внизу кнопки ничего не делают
// непонятно как фильтровать нужно улучшить ui ux» — действия подписаны на любой
// ширине. #3134: вкладка «Фильтры» содержит сами фильтры (без кнопки
// «Показать фильтры»), промо «Случайный выбор» свёрнуто до действия с одной
// строкой подсказки, второго поля поиска и второго Карта/Список нет.

import React from 'react'
import { Platform, StyleSheet } from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'

import { PointsListHeader } from '@/components/UserPoints/PointsListHeader'

// Платформу пиним точечно, как в `tripRouteExportMenu.test.tsx`: подменять
// модуль `react-native` целиком нельзя — спред `{...RN}` дёргает каждый ленивый
// геттер индекса RN и подтягивает все нативные модули ради одного поля.
const originalOS = Platform.OS
const setPlatformOS = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os })
}

beforeAll(() => setPlatformOS('ios'))
afterAll(() => setPlatformOS(originalOS))

const noop = () => {}

const renderHeader = async (overrides: Record<string, unknown> = {}) =>
  await render(
    <PointsListHeader
      styles={{}}
      colors={{ text: '#111', textMuted: '#666', textOnPrimary: '#fff' }}
      // На native `PointsList` передаёт именно это значение.
      isMobile
      total={2656}
      found={869}
      hasActiveFilters={false}
      onResetFilters={noop}
      activeFilterChips={[]}
      onRemoveFilterChip={noop}
      viewMode="map"
      onViewModeChange={noop}
      hideViewToggle
      canShowMapSettings={false}
      showMapSettings={false}
      onToggleMapSettings={noop}
      showingRecommendations={false}
      onOpenActions={noop}
      onOpenRecommendations={noop}
      filters={{} as never}
      onFilterChange={noop}
      siteCategoryOptions={[]}
      {...(overrides as never)}
    />,
  )

describe('PointsListHeader — вкладка «Фильтры» (#3134)', () => {
  it('names every available action with visible text on a phone', async () => {
    const { getByText, queryByTestId, queryByText } = await renderHeader()

    expect(getByText('Управление точками')).toBeTruthy()
    expect(getByText('Выбрать 3 случайные точки')).toBeTruthy()
    // Кнопки «Показать фильтры» больше нет: фильтры развёрнуты всегда.
    expect(queryByText('Показать фильтры')).toBeNull()
    expect(queryByTestId('userpoints-filters-toggle')).toBeNull()
    expect(queryByTestId('userpoints-map-settings-toggle')).toBeNull()
  })

  it('renders the filters inline and no second search field or view toggle', async () => {
    const { getByTestId, getByText, queryByTestId, queryByText } = await renderHeader()

    expect(getByTestId('userpoints-filters-inline')).toBeTruthy()
    expect(getByText('Радиус')).toBeTruthy()
    expect(queryByTestId('userpoints-header-search')).toBeNull()
    expect(queryByText('Карта')).toBeNull()
    expect(queryByText('Список')).toBeNull()
  })

  it('shows the search field only in the standalone list layout', async () => {
    const { getByTestId } = await renderHeader({ showSearch: true, onSearch: noop, searchQuery: '' })
    expect(getByTestId('userpoints-header-search')).toBeTruthy()
  })

  it('labels the wide-web layout toggle by layout, not as a second Карта/Список', async () => {
    const { getByText } = await renderHeader({ hideViewToggle: false })
    expect(getByText('С картой')).toBeTruthy()
    expect(getByText('Только список')).toBeTruthy()
  })

  it('shows a labelled settings action when the map supports it', async () => {
    const { getByText } = await renderHeader({ canShowMapSettings: true })
    expect(getByText('Показать настройки карты')).toBeTruthy()
  })

  it('keeps the visible caption in sync with the toggled state', async () => {
    const { getByText } = await renderHeader({ canShowMapSettings: true, showMapSettings: true })
    expect(getByText('Скрыть настройки карты')).toBeTruthy()
  })

  it('collapses the recommendation promo to one action with a single hint line', async () => {
    const { getByText, queryByText } = await renderHeader()
    expect(getByText('Не решили, куда поехать? Случайно выберем 3 точки из ваших сохранений и построим к ним маршрут.')).toBeTruthy()
    expect(queryByText('Куда поехать? Выберем за вас')).toBeNull()
    expect(queryByText('Случайные точки откроются в списке справа с готовыми маршрутами.')).toBeNull()
  })

  it('disables the random pick until there are three points', async () => {
    const { getByTestId } = await renderHeader({ total: 2 })
    expect(getByTestId('userpoints-recommendations-open').props.accessibilityState?.disabled).toBe(true)
  })

  it('fires each action handler', async () => {
    const onOpenActions = jest.fn()
    const onToggleMapSettings = jest.fn()
    const onOpenRecommendations = jest.fn()
    const { getByTestId } = await renderHeader({
      canShowMapSettings: true,
      onOpenActions,
      onToggleMapSettings,
      onOpenRecommendations,
    })

    await fireEvent.press(getByTestId('userpoints-actions-open'))
    await fireEvent.press(getByTestId('userpoints-map-settings-toggle'))
    await fireEvent.press(getByTestId('userpoints-recommendations-open'))

    expect(onOpenActions).toHaveBeenCalledTimes(1)
    expect(onToggleMapSettings).toHaveBeenCalledTimes(1)
    expect(onOpenRecommendations).toHaveBeenCalledTimes(1)
  })

  it('shows the active-filters block with reset only when filters are active', async () => {
    const onResetFilters = jest.fn()
    const empty = await renderHeader()
    expect(empty.queryByTestId('userpoints-active-filters')).toBeNull()
    await empty.unmount()

    const active = await renderHeader({
      hasActiveFilters: true,
      activeFilterChips: [{ key: 'color:red', label: 'Красный' }],
      onResetFilters,
    })
    expect(active.getByTestId('userpoints-active-filters')).toBeTruthy()
    await fireEvent.press(active.getByTestId('userpoints-header-reset-filters'))
    expect(onResetFilters).toHaveBeenCalledTimes(1)
  })

  it('gives each action row the full width and the 44dp touch floor', async () => {
    const { getByTestId } = await renderHeader({ canShowMapSettings: true })

    for (const testID of [
      'userpoints-recommendations-open',
      'userpoints-actions-open',
      'userpoints-map-settings-toggle',
    ]) {
      const style = StyleSheet.flatten(getByTestId(testID).props.style)
      expect(style).toMatchObject({ width: '100%', minHeight: 44 })
    }
  })
})
