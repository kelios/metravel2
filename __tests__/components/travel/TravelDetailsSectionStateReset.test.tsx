/**
 * @jest-environment jsdom
 */

import { Platform } from 'react-native'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'

jest.mock('@/hooks/useProgressiveLoading', () => ({
  useProgressiveLoad: () => ({
    shouldLoad: true,
    setElementRef: jest.fn(),
  }),
}))

jest.mock('@/hooks/useMapLazyLoad', () => ({
  useMapLazyLoad: () => ({
    shouldRender: false,
    elementRef: jest.fn(),
    isLoading: false,
    isVisible: false,
  }),
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    primary: '#123456',
    info: '#234567',
    success: '#345678',
    warning: '#456789',
    accent: '#56789a',
    primaryDark: '#123456',
    infoDark: '#234567',
    successDark: '#345678',
    warningDark: '#456789',
    accentDark: '#56789a',
  }),
}))

jest.mock('@/hooks/useTdTrace', () => ({
  useTdTrace: () => jest.fn(),
}))

jest.mock('@/components/travel/details/TravelDetailsLazy', () => ({
  withLazy: (loader: () => Promise<{ default: any }>) => {
    const React = require('react')

    return function MockLazyWrapper(props: any) {
      const [Loaded, setLoaded] = React.useState<any>(null)

      React.useEffect(() => {
        let active = true
        void loader().then((mod) => {
          if (active) {
            setLoaded(() => mod.default)
          }
        })
        return () => {
          active = false
        }
      }, [])

      return Loaded ? <Loaded {...props} /> : null
    }
  },
}))

jest.mock('@/hooks/useTravelRouteFiles', () => ({
  useTravelRouteFiles: () => ({
    data: [],
  }),
}))

jest.mock('@/utils/isWebAutomation', () => ({
  isWebAutomation: false,
}))

jest.mock('@/api/travelRoutes', () => ({
  buildTravelRouteDownloadPath: jest.fn(),
  downloadTravelRouteFileBlob: jest.fn(),
}))

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrlInNewTab: jest.fn(),
}))

jest.mock('@/utils/routeFileParser', () => ({
  parseRouteFilePreviews: jest.fn(() => []),
}))

jest.mock('@/components/travel/details/TravelDetailsStyles', () => ({
  useTravelDetailsStyles: () => ({
    sectionContainer: {},
    contentStable: {},
    webDeferredSection: {},
    sectionHeaderText: {},
    sectionSubtitle: {},
    travelListFallback: {},
    lazySectionReserved: {},
    navigationArrowsContainer: {},
    fallback: {},
    mapEmptyState: {},
    mapEmptyText: {},
    excursionsWidgetCard: {},
  }),
}))

jest.mock('@/components/travel/NearTravelList', () => ({
  __esModule: true,
  default: function MockNearTravelList({ travel, onTravelsLoaded }: any) {
    const { useEffect, useRef } = require('react')
    const { View } = require('react-native')

    // Use ref to track if we've already called onTravelsLoaded for this travel
    const calledRef = useRef<number | null>(null)

    useEffect(() => {
      // Only call onTravelsLoaded once per travel.id
      if (travel?.id === 1 && calledRef.current !== travel.id) {
        calledRef.current = travel.id
        // Use setTimeout to ensure state update happens in next tick
        setTimeout(() => {
          onTravelsLoaded?.([
            { id: 1, slug: 'first-travel', name: 'First travel' },
            { id: 2, slug: 'nearby-travel', name: 'Nearby travel' },
          ])
        }, 0)
      }
    }, [travel?.id, onTravelsLoaded])

    return <View testID={`near-travel-list-${travel?.id ?? 'unknown'}`} />
  },
}))

jest.mock('@/components/travel/PopularTravelList', () => ({
  __esModule: true,
  default: function MockPopularTravelList() {
    const { View } = require('react-native')
    return <View testID="popular-travel-list" />
  },
}))

jest.mock('@/components/travel/NavigationArrows', () => ({
  __esModule: true,
  default: function MockNavigationArrows({ relatedTravels }: any) {
    const { Text } = require('react-native')
    return <Text testID="navigation-arrows">{relatedTravels.length}</Text>
  },
}))

jest.mock('@/components/travel/TravelDetailSkeletons', () => ({
  MapSkeleton: () => null,
  PointListSkeleton: () => null,
  TravelListSkeleton: () => null,
}))

jest.mock('@/components/travel/ToggleableMapSection', () => ({
  __esModule: true,
  default: function MockToggleableMapSection({ children, onOpenChange }: any) {
    const { Pressable, Text, View } = require('react-native')
    return (
      <View>
        <Pressable testID="open-map-button" onPress={() => onOpenChange?.(true)}>
          <Text>Open map</Text>
        </Pressable>
        {children}
      </View>
    )
  },
}))

jest.mock('@/components/MapPage/TravelMap', () => ({
  __esModule: true,
  TravelMap: function MockTravelMap() {
    const { View } = require('react-native')
    return <View testID="travel-map" />
  },
}))

jest.mock('@/components/travel/PointList', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/home/WeatherWidget', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/belkraj/BelkrajWidget', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/travel/details/sections/RouteElevationProfile', () => ({
  __esModule: true,
  default: () => null,
}))

describe('Travel detail section state resets', () => {
  beforeEach(() => {
    Platform.OS = 'web'
    Platform.select = (options: any) => options.web ?? options.default
  })

  it('clears stale navigation arrows when the current travel changes', async () => {
    const { TravelDetailsSidebarSection } = require('@/components/travel/details/sections/TravelDetailsSidebarSection')

    const anchors = {
      near: { current: null },
      popular: { current: null },
    }

    const firstTravel = { id: 1, slug: 'first-travel', travelAddress: [{ id: 1 }] }
    const secondTravel = { id: 2, slug: 'second-travel', travelAddress: [{ id: 2 }] }

    const view = render(
      <TravelDetailsSidebarSection
        travel={firstTravel}
        anchors={anchors}
        scrollY={null}
        viewportHeight={900}
        canRenderHeavy
      />
    )

    // Wait for NearTravelList mock to call onTravelsLoaded and set relatedTravels
    // NavigationArrows only renders when relatedTravels.length > 0
    await waitFor(() => {
      expect(view.getByTestId('navigation-arrows')).toBeTruthy()
    })

    view.rerender(
      <TravelDetailsSidebarSection
        travel={secondTravel}
        anchors={anchors}
        scrollY={null}
        viewportHeight={900}
        canRenderHeavy
      />
    )

    // After travel change, relatedTravels should be reset to []
    await waitFor(() => {
      expect(view.queryByTestId('navigation-arrows')).toBeNull()
    })
  })

  it('resets map open state when navigating to another travel', async () => {
    const { TravelDetailsMapSection } = require('@/components/travel/details/sections/TravelDetailsMapSection')

    const anchors = {
      map: { current: null },
      excursions: { current: null },
    }

    const firstTravel = {
      id: 1,
      slug: 'first-travel',
      travelAddress: [{ id: 1, coord: '53.9,27.56', name: 'Минск' }],
      coordsMeTravel: [{ lat: 53.9, lng: 27.56, coord: '53.9,27.56', title: 'Минск' }],
    }
    const secondTravel = {
      id: 2,
      slug: 'second-travel',
      travelAddress: [{ id: 2, coord: '52.1,23.7', name: 'Брест' }],
      coordsMeTravel: [{ lat: 52.1, lng: 23.7, coord: '52.1,23.7', title: 'Брест' }],
    }

    const view = render(
      <TravelDetailsMapSection
        travel={firstTravel}
        anchors={anchors}
        canRenderHeavy
        scrollToMapSection={jest.fn()}
      />
    )

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(view.queryByTestId('travel-map')).toBeNull()

    fireEvent.press(view.getByTestId('open-map-button'))

    await act(async () => {
      await Promise.resolve()
    })

    expect(view.getByTestId('travel-map')).toBeTruthy()

    view.rerender(
      <TravelDetailsMapSection
        travel={secondTravel}
        anchors={anchors}
        canRenderHeavy
        scrollToMapSection={jest.fn()}
      />
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(view.queryByTestId('travel-map')).toBeNull()
  })
})
