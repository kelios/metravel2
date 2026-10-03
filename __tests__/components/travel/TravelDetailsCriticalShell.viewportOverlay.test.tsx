/**
 * #2118 / TRAVEL-STICKY-ACTIONS-OFFSCREEN-001: на native хром, привязанный к окну
 * (бар «Действия с путешествием», прогресс чтения), монтируется вне ScrollView.
 * Внутри колонки контента `position: absolute; bottom: 0` уводил бар в низ статьи
 * (замер iPhone 17 Pro: y = 57 817 при окне 874).
 */
import React from 'react'
import { Animated, Platform, Text } from 'react-native'
import { render, screen, within } from '@testing-library/react-native'

jest.mock('@/components/travel/CompactSideBarTravel', () => () => null)
jest.mock('@/components/travel/details/TravelDetailsSkeletonOverlay', () => () => null)
jest.mock('@/components/travel/details/TravelHeroStickyNavNative', () => () => null)
jest.mock('@/components/travel/details/TravelDetailsHeroDeferredColumn', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    TravelDetailsHeroBlock: () => React.createElement(View, { testID: 'hero-block' }),
    TravelDetailsContentBlock: () => React.createElement(View, { testID: 'content-block' }),
  }
})

import TravelDetailsCriticalShell from '@/components/travel/details/TravelDetailsCriticalShell'

describe('TravelDetailsCriticalShell viewport overlay (#2118)', () => {
  const originalOS = Platform.OS

  beforeEach(() => {
    Platform.OS = 'ios'
  })

  afterAll(() => {
    Platform.OS = originalOS
  })

  it('mounts the viewport chrome outside the scroll content and passes touches through', () => {
    render(
      <TravelDetailsCriticalShell
        travel={{ id: 1, name: 'Тропа ведьм' } as any}
        isMobile
        screenWidth={402}
        wrapperStyle={{}}
        styles={{}}
        skeletonPhase="hidden"
        skeletonFallback={null}
        scrollRef={{ current: null }}
        scrollViewStyle={{}}
        scrollEventHandler={() => {}}
        handleContentSizeChange={() => {}}
        handleLayout={() => {}}
        contentHorizontalPadding={16}
        anchors={{} as any}
        onFirstImageLoad={() => {}}
        sectionLinks={[]}
        onQuickJump={() => {}}
        deferHeroExtras={false}
        forceOpenKey={null}
        activeSection={null}
        closeMenu={() => {}}
        onNavigate={() => {}}
        menuWidthNum={320}
        animatedX={new Animated.Value(0)}
        sideMenuPlatformStyles={{}}
        deferredContent={<Text testID="scroll-layer">sections</Text>}
        viewportOverlay={<Text testID="viewport-layer">actions</Text>}
        mainAriaLabel="Тропа ведьм"
      />,
    )

    const scroll = screen.getByTestId('travel-details-scroll')
    expect(within(scroll).getByTestId('scroll-layer')).toBeTruthy()
    expect(within(scroll).queryByTestId('viewport-layer')).toBeNull()

    const overlay = screen.getByTestId('travel-details-viewport-overlay')
    expect(overlay.props.pointerEvents).toBe('box-none')
    expect(within(overlay).getByTestId('viewport-layer')).toBeTruthy()
  })
})
