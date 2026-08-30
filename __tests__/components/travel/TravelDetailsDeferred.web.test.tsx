import { Suspense } from 'react';
import renderer, { act } from 'react-test-renderer'
import { Animated, Platform, StyleSheet } from 'react-native'

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
  hasResolvableAuthor: () => false,
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
  AuthorSectionSkeleton: () => null,
  CommentsSkeleton: () => null,
  FooterSectionSkeleton: () => null,
  MapSectionSkeleton: () => null,
  RatingSectionSkeleton: () => null,
  SidebarSectionSkeleton: () => null,
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

// Advancing timers past the author/rating fallback mounts sections that need
// app providers; they are irrelevant to the deferred reserve contract.
jest.mock('@/components/travel/details/TravelPeerBadgesSection', () => ({
  __esModule: true,
  default: () => null,
  TravelPeerBadgesSection: () => null,
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

  it('skips author card on desktop web (author is in sidebar)', async () => {
    const { TravelDeferredSections } = require('@/components/travel/details/TravelDetailsDeferred.tsx')

    const travel: any = {
      id: 1,
      name: 'Immediate author travel',
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

    // On desktop, author is shown in the sidebar (CompactSideBarTravel),
    // so DesktopAuthorSection returns null and AuthorCard is not rendered here.
    expect(mockAuthorCardSpy).not.toHaveBeenCalled()
  })

  it('keeps heavy sections deferred while resolving the footer in the post-LCP tree', async () => {
    const {
      TravelDeferredSections,
      shouldLoadFooterSectionForPlatform,
    } = require('@/components/travel/details/TravelDetailsDeferred.tsx')

    expect(shouldLoadFooterSectionForPlatform('web', false)).toBe(true)
    expect(shouldLoadFooterSectionForPlatform('ios', false)).toBe(false)
    expect(shouldLoadFooterSectionForPlatform('android', true)).toBe(true)

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
      jest.advanceTimersByTime(400)
      await Promise.resolve()
    })

    expect(mockMapSectionSpy).not.toHaveBeenCalled()
    expect(mockSidebarSectionSpy).not.toHaveBeenCalled()
    expect(mockCommentsSectionSpy).not.toHaveBeenCalled()
  })

  it('renders sidebar and comments immediately when opened via section navigation', async () => {
    const { TravelDeferredSections } = require('@/components/travel/details/TravelDetailsDeferred.tsx')

    const travel: any = {
      id: 4,
      name: 'Deferred force-open travel',
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
            forceOpenKey="near"
            anchors={anchors}
            scrollY={new Animated.Value(0)}
            viewportHeight={900}
            scrollToMapSection={() => {}}
          />
        </Suspense>,
      )
      await Promise.resolve()
    })

    // forceOpenKey='near' makes the deferred wrapper mount the sidebar section
    // (the sidebar itself doesn't consume forceOpenKey — loading is decided here).
    expect(mockSidebarSectionSpy).toHaveBeenCalled()

    mockSidebarSectionSpy.mockClear()
    mockCommentsSectionSpy.mockClear()

    await act(async () => {
      renderer.create(
        <Suspense fallback={null}>
          <TravelDeferredSections
            travel={travel}
            isMobile={false}
            forceOpenKey="comments"
            anchors={anchors}
            scrollY={new Animated.Value(0)}
            viewportHeight={900}
            scrollToMapSection={() => {}}
          />
        </Suspense>,
      )
      await Promise.resolve()
    })

    expect(mockCommentsSectionSpy).toHaveBeenCalled()
  })

  it('keeps comments loadable even when travel metadata has no comment thread fields', async () => {
    const { TravelDeferredSections } = require('@/components/travel/details/TravelDetailsDeferred.tsx')

    const travel: any = {
      id: 5,
      name: 'Deferred comments metadata travel',
      description: '<p>Test description</p>',
      gallery: [],
      youtube_link: null,
      recommendation: '',
      plus: '',
      minus: '',
      rating: 0,
      rating_count: 0,
      user_rating: null,
      comments_count: null,
      comment_count: null,
      thread_id: null,
      comment_thread_id: null,
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
            forceOpenKey="comments"
            anchors={anchors}
            scrollY={new Animated.Value(0)}
            viewportHeight={900}
            scrollToMapSection={() => {}}
          />
        </Suspense>,
      )
      await Promise.resolve()
    })

    expect(mockCommentsSectionSpy.mock.calls).toEqual(
      expect.arrayContaining([
        [
          expect.objectContaining({
            autoload: true,
            canLoadComments: true,
            lazyLoad: true,
          }),
          undefined,
        ],
      ]),
    )
  })

  it('holds the web sidebar/comments reserve until the real frame stops resizing', async () => {
    const { TravelDeferredSections } = require('@/components/travel/details/TravelDetailsDeferred.tsx')
    const travel: any = {
      id: 6,
      name: 'Stable deferred upstream travel',
      description: '<p>Test description</p>',
      gallery: [],
    }
    const anchors: any = {
      comments: { current: null },
      description: { current: null },
      excursions: { current: null },
      gallery: { current: null },
      map: { current: null },
      minus: { current: null },
      near: { current: null },
      plus: { current: null },
      points: { current: null },
      popular: { current: null },
      recommendation: { current: null },
      video: { current: null },
    }
    const layoutEvent = (height: number) => ({
      nativeEvent: { layout: { height, width: 920, x: 0, y: 0 } },
    })
    const transitionOf = (tree: renderer.ReactTestRenderer, testID: string) =>
      tree.root
        .findAllByProps({ testID })
        .find((node) => node.props.dataSet?.deferredTransitionState != null)!

    let sidebarTree: renderer.ReactTestRenderer
    await act(async () => {
      sidebarTree = renderer.create(
        <Suspense fallback={null}>
          <TravelDeferredSections
            travel={travel}
            isMobile={false}
            forceOpenKey="near"
            anchors={anchors}
            scrollToMapSection={() => {}}
          />
        </Suspense>,
      )
      await Promise.resolve()
    })

    const sidebarTransition = transitionOf(sidebarTree!, 'travel-details-sidebar-transition')
    expect(sidebarTransition.props.dataSet.deferredTransitionState).toBe('measuring-runtime')
    expect(StyleSheet.flatten(sidebarTransition.props.style).minHeight).toBe('100vh')

    const sidebarRuntimeLayout = mockSidebarSectionSpy.mock.calls.at(-1)?.[0]?.onRuntimeFrameReady
    expect(sidebarRuntimeLayout).toEqual(expect.any(Function))

    // First real frame is not the settled frame: `Популярные` is still growing.
    await act(async () => {
      sidebarRuntimeLayout(layoutEvent(300))
      jest.advanceTimersByTime(200)
    })
    expect(sidebarTransition.props.dataSet.deferredTransitionState).toBe('measuring-runtime')
    expect(StyleSheet.flatten(sidebarTransition.props.style).minHeight).toBe('100vh')

    // A new height restarts the quiet window instead of releasing the reserve.
    await act(async () => {
      sidebarRuntimeLayout(layoutEvent(548))
      jest.advanceTimersByTime(200)
    })
    expect(sidebarTransition.props.dataSet.deferredTransitionState).toBe('measuring-runtime')

    await act(async () => {
      jest.advanceTimersByTime(400)
    })
    expect(sidebarTransition.props.dataSet.deferredTransitionState).toBe('runtime')
    expect(StyleSheet.flatten(sidebarTransition.props.style).minHeight).toBeUndefined()

    mockCommentsSectionSpy.mockClear()
    let commentsTree: renderer.ReactTestRenderer
    await act(async () => {
      commentsTree = renderer.create(
        <Suspense fallback={null}>
          <TravelDeferredSections
            travel={travel}
            isMobile={false}
            forceOpenKey="comments"
            anchors={anchors}
            scrollToMapSection={() => {}}
          />
        </Suspense>,
      )
      await Promise.resolve()
    })

    const commentsTransition = transitionOf(commentsTree!, 'travel-details-comments-transition')
    expect(commentsTransition.props.dataSet.deferredTransitionState).toBe('measuring-runtime')
    expect(StyleSheet.flatten(commentsTransition.props.style).minHeight).toBe('100vh')

    // A section whose data never arrives must still become interactive: the
    // fail-open timeout releases the reserve without a single layout event.
    await act(async () => {
      jest.advanceTimersByTime(6000)
    })
    expect(commentsTransition.props.dataSet.deferredTransitionState).toBe('runtime')
    expect(StyleSheet.flatten(commentsTransition.props.style).minHeight).toBeUndefined()
  })
})
