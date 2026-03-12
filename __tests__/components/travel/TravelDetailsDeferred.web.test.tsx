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
const mockTravelDescriptionSpy: jest.Mock<any, any> = jest.fn(() => null)
type ObserverEntry = {
  callback: IntersectionObserverCallback
  observe: jest.Mock
  disconnect: jest.Mock
}

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
  default: (props: any) => mockTravelDescriptionSpy(props),
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
  const originalIntersectionObserver = global.IntersectionObserver
  let observers: ObserverEntry[] = []

  beforeEach(() => {
    jest.useFakeTimers()
    Platform.OS = 'web'
    Platform.select = (obj: any) => obj.web || obj.default
    observers = []
    class MockIntersectionObserver {
      callback: IntersectionObserverCallback
      observe = jest.fn()
      disconnect = jest.fn()

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback
        observers.push(this as unknown as ObserverEntry)
      }
    }
    ;(global as any).IntersectionObserver = MockIntersectionObserver
    ;(window as any).IntersectionObserver = MockIntersectionObserver
    mockAuthorCardSpy.mockClear()
    mockMapSectionSpy.mockClear()
    mockSidebarSectionSpy.mockClear()
    mockFooterSectionSpy.mockClear()
    mockCommentsSectionSpy.mockClear()
    mockTravelDescriptionSpy.mockClear()
  })

  afterEach(() => {
    jest.useRealTimers()
    ;(global as any).IntersectionObserver = originalIntersectionObserver
    ;(window as any).IntersectionObserver = originalIntersectionObserver
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

    expect(observers.length).toBeGreaterThan(0)

    await act(async () => {
      observers.forEach((observer) => {
        observer.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        )
      })
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

    expect(mockMapSectionSpy).toHaveBeenCalled()
    expect(mockSidebarSectionSpy).not.toHaveBeenCalled()
    expect(mockCommentsSectionSpy).not.toHaveBeenCalled()
    expect(mockFooterSectionSpy).not.toHaveBeenCalled()

    expect(observers.length).toBeGreaterThanOrEqual(5)

    await act(async () => {
      observers.forEach((observer) => {
        observer.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        )
      })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockMapSectionSpy).toHaveBeenCalled()
    expect(mockSidebarSectionSpy).toHaveBeenCalled()
    expect(mockCommentsSectionSpy).toHaveBeenCalled()
    expect(mockFooterSectionSpy).toHaveBeenCalled()
  })

  it('renders recommendations immediately when opened via section navigation', async () => {
    const { TravelDeferredSections } = require('@/components/travel/details/TravelDetailsDeferred')

    const travel: any = {
      id: 3,
      name: 'Deferred insights travel',
      description: '<p>Test description</p>',
      gallery: [],
      youtube_link: null,
      recommendation: '<p>Open this section now</p>',
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
            forceOpenKey="recommendation"
            anchors={anchors}
            scrollY={new Animated.Value(0)}
            viewportHeight={900}
            scrollToMapSection={() => {}}
          />
        </Suspense>,
      )
      await Promise.resolve()
    })

    expect(mockTravelDescriptionSpy.mock.calls).toEqual(
      expect.arrayContaining([
        [
          expect.objectContaining({
            title: 'Рекомендации',
            htmlContent: '<p>Open this section now</p>',
          }),
          undefined,
        ],
      ]),
    )
  })
})
