/**
 * @jest-environment jsdom
 */

import React, { Suspense } from 'react'
import renderer, { act } from 'react-test-renderer'
import { Animated, Platform } from 'react-native'

const mockUseProgressiveLoad = jest.fn(() => ({
  shouldLoad: false,
  setElementRef: jest.fn(),
}))

jest.mock('@/hooks/useProgressiveLoading', () => ({
  useProgressiveLoad: (...args: any[]) => mockUseProgressiveLoad(...args),
}))

jest.mock('@/components/travel/AuthorCard', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/travel/ShareButtons', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/travel/CommentsSection', () => ({
  __esModule: true,
  CommentsSection: () => null,
}))

jest.mock('@/components/travel/TravelRatingSection', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/travel/TravelDescription', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/travel/TravelDetailSkeletons', () => ({
  CommentsSkeleton: () => null,
  MapSkeleton: () => null,
  TravelListSkeleton: () => null,
  DescriptionSkeleton: () => null,
}))

jest.mock('@/components/travel/details/sections/TravelDetailsMapSection', () => ({
  __esModule: true,
  TravelDetailsMapSection: () => null,
}))

jest.mock('@/components/travel/details/sections/TravelDetailsSidebarSection', () => ({
  __esModule: true,
  TravelDetailsSidebarSection: () => null,
}))

jest.mock('@/components/travel/details/sections/TravelDetailsFooterSection', () => ({
  __esModule: true,
  TravelDetailsFooterSection: () => null,
}))

jest.mock('@/hooks/useTdTrace', () => ({
  useTdTrace: () => jest.fn(),
}))

describe('TravelDeferredSections map loading config', () => {
  beforeEach(() => {
    Platform.OS = 'web'
    Platform.select = (obj: any) => obj.web || obj.default
    mockUseProgressiveLoad.mockClear()
  })

  it('keeps the map observer strict enough to avoid first-frame preload', async () => {
    const { TravelDeferredSections } = require('@/components/travel/details/TravelDetailsDeferred')

    const travel: any = {
      id: 2,
      name: 'Deferred map config travel',
      description: '<p>Test description</p>',
      gallery: [],
      youtube_link: null,
      recommendation: '',
      plus: '',
      minus: '',
      rating: 0,
      rating_count: 0,
      user_rating: null,
    }

    const anchors: any = {
      description: { current: null },
      video: { current: null },
      comments: { current: null },
      map: { current: null },
      gallery: { current: null },
      recommendation: { current: null },
      plus: { current: null },
      minus: { current: null },
      points: { current: null },
      near: { current: null },
      popular: { current: null },
      excursions: { current: null },
    }

    await act(async () => {
      renderer.create(
        <Suspense fallback={null}>
          <TravelDeferredSections
            travel={travel}
            isMobile={false}
            forceOpenKey={null}
            anchors={anchors}
            scrollY={new Animated.Value(0)}
            viewportHeight={900}
            scrollToMapSection={() => {}}
          />
        </Suspense>,
      )
      await Promise.resolve()
    })

    expect(mockUseProgressiveLoad).toHaveBeenCalled()
    expect(mockUseProgressiveLoad).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        priority: 'low',
        rootMargin: '0px',
        threshold: 0.15,
        disableFallbackOnWeb: true,
      }),
    )
  })
})
