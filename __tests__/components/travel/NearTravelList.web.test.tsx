/**
 * @jest-environment jsdom
 */

import React from 'react'
import renderer from 'react-test-renderer'
import * as RN from 'react-native'

import NearTravelList from '@/components/travel/NearTravelList'
import { getTravelDetailsListColumnWidth } from '@/components/travel/utils/travelDetailsListLayout'

const mockTravelListItem = jest.fn((props: any) =>
  React.createElement('mock-travel-list-item', props),
)

const nearItem = {
  id: 1,
  name: 'Nearby route',
  countryName: 'Poland',
  countUnicIpView: '10',
}

jest.mock('@/hooks/useNearTravelData', () => ({
  useNearTravelData: () => ({
    travelsNear: [nearItem],
    displayedTravels: [nearItem],
    mapPoints: [],
    isLoading: false,
    isError: false,
    error: null,
    refetchTravelsNear: jest.fn(),
  }),
}))

jest.mock('@/components/listTravel/TravelListItem', () => ({
  __esModule: true,
  default: (props: any) => mockTravelListItem(props),
}))

jest.mock('@/components/travel/TravelTmlRound', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/MapPage/TravelMap', () => ({
  __esModule: true,
  TravelMap: () => null,
}))

describe('NearTravelList web card width (#1544)', () => {
  const originalPlatform = RN.Platform.OS

  beforeEach(() => {
    RN.Platform.OS = 'web'
    mockTravelListItem.mockClear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    RN.Platform.OS = originalPlatform
  })

  it('passes the real column width (not the 720 viewport fallback) on desktop web', () => {
    jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    } as any)

    renderer.act(() => {
      renderer.create(<NearTravelList travel={{ id: 1 }} embedded showHeader={false} />)
    })

    expect(mockTravelListItem).toHaveBeenCalled()
    const firstProps = mockTravelListItem.mock.calls[0]?.[0]
    expect(firstProps?.cardWidth).toBe(getTravelDetailsListColumnWidth(1280, 3))
    expect(firstProps?.cardWidth).toBeLessThanOrEqual(640)
  })
})
