/**
 * @jest-environment jsdom
 */

import React, { Suspense } from 'react'
import renderer, { act } from 'react-test-renderer'
import { Animated, Platform } from 'react-native'

const mockAuthorCardSpy: jest.Mock<any, any> = jest.fn(() => null)
const mockMapSectionSpy: jest.Mock<any, any> = jest.fn(() => null)
const mockSidebarSectionSpy: jest.Mock<any, any> = jest.fn(() => null)
const mockFooterSectionSpy: jest.Mock<any, any> = jest.fn(() => null)
const mockCommentsSectionSpy: jest.Mock<any, any> = jest.fn(() => null)

jest.mock('@/components/travel/AuthorCard', () => ({
  __esModule: true,
  default: (props: any) => mockAuthorCardSpy(props),
}))

jest.mock('@/components/travel/ShareButtons', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('@/components/travel/CommentsSection', () => ({
  __esModule: true,
  CommentsSection: (props: any) => mockCommentsSectionSpy(props),
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
  TravelDetailsMapSection: (props: any) => mockMapSectionSpy(props),
}))

jest.mock('@/components/travel/details/sections/TravelDetailsSidebarSection', () => ({
  __esModule: true,
  TravelDetailsSidebarSection: (props: any) => mockSidebarSectionSpy(props),
}))

jest.mock('@/components/travel/details/sections/TravelDetailsFooterSection', () => ({
  __esModule: true,
  TravelDetailsFooterSection: (props: any) => mockFooterSectionSpy(props),
}))

jest.mock('@/hooks/useTdTrace', () => ({
  useTdTrace: () => jest.fn(),
}))

describe('TravelDeferredSections (web author defer)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    Platform.OS = 'web'
    Platform.select = (obj: any) => obj.web || obj.default
    mockAuthorCardSpy.mockClear()
    mockMapSectionSpy.mockClear()
    mockSidebarSectionSpy.mockClear()
    mockFooterSectionSpy.mockClear()
    mockCommentsSectionSpy.mockClear()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('keeps author card deferred during the early no-interaction window', async () => {
    const { TravelDeferredSections } = require('@/components/travel/details/TravelDetailsDeferred')

    const travel: any = {
      id: 1,
      name: 'Deferred author travel',
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
      jest.advanceTimersByTime(10000)
      await Promise.resolve()
    })

    expect(mockAuthorCardSpy).not.toHaveBeenCalled()

    await act(async () => {
      jest.advanceTimersByTime(15000)
      jest.runOnlyPendingTimers()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockAuthorCardSpy).toHaveBeenCalled()
  })

  it('keeps map, sidebar, comments and footer deferred during the early no-interaction window', async () => {
    const { TravelDeferredSections } = require('@/components/travel/details/TravelDetailsDeferred')

    const travel: any = {
      id: 2,
      name: 'Deferred below the fold travel',
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
      jest.advanceTimersByTime(10000)
      await Promise.resolve()
    })

    expect(mockMapSectionSpy).not.toHaveBeenCalled()
    expect(mockSidebarSectionSpy).not.toHaveBeenCalled()
    expect(mockCommentsSectionSpy).not.toHaveBeenCalled()
    expect(mockFooterSectionSpy).not.toHaveBeenCalled()

    await act(async () => {
      jest.advanceTimersByTime(17000)
      jest.runOnlyPendingTimers()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockMapSectionSpy).toHaveBeenCalled()
    expect(mockSidebarSectionSpy).toHaveBeenCalled()
    expect(mockCommentsSectionSpy).toHaveBeenCalled()
    expect(mockFooterSectionSpy).toHaveBeenCalled()
  })
})
