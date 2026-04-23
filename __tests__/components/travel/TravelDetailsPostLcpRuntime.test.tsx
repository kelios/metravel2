import React from 'react'
import { render, screen } from '@testing-library/react-native'

import TravelDetailsPostLcpRuntime from '@/components/travel/details/TravelDetailsPostLcpRuntime'

jest.mock('@/components/travel/details/TravelDetailsDeferred', () => {
  const React = require('react')
  const { Text } = require('react-native')
  return {
    __esModule: true,
    TravelDeferredSections: () => React.createElement(Text, { testID: 'travel-deferred-sections' }, 'deferred'),
  }
})

jest.mock('@/components/ui/ScrollToTopButton', () => ({
  __esModule: true,
  default: () => {
    const React = require('react')
    const { Text } = require('react-native')
    return React.createElement(Text, { testID: 'scroll-to-top-button' }, 'top')
  },
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
  it('shows deferred runtime controls when chrome is ready and mobile layout is active', async () => {
    render(
      <TravelDetailsPostLcpRuntime
        travel={{ id: 1, name: 'Demo', slug: 'demo', gallery: [] } as any}
        isMobile={true}
        screenWidth={390}
        anchors={{} as any}
        sectionLinks={[{ key: 'map', label: 'Карта', icon: 'map' } as any]}
        onNavigate={jest.fn()}
        activeSection="map"
        forceOpenKey={null}
        scrollY={{} as any}
        contentHeight={1200}
        viewportHeight={800}
        scrollViewRef={{ current: null }}
        criticalChromeReady={true}
        scrollToMapSection={jest.fn()}
        scrollToComments={jest.fn()}
      />
    )

    expect(await screen.findByTestId('travel-deferred-sections')).toBeTruthy()
    expect(screen.getByTestId('reading-progress-bar')).toBeTruthy()
    expect(screen.getByTestId('travel-sections-sheet-wrapper')).toBeTruthy()
    expect(screen.getByTestId('scroll-to-top-button')).toBeTruthy()
    expect(await screen.findByTestId('travel-sticky-actions')).toBeTruthy()
  })

  it('hides progress and sheet when chrome is not ready or there is no overflow', async () => {
    render(
      <TravelDetailsPostLcpRuntime
        travel={{ id: 1, name: 'Demo', slug: 'demo', gallery: [] } as any}
        isMobile={false}
        screenWidth={1600}
        anchors={{} as any}
        sectionLinks={[]}
        onNavigate={jest.fn()}
        activeSection={null}
        forceOpenKey={null}
        scrollY={{} as any}
        contentHeight={600}
        viewportHeight={800}
        scrollViewRef={{ current: null }}
        criticalChromeReady={false}
        scrollToMapSection={jest.fn()}
        scrollToComments={jest.fn()}
      />
    )

    expect(await screen.findByTestId('travel-deferred-sections')).toBeTruthy()
    expect(screen.queryByTestId('reading-progress-bar')).toBeNull()
    expect(screen.queryByTestId('travel-sections-sheet-wrapper')).toBeNull()
    expect(screen.queryByTestId('scroll-to-top-button')).toBeNull()
    expect(screen.queryByTestId('travel-sticky-actions')).toBeNull()
  })
})
