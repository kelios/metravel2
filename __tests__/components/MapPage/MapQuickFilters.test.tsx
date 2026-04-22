import React from 'react'
import * as RN from 'react-native'
import { fireEvent, render } from '@testing-library/react-native'

import { MapQuickFilters } from '@/components/MapPage/MapQuickFilters'

jest.mock('@/components/MapPage/popovers/MapChipPopover', () => {
  const React = require('react')
  const { View } = require('react-native')

  return {
    MapChipPopover: ({ visible, children, testID }: any) =>
      visible ? React.createElement(View, { testID }, children) : null,
  }
})

describe('MapQuickFilters', () => {
  beforeEach(() => {
    ;(RN.useWindowDimensions as jest.Mock).mockReturnValue({
      width: 360,
      height: 800,
      scale: 1,
      fontScale: 1,
    })
  })

  it('renders radius and categories selectors with current values', () => {
    const { getByText, getByLabelText } = render(
      <MapQuickFilters
        radiusValue="60 км"
        categoriesValue="2 выбрано"
        onPressRadius={jest.fn()}
        onPressCategories={jest.fn()}
      />,
    )

    expect(getByText('Радиус')).toBeTruthy()
    expect(getByText('Что посмотреть')).toBeTruthy()
    expect(getByText('60 км')).toBeTruthy()
    expect(getByText('2 выбрано')).toBeTruthy()
    expect(getByLabelText('Радиус: 60 км')).toBeTruthy()
    expect(getByLabelText('Что посмотреть: 2 выбрано')).toBeTruthy()
  })

  it('uses fallback values when explicit selection is missing', () => {
    const { getAllByText, getByText } = render(
      <MapQuickFilters onPressRadius={jest.fn()} onPressCategories={jest.fn()} />,
    )

    expect(getAllByText('Выбор')).toHaveLength(2)
    expect(getByText('Что посмотреть')).toBeTruthy()
  })

  it('fires both selector callbacks independently', () => {
    const onPressRadius = jest.fn()
    const onPressCategories = jest.fn()

    const { getByLabelText } = render(
      <MapQuickFilters
        radiusValue="Маршрут"
        categoriesValue="Все"
        onPressRadius={onPressRadius}
        onPressCategories={onPressCategories}
      />,
    )

    fireEvent.press(getByLabelText('Радиус: Маршрут'))
    fireEvent.press(getByLabelText('Что посмотреть: Все'))

    expect(onPressRadius).toHaveBeenCalledTimes(1)
    expect(onPressCategories).toHaveBeenCalledTimes(1)
  })

  it('hides a selector when its action is unavailable', () => {
    const { queryByText, getByText } = render(
      <MapQuickFilters radiusValue="60 км" onPressRadius={jest.fn()} />,
    )

    expect(getByText('Радиус')).toBeTruthy()
    expect(queryByText('Что посмотреть')).toBeNull()
  })

  it('keeps the sightseeing quick filter visible when inline categories are available', () => {
    const { getByLabelText, getByText } = render(
      <MapQuickFilters
        radiusValue="60 км"
        categoriesValue="Все"
        radiusOptions={[{ id: '60', name: '60' }]}
        radiusSelected="60"
        onChangeRadius={jest.fn()}
        categoriesOptions={[
          { id: '84', name: 'Замки' },
          { id: '26', name: 'Болота' },
        ]}
        categoriesSelected={[]}
        onChangeCategories={jest.fn()}
        travelsData={[
          { categoryName: 'Замки' },
          { categoryName: 'Замки, Болота' },
        ]}
      />,
    )

    expect(getByText('Что посмотреть')).toBeTruthy()
    expect(getByLabelText('Что посмотреть: Все')).toBeTruthy()
  })

  it('renders compact icon-only controls without text labels', () => {
    const { getByLabelText, queryByText } = render(
      <MapQuickFilters
        iconOnly={true}
        radiusValue="60 км"
        categoriesValue="Все"
        overlaysValue="Выкл"
        onPressRadius={jest.fn()}
        onPressCategories={jest.fn()}
        onPressOverlays={jest.fn()}
      />,
    )

    expect(getByLabelText('Радиус: 60 км')).toBeTruthy()
    expect(getByLabelText('Что посмотреть: Все')).toBeTruthy()
    expect(getByLabelText('Оверлеи: Выкл')).toBeTruthy()
    expect(queryByText('Радиус')).toBeNull()
    expect(queryByText('Что посмотреть')).toBeNull()
  })

  it('renders extra actions inside the radius group on inline layout', () => {
    const onLocate = jest.fn()
    const onZoomIn = jest.fn()

    const { getAllByRole } = render(
      <MapQuickFilters
        extraActions={[
          { key: 'locate', label: 'ÐœÐ¾Ðµ Ð¼ÐµÑÑ‚Ð¾Ð¿Ð¾Ð»Ð¾Ð¶ÐµÐ½Ð¸Ðµ', icon: 'crosshair', onPress: onLocate },
          { key: 'zoom-in', label: 'ÐŸÑ€Ð¸Ð±Ð»Ð¸Ð·Ð¸Ñ‚ÑŒ', icon: 'plus', onPress: onZoomIn },
        ]}
        extraActionsPosition="inside-radius"
        radiusValue="60 ÐºÐ¼"
        categoriesValue="Ð’ÑÐµ"
        onPressRadius={jest.fn()}
        onPressCategories={jest.fn()}
      />,
    )

    const buttons = getAllByRole('button')
    const labels = buttons.map((node) => node.props.accessibilityLabel)

    expect(labels[0]).toBe('ÐœÐ¾Ðµ Ð¼ÐµÑÑ‚Ð¾Ð¿Ð¾Ð»Ð¾Ð¶ÐµÐ½Ð¸Ðµ')
    expect(labels[1]).toBe('ÐŸÑ€Ð¸Ð±Ð»Ð¸Ð·Ð¸Ñ‚ÑŒ')
    expect(labels[2]).toContain('60')
    expect(labels[3]).toContain('Ð’ÑÐµ')

    fireEvent.press(buttons[0])
    fireEvent.press(buttons[1])

    expect(onLocate).toHaveBeenCalledTimes(1)
    expect(onZoomIn).toHaveBeenCalledTimes(1)
  })

  it('adds left clearance on narrow web layouts to avoid overlapping map controls', () => {
    const originalPlatformOs = RN.Platform.OS
    Object.defineProperty(RN.Platform, 'OS', { value: 'web', configurable: true })

    try {
      const { getByTestId } = render(
        <MapQuickFilters
          radiusValue="60 ÐºÐ¼"
          categoriesValue="Ð’ÑÐµ"
          onPressRadius={jest.fn()}
          onPressCategories={jest.fn()}
        />,
      )

      const container = getByTestId('map-quick-filters')
      const flattenedStyle = RN.StyleSheet.flatten(container.props.style)

      expect(flattenedStyle.left).toBe(80)
      expect(flattenedStyle.top).toBe(8)
    } finally {
      Object.defineProperty(RN.Platform, 'OS', {
        value: originalPlatformOs,
        configurable: true,
      })
    }
  })

  it('can disable left clearance on narrow web layouts when floating map controls are hidden', () => {
    const originalPlatformOs = RN.Platform.OS
    Object.defineProperty(RN.Platform, 'OS', { value: 'web', configurable: true })

    try {
      const { getByTestId } = render(
        <MapQuickFilters
          radiusValue="60 ÃÂºÃÂ¼"
          categoriesValue="Ãâ€™Ã‘ÂÃÂµ"
          onPressRadius={jest.fn()}
          onPressCategories={jest.fn()}
          reserveLeftControlsSpace={false}
        />,
      )

      const container = getByTestId('map-quick-filters')
      const flattenedStyle = RN.StyleSheet.flatten(container.props.style)

      expect(flattenedStyle.left).toBe(12)
      expect(flattenedStyle.top).toBe(8)
    } finally {
      Object.defineProperty(RN.Platform, 'OS', {
        value: originalPlatformOs,
        configurable: true,
      })
    }
  })
})
