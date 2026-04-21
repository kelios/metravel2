import React from 'react'
import * as RN from 'react-native'
import { render } from '@testing-library/react-native'

import { MapQuickFilters } from '@/components/MapPage/MapQuickFilters'

jest.mock('@/components/MapPage/popovers/MapChipPopover', () => {
  const React = require('react')
  const { View } = require('react-native')

  return {
    MapChipPopover: ({ visible, children, testID }: any) =>
      visible ? React.createElement(View, { testID }, children) : null,
  }
})

describe('MapQuickFilters overlays', () => {
  beforeEach(() => {
    ;(RN.useWindowDimensions as jest.Mock).mockReturnValue({
      width: 360,
      height: 800,
      scale: 1,
      fontScale: 1,
    })
  })

  it('renders overlays selector when overlay controls are provided', () => {
    const { getByLabelText, getByText } = render(
      <MapQuickFilters
        radiusValue="60 км"
        categoriesValue="Все"
        overlaysValue="1 вкл"
        radiusOptions={[{ id: '60', name: '60' }]}
        radiusSelected="60"
        onChangeRadius={jest.fn()}
        categoriesOptions={[{ id: '84', name: 'Замки' }]}
        categoriesSelected={[]}
        onChangeCategories={jest.fn()}
        overlayOptions={[
          { id: 'wikimedia-photos', title: 'Фото' },
          { id: 'osm-poi', title: 'POI' },
        ]}
        enabledOverlays={{ 'wikimedia-photos': true, 'osm-poi': false }}
        onChangeOverlay={jest.fn()}
        onResetOverlays={jest.fn()}
      />,
    )

    expect(getByText('Оверлеи')).toBeTruthy()
    expect(getByLabelText('Оверлеи: 1 вкл')).toBeTruthy()
  })
})
