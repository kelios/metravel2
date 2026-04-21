import { createRef } from 'react'
import { render, screen } from '@testing-library/react-native'

import type { Travel } from '@/types/types'
import { TravelDetailsSidebarSection } from '@/components/travel/details/sections/TravelDetailsSidebarSection'

jest.mock('@/hooks/useProgressiveLoading', () => ({
  useProgressiveLoad: () => ({
    setElementRef: jest.fn(),
  }),
}))

jest.mock('@/components/travel/NearTravelList', () => {
  const React = require('react')
  const { Text } = require('react-native')

  return function MockNearTravelList(props: { travel: { id: number } }) {
    return <Text testID="mock-near-travel-list">{String(props.travel.id)}</Text>
  }
})

jest.mock('@/components/travel/PopularTravelList', () => {
  const { Text } = require('react-native')

  return function MockPopularTravelList() {
    return <Text testID="mock-popular-travel-list">popular</Text>
  }
})

jest.mock('@/components/travel/NavigationArrows', () => {
  const { View } = require('react-native')

  return function MockNavigationArrows() {
    return <View testID="mock-navigation-arrows" />
  }
})

jest.mock('@/components/travel/details/TravelDetailsStyles', () => ({
  useTravelDetailsStyles: () => ({
    sectionContainer: {},
    contentStable: {},
    webDeferredSection: {},
    sectionHeaderText: {},
    sectionSubtitle: {},
    navigationArrowsContainer: {},
  }),
}))

describe('TravelDetailsSidebarSection', () => {
  it('renders nearby travels block when travel has valid id even if travelAddress is empty', async () => {
    render(
      <TravelDetailsSidebarSection
        travel={{
          id: 123,
          slug: 'direct-entry-travel',
          travelAddress: [],
        } as Travel}
        anchors={{
          gallery: createRef(),
          video: createRef(),
          description: createRef(),
          recommendation: createRef(),
          plus: createRef(),
          minus: createRef(),
          map: createRef(),
          points: createRef(),
          near: createRef(),
          popular: createRef(),
          excursions: createRef(),
          comments: createRef(),
        }}
        canRenderHeavy
      />
    )

    expect(screen.getByTestId('travel-details-near-loaded')).toBeTruthy()
    expect(await screen.findByTestId('mock-near-travel-list')).toBeTruthy()
    expect(screen.getByText('Рядом можно посмотреть')).toBeTruthy()
  })
})
