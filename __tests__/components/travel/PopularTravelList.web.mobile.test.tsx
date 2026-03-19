/**
 * @jest-environment jsdom
 */

import React from 'react'
import renderer from 'react-test-renderer'
import * as RN from 'react-native'

import PopularTravelList from '@/components/travel/PopularTravelList'

const mockUseQuery = jest.fn()
const mockTravelListItem = jest.fn((props: any) =>
  React.createElement('mock-travel-list-item', props)
)

jest.mock('@tanstack/react-query', () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}))

jest.mock('@/components/travel/TravelTmlRound', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/listTravel/TravelListItem', () => ({
  __esModule: true,
  default: (props: any) => mockTravelListItem(props),
}))

describe('PopularTravelList web mobile layout', () => {
  const originalPlatform = RN.Platform.OS

  beforeEach(() => {
    RN.Platform.OS = 'web'
    mockTravelListItem.mockClear()
    mockUseQuery.mockReturnValue({
      data: {
        a: { id: 1, name: 'One', countryName: 'Poland', countUnicIpView: '100' },
        b: { id: 2, name: 'Two', countryName: 'Belarus', countUnicIpView: '200' },
      },
      isLoading: false,
      isError: false,
    })
    jest.spyOn(RN.Animated, 'timing').mockReturnValue({
      start: (cb?: any) => cb?.(),
    } as any)
    jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({
      width: 390,
      height: 844,
      scale: 2,
      fontScale: 1,
    } as any)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    RN.Platform.OS = originalPlatform
  })

  it('renders mobile-style travel cards without fixed card width on narrow web', () => {
    renderer.act(() => {
      renderer.create(<PopularTravelList embedded showHeader={false} />)
    })

    expect(mockTravelListItem).toHaveBeenCalled()
    const firstProps = mockTravelListItem.mock.calls[0]?.[0]
    expect(firstProps?.isMobile).toBe(true)
    expect(firstProps?.cardWidth).toBeUndefined()
  })
})
