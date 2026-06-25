import React from 'react'
import { render, screen } from '@testing-library/react-native'

import TravelDetailsPostLcpRuntime from '@/components/travel/details/TravelDetailsPostLcpRuntime'
import TravelDetailsScrollRuntime from '@/components/travel/details/TravelDetailsScrollRuntime'
import { TravelDetailsDeferredScrollProvider } from '@/components/travel/details/TravelDetailsDeferredScrollContext'

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

    expect(await screen.findByTestId('travel-deferred-sections')).toBeTruthy()
    expect(screen.queryByTestId('reading-progress-bar')).toBeNull()
    expect(screen.queryByTestId('travel-sections-sheet-wrapper')).toBeNull()
    expect(screen.queryByTestId('scroll-to-top-button')).toBeNull()
    expect(screen.queryByTestId('travel-sticky-actions')).toBeNull()
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
          scrollViewRef={{ current: null }}
          criticalChromeReady={true}
          scrollToComments={jest.fn()}
        />
      </TravelDetailsDeferredScrollProvider>
    )

    expect(screen.getByTestId('reading-progress-bar')).toBeTruthy()
    expect(screen.getByTestId('travel-sections-sheet-wrapper')).toBeTruthy()
    expect(screen.getByTestId('scroll-to-top-button')).toBeTruthy()
    expect(await screen.findByTestId('travel-sticky-actions')).toBeTruthy()
  })
})
