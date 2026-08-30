import { createRef, type ReactNode } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { Travel } from '@/types/types'
import { TravelDetailsSidebarSection } from '@/components/travel/details/sections/TravelDetailsSidebarSection'

// The section watches the near/popular query state to know when its lists stop
// being in flight, so it only renders under a query client — as it does in app.
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    {children}
  </QueryClientProvider>
)

let mockNearTravelListProps: Record<string, unknown> | null = null
let mockIsFetchingCount = 0

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useIsFetching: () => mockIsFetchingCount,
}))

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
    mockIsFetchingCount = 0
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
      />,
      { wrapper },
    )

    expect(screen.getByTestId('travel-details-near-loaded')).toBeTruthy()
    expect(await screen.findByTestId('mock-near-travel-list')).toBeTruthy()
    expect(screen.getByText('Рядом можно посмотреть')).toBeTruthy()
  })

  it('reports every real-frame resize to the deferred web transition, empty near included', async () => {
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
      { wrapper },
    )

    expect(await screen.findByTestId('mock-near-travel-list')).toBeTruthy()

    // The reserve must never depend on `near` producing results: an empty or
    // failed list used to leave the whole sidebar behind an inert placeholder.
    fireEvent(screen.getByTestId('travel-details-sidebar-runtime-frame'), 'layout', {
      nativeEvent: { layout: { height: 300, width: 920, x: 0, y: 0 } },
    })
    expect(onRuntimeFrameReady).toHaveBeenCalledTimes(1)

    await act(async () => {
      const onTravelsLoaded = mockNearTravelListProps?.onTravelsLoaded as
        | ((travels: Travel[]) => void)
        | undefined
      onTravelsLoaded?.([{ id: 9001, name: 'Loaded near card' } as Travel])
    })

    // `Популярные` keeps growing after `Рядом` commits, so later resizes are
    // reported too — the transition, not the section, decides when it is quiet.
    fireEvent(screen.getByTestId('travel-details-sidebar-runtime-frame'), 'layout', {
      nativeEvent: { layout: { height: 548, width: 920, x: 0, y: 0 } },
    })
    expect(onRuntimeFrameReady).toHaveBeenCalledTimes(2)
    expect(onRuntimeFrameReady.mock.calls.at(-1)?.[0]?.nativeEvent?.layout?.height).toBe(548)
  })

  it('stays silent while its lists are still in flight', async () => {
    // `Рядом`/`Популярные` hold a fixed-height skeleton while they load, so the
    // frame looks stable well before the cards arrive; reporting it would drop
    // the wrapper's height reserve right before the real content lands.
    mockIsFetchingCount = 1
    const onRuntimeFrameReady = jest.fn()
    render(
      <TravelDetailsSidebarSection
        travel={{ id: 654, slug: 'in-flight' } as Travel}
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
      { wrapper },
    )

    expect(await screen.findByTestId('mock-near-travel-list')).toBeTruthy()
    fireEvent(screen.getByTestId('travel-details-sidebar-runtime-frame'), 'layout', {
      nativeEvent: { layout: { height: 572, width: 920, x: 0, y: 0 } },
    })
    expect(onRuntimeFrameReady).not.toHaveBeenCalled()
  })
})
