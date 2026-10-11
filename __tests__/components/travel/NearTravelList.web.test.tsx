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

const mockTravelTmlRound = jest.fn((_props: any) => null)

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
    isMapLoading: false,
    isMapError: false,
    isError: false,
    error: null,
    refetchTravelsNear: jest.fn(),
    refetchMapPoints: jest.fn(),
  }),
}))

jest.mock('@/components/listTravel/TravelListItem', () => ({
  __esModule: true,
  default: (props: any) => mockTravelListItem(props),
}))

jest.mock('@/components/travel/TravelTmlRound', () => ({
  __esModule: true,
  default: (props: any) => mockTravelTmlRound(props),
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
    mockTravelTmlRound.mockClear()
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

    let tree!: ReturnType<typeof renderer.create>
    renderer.act(() => {
      tree = renderer.create(<NearTravelList travel={{ id: 1 }} embedded showHeader={false} />)
    })

    expect(mockTravelListItem).toHaveBeenCalled()
    const firstProps = mockTravelListItem.mock.calls[0]?.[0]
    expect(firstProps?.cardWidth).toBe(getTravelDetailsListColumnWidth(1280, 3))
    expect(firstProps?.cardWidth).toBeLessThanOrEqual(640)
    // #2367: «Рядом» — один горизонтальный ряд; вертикальной прокрутки внутри нет.
    const scrolls = tree.root.findAllByType(RN.ScrollView)
    expect(scrolls).toHaveLength(1)
    expect(scrolls[0].props.horizontal).toBe(true)
    // UnifiedTravelCard по умолчанию 'pan-y': в горизонтальном ряду свайп гасился бы.
    expect(firstProps?.webTouchAction).toBe('pan-x pan-y')
  })

  it('phone web: cards sit in the horizontal rail and keep horizontal swipe (#2367)', () => {
    jest.spyOn(RN, 'useWindowDimensions').mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    } as any)

    let tree!: ReturnType<typeof renderer.create>
    renderer.act(() => {
      tree = renderer.create(<NearTravelList travel={{ id: 1 }} embedded showHeader={false} />)
    })

    const scrolls = tree.root.findAllByType(RN.ScrollView)
    expect(scrolls).toHaveLength(1)
    expect(scrolls[0].props.horizontal).toBe(true)
    expect(mockTravelTmlRound).toHaveBeenCalled()
    expect(mockTravelTmlRound.mock.calls[0]?.[0]?.webTouchAction).toBe('pan-x pan-y')
  })
})
