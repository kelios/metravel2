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
})
