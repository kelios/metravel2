import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { Pressable, Text } from 'react-native'

import { MapMobileCollapsedOverlay } from '@/components/MapPage/MapMobile/MapMobileCollapsedOverlay'

const mockMapQuickFilters = jest.fn(
  ({ primaryCtaLabel, onPressPrimaryCta, primaryCtaTestID }: any) => (
    <Pressable testID={primaryCtaTestID} onPress={onPressPrimaryCta}>
      <Text>{primaryCtaLabel}</Text>
    </Pressable>
  ),
)

jest.mock('@/components/MapPage/MapQuickFilters', () => ({
  MapQuickFilters: (props: any) => mockMapQuickFilters(props),
}))

describe('MapMobileCollapsedOverlay', () => {
  beforeEach(() => {
    mockMapQuickFilters.mockClear()
  })

  it('exposes a first-visit CTA to find nearby places', () => {
    const onOpenSearch = jest.fn()

    const { getByTestId, getByText } = render(
      <MapMobileCollapsedOverlay
        quickRadiusValue="60 км"
        quickCategoriesValue="Все"
        quickOverlaysValue="Выкл"
        quickRadiusOptions={[]}
        quickCategoryOptions={[]}
        quickOverlayOptions={[]}
        quickEnabledOverlays={{}}
        activeRadius="60"
        quickFilterSelected={[]}
        travelsData={[]}
        onCenterUser={jest.fn()}
        onOpenList={jest.fn()}
        onOpenSearch={onOpenSearch}
      />,
    )

    expect(getByText('Найти места рядом')).toBeTruthy()

    fireEvent.press(getByTestId('map-mobile-find-nearby'))

    expect(onOpenSearch).toHaveBeenCalledTimes(1)
    expect(mockMapQuickFilters).toHaveBeenCalled()
  })
})

