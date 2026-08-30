import { createRef } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react-native'

import type { Travel } from '@/types/types'
import { TravelDetailsSidebarSection } from '@/components/travel/details/sections/TravelDetailsSidebarSection'

let mockNearTravelListProps: Record<string, unknown> | null = null

jest.mock('@/hooks/useProgressiveLoading', () => ({
  useProgressiveLoad: () => ({
    setElementRef: jest.fn(),
  }),
}))

jest.mock('@/components/travel/NearTravelList', () => {
  const React = require('react')
  const { Text } = require('react-native')

  return function MockNearTravelList(props: { travel: { id: number } }) {
    mockNearTravelListProps = props as unknown as Record<string, unknown>
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
  beforeEach(() => {
    mockNearTravelListProps = null
  })

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

  it('forwards the real near-list frame to the deferred web transition', async () => {
    const onRuntimeFrameReady = jest.fn()
    render(
      <TravelDetailsSidebarSection
        travel={{ id: 321, slug: 'runtime-frame' } as Travel}
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
        onRuntimeFrameReady={onRuntimeFrameReady}
      />,
    )

    expect(await screen.findByTestId('mock-near-travel-list')).toBeTruthy()
    fireEvent(screen.getByTestId('travel-details-sidebar-runtime-frame'), 'layout', {
      nativeEvent: { layout: { height: 300, width: 920, x: 0, y: 0 } },
    })
    expect(onRuntimeFrameReady).not.toHaveBeenCalled()

    await act(async () => {
      const onTravelsLoaded = mockNearTravelListProps?.onTravelsLoaded as
        | ((travels: Travel[]) => void)
        | undefined
      onTravelsLoaded?.([{ id: 9001, name: 'Loaded near card' } as Travel])
    })
    expect(onRuntimeFrameReady).not.toHaveBeenCalled()

    fireEvent(screen.getByTestId('travel-details-sidebar-runtime-frame'), 'layout', {
      nativeEvent: { layout: { height: 548, width: 920, x: 0, y: 0 } },
    })
    expect(onRuntimeFrameReady).toHaveBeenCalledTimes(1)
  })
})
