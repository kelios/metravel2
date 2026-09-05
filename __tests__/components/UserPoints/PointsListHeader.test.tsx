// __tests__/components/UserPoints/PointsListHeader.test.tsx
// #1414 (TestFlight 1.0.5 (8), iPhone 16 Pro): «Внизу кнопки ничего не делают
// непонятно как фильтровать нужно улучшить ui ux».
//
// Механизм промаха: подпись действия гасилась пропом `isMobile`, а он в
// `PointsList.tsx:81` равен `Platform.OS !== 'web'`, а не ширине вьюпорта.
// Из-за этого mobile web показывал подписанные кнопки, а Android и iPhone —
// одинаковые кружки settings/filter/sliders. Тест держит контракт mobile
// parity: доступные действия подписаны; недоступные настройки скрыты (#1787).

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

const renderHeader = (overrides: Record<string, unknown> = {}) =>
  render(
    <PointsListHeader
      styles={{}}
      colors={{ text: '#111', textMuted: '#666', textOnPrimary: '#fff' }}
      isNarrow
      // На native `PointsList` передаёт именно это значение.
      isMobile
      total={2656}
      found={869}
      hasActiveFilters={false}
      onResetFilters={noop}
      activeFilterChips={[]}
      onRemoveFilterChip={noop}
      viewMode="list"
      onViewModeChange={noop}
      hideViewToggle
      showFilters={false}
      onToggleFilters={noop}
      canShowMapSettings={false}
      showMapSettings={false}
      onToggleMapSettings={noop}
      showingRecommendations={false}
      onOpenActions={noop}
      onOpenRecommendations={noop}
      searchQuery=""
      onSearch={noop}
      filters={{} as never}
      onFilterChange={noop}
      siteCategoryOptions={[]}
      {...(overrides as never)}
    />,
  )

describe('PointsListHeader — actions row', () => {
  it('names every available action with visible text on a phone', () => {
    const { getByText, queryByTestId } = renderHeader()

    expect(getByText('Управление точками')).toBeTruthy()
    expect(getByText('Показать фильтры')).toBeTruthy()
    expect(queryByTestId('userpoints-map-settings-toggle')).toBeNull()
  })

  it('shows a labelled settings action when the map supports it', () => {
    const { getByText } = renderHeader({ canShowMapSettings: true })
    expect(getByText('Показать настройки карты')).toBeTruthy()
  })

  it('keeps the visible caption in sync with the toggled state', () => {
    const { getByText } = renderHeader({ canShowMapSettings: true, showFilters: true, showMapSettings: true })

    expect(getByText('Скрыть фильтры')).toBeTruthy()
    expect(getByText('Скрыть настройки карты')).toBeTruthy()
  })

  it('fires each action handler', () => {
    const onOpenActions = jest.fn()
    const onToggleFilters = jest.fn()
    const onToggleMapSettings = jest.fn()
    const { getByTestId } = renderHeader({
      canShowMapSettings: true,
      onOpenActions,
      onToggleFilters,
      onToggleMapSettings,
    })

    fireEvent.press(getByTestId('userpoints-actions-open'))
    fireEvent.press(getByTestId('userpoints-filters-toggle'))
    fireEvent.press(getByTestId('userpoints-map-settings-toggle'))

    expect(onOpenActions).toHaveBeenCalledTimes(1)
    expect(onToggleFilters).toHaveBeenCalledTimes(1)
    expect(onToggleMapSettings).toHaveBeenCalledTimes(1)
  })

  it('gives each action row the full width and the 44dp touch floor', () => {
    const { getByTestId } = renderHeader()

    for (const testID of [
      'userpoints-actions-open',
      'userpoints-filters-toggle',
    ]) {
      const style = StyleSheet.flatten(getByTestId(testID).props.style)
      expect(style).toMatchObject({ width: '100%', minHeight: 44 })
    }
  })
})
