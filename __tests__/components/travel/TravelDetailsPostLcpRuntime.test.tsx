import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Platform, StyleSheet, Text } from 'react-native'

import TravelDetailsPostLcpRuntime from '@/components/travel/details/TravelDetailsPostLcpRuntime'
import TravelDetailsScrollRuntime from '@/components/travel/details/TravelDetailsScrollRuntime'
import { TravelDetailsDeferredScrollProvider } from '@/components/travel/details/TravelDetailsDeferredScrollContext'
import {
  TRAVEL_DETAILS_FOOTER_RESERVE_HEIGHT,
  TravelDetailsDeferredTransition,
} from '@/components/travel/details/TravelDetailsDeferredTransition'

const mockLoadDeferredSectionsComponent = jest.fn()
const mockDeferredSectionsComponent = () => (
  <Text testID="travel-deferred-sections">deferred</Text>
)
const INCLUDE_HIDDEN = { includeHiddenElements: true } as const

jest.mock('@/components/travel/details/travelDetailsDeferredLoader', () => ({
  getInitialDeferredSectionsComponent: () => null,
  loadDeferredSectionsComponent: () => mockLoadDeferredSectionsComponent(),
}))

jest.mock('@/components/ui/ReadingProgressBar', () => ({
  __esModule: true,
  default: () => {
    const React = require('react')
    const { Text } = require('react-native')
    return React.createElement(Text, { testID: 'reading-progress-bar' }, 'progress')
  },
}))

jest.mock('@/components/travel/TravelSectionsSheet', () => ({
  __esModule: true,
  default: () => {
    const React = require('react')
    const { Text } = require('react-native')
    return React.createElement(Text, { testID: 'travel-sections-sheet-wrapper' }, 'sheet')
  },
}))

jest.mock('@/components/travel/details/TravelStickyActions', () => ({
  __esModule: true,
  default: () => {
    const React = require('react')
    const { Text } = require('react-native')
    return React.createElement(Text, { testID: 'travel-sticky-actions' }, 'actions')
  },
}))

describe('TravelDetailsPostLcpRuntime', () => {
  const originalPlatformOS = Platform.OS

  beforeEach(() => {
    Platform.OS = 'web'
    mockLoadDeferredSectionsComponent.mockReset()
    mockLoadDeferredSectionsComponent.mockResolvedValue(mockDeferredSectionsComponent)
  })

  afterAll(() => {
    Platform.OS = originalPlatformOS
  })

  it('mounts deferred sections without scroll-derived runtime chrome', async () => {
    render(
      <TravelDetailsPostLcpRuntime
        travel={{ id: 1, name: 'Demo', slug: 'demo', gallery: [] } as any}
        isMobile={true}
        anchors={{} as any}
        forceOpenKey={null}
        scrollToMapSection={jest.fn()}
      />
    )

    const runtime = await screen.findByTestId(
      'travel-details-deferred-transition-runtime',
      INCLUDE_HIDDEN,
    )
    fireEvent(runtime, 'layout', {
      nativeEvent: { layout: { width: 390, height: 2400, x: 0, y: 0 } },
    })

    expect(await screen.findByTestId('travel-deferred-sections')).toBeTruthy()
    expect(screen.queryByTestId('reading-progress-bar')).toBeNull()
    expect(screen.queryByTestId('travel-sections-sheet-wrapper')).toBeNull()
    expect(screen.queryByTestId('travel-sticky-actions')).toBeNull()
  })

  it('keeps the matching deferred skeleton through the first runtime layout', async () => {
    let resolveDeferredSections: ((component: typeof mockDeferredSectionsComponent) => void) | undefined
    mockLoadDeferredSectionsComponent.mockReturnValueOnce(
      new Promise<typeof mockDeferredSectionsComponent>((resolve) => {
        resolveDeferredSections = resolve
      }),
    )

    render(
      <TravelDetailsPostLcpRuntime
        travel={{ id: 1, name: 'Demo', slug: 'demo', gallery: [] } as any}
        isMobile={false}
        anchors={{} as any}
        forceOpenKey={null}
        scrollToMapSection={jest.fn()}
      />,
    )

    expect(
      screen.getByTestId('travel-details-deferred-transition-placeholder', INCLUDE_HIDDEN),
    ).toBeTruthy()

    await act(async () => {
      resolveDeferredSections?.(mockDeferredSectionsComponent)
      await Promise.resolve()
    })

    expect(screen.getByTestId('travel-deferred-sections', INCLUDE_HIDDEN)).toBeTruthy()
    expect(
      screen.getByTestId('travel-details-deferred-transition-placeholder', INCLUDE_HIDDEN),
    ).toBeTruthy()
    expect(
      screen.getByTestId('travel-details-deferred-transition-runtime', INCLUDE_HIDDEN).props.inert,
    ).toBe(true)

    fireEvent(
      screen.getByTestId('travel-details-deferred-transition-runtime', INCLUDE_HIDDEN),
      'layout',
      { nativeEvent: { layout: { width: 900, height: 0, x: 0, y: 0 } } },
    )
    expect(
      screen.getByTestId('travel-details-deferred-transition-placeholder', INCLUDE_HIDDEN),
    ).toBeTruthy()

    fireEvent(
      screen.getByTestId('travel-details-deferred-transition-runtime', INCLUDE_HIDDEN),
      'layout',
      { nativeEvent: { layout: { width: 900, height: 2400, x: 0, y: 0 } } },
    )

    await waitFor(() => {
      expect(
        screen.queryByTestId('travel-details-deferred-transition-placeholder', INCLUDE_HIDDEN),
      ).toBeNull()
    })
    expect(
      screen.getByTestId('travel-details-deferred-transition-runtime').props.inert,
    ).toBeUndefined()
  })

  it('reveals an explicit failure state instead of leaving a rejected deferred import behind the skeleton', async () => {
    mockLoadDeferredSectionsComponent.mockRejectedValueOnce(new Error('chunk failed'))

    render(
      <TravelDetailsPostLcpRuntime
        travel={{ id: 1, name: 'Demo', slug: 'demo', gallery: [] } as any}
        isMobile={false}
        anchors={{} as any}
        forceOpenKey={null}
        scrollToMapSection={jest.fn()}
      />,
    )

    const runtime = await screen.findByTestId(
      'travel-details-deferred-transition-runtime',
      INCLUDE_HIDDEN,
    )
    expect(screen.getByTestId('travel-details-deferred-load-error', INCLUDE_HIDDEN)).toBeTruthy()
    expect(
      screen.getByTestId('travel-details-deferred-transition-placeholder', INCLUDE_HIDDEN),
    ).toBeTruthy()

    fireEvent(runtime, 'layout', {
      nativeEvent: { layout: { width: 900, height: 40, x: 0, y: 0 } },
    })

    await waitFor(() => {
      expect(screen.getByTestId('travel-details-deferred-load-error')).toBeTruthy()
      expect(
        screen.queryByTestId('travel-details-deferred-transition-placeholder', INCLUDE_HIDDEN),
      ).toBeNull()
    })
  })

  it('keeps the original native skeleton when the deferred loader rejects', async () => {
    Platform.OS = 'ios'
    mockLoadDeferredSectionsComponent.mockRejectedValueOnce(new Error('chunk failed'))

    render(
      <TravelDetailsPostLcpRuntime
        travel={{ id: 1, name: 'Demo', slug: 'demo', gallery: [] } as any}
        isMobile
        anchors={{} as any}
        forceOpenKey={null}
        scrollToMapSection={jest.fn()}
      />,
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByTestId('section-skeleton-reserved')).toBeTruthy()
    expect(screen.queryByTestId('travel-details-deferred-load-error')).toBeNull()
    expect(screen.queryByTestId('travel-details-deferred-transition')).toBeNull()
  })

  it('keeps the footer reserve while measuring and drops it after the runtime frame is ready', async () => {
    const reserveHeight = TRAVEL_DETAILS_FOOTER_RESERVE_HEIGHT
    const { rerender } = render(
      <TravelDetailsDeferredTransition
        testID="travel-details-footer-transition"
        isMobile={false}
        pending
        placeholder={<Text testID="footer-skeleton">skeleton</Text>}
        reserveHeight={reserveHeight}
        runtimeFrameReady={false}
      >
        <Text testID="footer-runtime">runtime</Text>
      </TravelDetailsDeferredTransition>,
    )

    const transition = screen.getByTestId('travel-details-footer-transition')
    expect(StyleSheet.flatten(transition.props.style).minHeight).toBe(reserveHeight)
    expect(screen.getByTestId('footer-skeleton', INCLUDE_HIDDEN)).toBeTruthy()

    rerender(
      <TravelDetailsDeferredTransition
        testID="travel-details-footer-transition"
        isMobile={false}
        pending={false}
        placeholder={<Text testID="footer-skeleton">skeleton</Text>}
        reserveHeight={reserveHeight}
        runtimeFrameReady={false}
      >
        <Text testID="footer-runtime">runtime</Text>
      </TravelDetailsDeferredTransition>,
    )

    expect(StyleSheet.flatten(transition.props.style).minHeight).toBe(reserveHeight)
    expect(screen.getByTestId('footer-skeleton', INCLUDE_HIDDEN)).toBeTruthy()

    fireEvent(
      screen.getByTestId('travel-details-footer-transition-runtime', INCLUDE_HIDDEN),
      'layout',
      { nativeEvent: { layout: { width: 900, height: reserveHeight, x: 0, y: 0 } } },
    )
    expect(screen.getByTestId('footer-skeleton', INCLUDE_HIDDEN)).toBeTruthy()

    rerender(
      <TravelDetailsDeferredTransition
        testID="travel-details-footer-transition"
        isMobile={false}
        pending={false}
        placeholder={<Text testID="footer-skeleton">skeleton</Text>}
        reserveHeight={reserveHeight}
        runtimeFrameReady
      >
        <Text testID="footer-runtime">runtime</Text>
      </TravelDetailsDeferredTransition>,
    )

    await waitFor(() => {
      expect(screen.queryByTestId('footer-skeleton', INCLUDE_HIDDEN)).toBeNull()
    })
    expect(StyleSheet.flatten(transition.props.style).minHeight).toBeUndefined()
  })

  it('keeps the original direct placeholder-to-runtime behavior on native', () => {
    Platform.OS = 'ios'
    const { rerender } = render(
      <TravelDetailsDeferredTransition
        testID="native-transition"
        isMobile
        pending
        placeholder={<Text testID="native-placeholder">placeholder</Text>}
      >
        <Text testID="native-runtime">runtime</Text>
      </TravelDetailsDeferredTransition>,
    )

    expect(screen.getByTestId('native-placeholder')).toBeTruthy()
    expect(screen.queryByTestId('native-runtime')).toBeNull()
    expect(screen.queryByTestId('native-transition')).toBeNull()

    rerender(
      <TravelDetailsDeferredTransition
        testID="native-transition"
        isMobile
        pending={false}
        placeholder={<Text testID="native-placeholder">placeholder</Text>}
      >
        <Text testID="native-runtime">runtime</Text>
      </TravelDetailsDeferredTransition>,
    )

    expect(screen.queryByTestId('native-placeholder')).toBeNull()
    expect(screen.getByTestId('native-runtime')).toBeTruthy()
    expect(screen.queryByTestId('native-transition')).toBeNull()
  })

  it('renders scroll-derived runtime controls from the scroll provider', async () => {
    render(
      <TravelDetailsDeferredScrollProvider
        value={{
          activeSection: 'map',
          contentHeight: 1200,
          scrollY: {} as any,
          viewportHeight: 800,
        }}
      >
        <TravelDetailsScrollRuntime
          travel={{ id: 1, name: 'Demo', slug: 'demo', gallery: [] } as any}
          isMobile={true}
          screenWidth={390}
          sectionLinks={[{ key: 'map', label: 'Карта', icon: 'map' } as any]}
          onNavigate={jest.fn()}
          criticalChromeReady={true}
          scrollToComments={jest.fn()}
        />
      </TravelDetailsDeferredScrollProvider>
    )

    expect(screen.getByTestId('reading-progress-bar')).toBeTruthy()
    expect(screen.getByTestId('travel-sections-sheet-wrapper')).toBeTruthy()
    expect(await screen.findByTestId('travel-sticky-actions')).toBeTruthy()
  })
})
