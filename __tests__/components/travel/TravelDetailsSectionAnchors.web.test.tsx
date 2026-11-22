import type React from 'react'
import type { Root } from 'react-dom/client'

import type { Travel } from '@/types/types'
import type { AnchorsMap } from '@/components/travel/details/TravelDetailsTypes'

// The native Jest View accepts arbitrary props; RNW deliberately drops raw data-*.
// Keep the real web primitives and section wrappers so this catches that boundary.
// `__tests__/setup.ts` already required its own `react-native` mock (via the
// gesture-handler jest setup), so a hoisted `jest.mock` here would lose to the cached
// module: load RNW and everything that renders through it from a fresh registry.
// jest-expo also resolves `.native.tsx` first, so pin the web files of the sections
// that have a native twin — otherwise the test would read native markup.
const WEB_VARIANT_MODULES = [
  '@/components/travel/details/TravelDetailsDeferred',
  '@/components/travel/details/TravelDetailsDeferredRuntimeSlot',
  '@/components/travel/details/sections/TravelRouteMapBlock',
]
let act: typeof import('react').act
let createRef: typeof import('react').createRef
let createRoot: typeof import('react-dom/client').createRoot
let View: typeof import('react-native').View
let TravelHeroSection: typeof import('@/components/travel/details/TravelDetailsHero').TravelHeroSection
let TravelDetailsContentSection: typeof import('@/components/travel/details/sections/TravelDetailsContentSection').TravelDetailsContentSection
let TravelDetailsMapSection: typeof import('@/components/travel/details/sections/TravelDetailsMapSection').TravelDetailsMapSection
let TravelDetailsSidebarSection: typeof import('@/components/travel/details/sections/TravelDetailsSidebarSection').TravelDetailsSidebarSection
let TravelDeferredSections: typeof import('@/components/travel/details/TravelDetailsDeferred').TravelDeferredSections
let buildTravelSectionLinks: typeof import('@/components/travel/sectionLinks').buildTravelSectionLinks
let useActiveSection: typeof import('@/hooks/useActiveSection').useActiveSection

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  for (const modulePath of WEB_VARIANT_MODULES) {
    jest.doMock(modulePath, () => jest.requireActual(`${modulePath}.tsx`))
  }
  ;({ act, createRef } = require('react'))
  ;({ createRoot } = require('react-dom/client'))
  ;({ View } = require('react-native'))
  ;({ TravelHeroSection } = require('@/components/travel/details/TravelDetailsHero'))
  ;({ TravelDetailsContentSection } = require('@/components/travel/details/sections/TravelDetailsContentSection'))
  ;({ TravelDetailsMapSection } = require('@/components/travel/details/sections/TravelDetailsMapSection'))
  ;({ TravelDetailsSidebarSection } = require('@/components/travel/details/sections/TravelDetailsSidebarSection'))
  ;({ TravelDeferredSections } = require('@/components/travel/details/TravelDetailsDeferred'))
  ;({ buildTravelSectionLinks } = require('@/components/travel/sectionLinks'))
  ;({ useActiveSection } = require('@/hooks/useActiveSection'))
})

jest.mock('@/components/travel/details/TravelDetailsStyles', () => ({ useTravelDetailsStyles: () => ({}) }))
jest.mock('@/components/travel/details/TravelDetailsHeroStyles', () => ({
  // Шкала слоёв hero (#2116) — данные, не стили: берём настоящую.
  TRAVEL_HERO_LAYERS: jest.requireActual('@/components/travel/details/TravelDetailsHeroStyles').TRAVEL_HERO_LAYERS,
  useTravelDetailsHeroStyles: () => ({}),
}))
jest.mock('@/hooks/useTravelView', () => ({ ...jest.requireActual('@/hooks/useTravelView'), useTravelView: () => {} }))
jest.mock('@/hooks/useTheme', () => ({ useThemedColors: () => ({}) }))
jest.mock('@/hooks/useProgressiveLoading', () => ({
  useProgressiveLoad: () => ({ shouldLoad: false, setElementRef: jest.fn() }),
}))
jest.mock('@/components/belkraj/belkrajAvailability', () => ({ canRenderBelkrajWidget: () => true }))
jest.mock('@/components/belkraj/BelkrajWidget', () => () => null)
jest.mock('@/components/travel/TravelDescription', () => () => null)
jest.mock('@/components/travel/PointList', () => () => null)
jest.mock('@/components/travel/NearTravelList', () => () => null)
jest.mock('@/components/travel/PopularTravelList', () => () => null)
jest.mock('@/components/travel/NavigationArrows', () => () => null)
jest.mock('@/components/travel/ToggleableMapSection', () => () => null)
jest.mock('@/components/travel/details/sections/TravelWeatherBlock', () => () => null)
jest.mock('@/components/travel/details/sections/DeferredQuestForCitySection', () => () => null)
// Web bundles resolve the `.web` variant of the teaser (loader data, no query);
// jest resolves the default one, so point it at the file the site really ships.
jest.mock('@/components/travel/details/sections/TravelQuestTeaserLine', () =>
  jest.requireActual('@/components/travel/details/sections/TravelQuestTeaserLine.web'))
jest.mock('@/components/travel/details/sections/TravelRegisterCtaSection', () => () => null)
jest.mock('@/components/travel/details/sections/TravelArticleShareTripCta', () => () => null)
jest.mock('@/components/travel/details/sections/TravelPeerBadgePrompt', () => () => null)
jest.mock('@/components/travel/details/sections/YouTubeSectionSlot', () => () => null)
jest.mock('@/components/legal/DataFreshnessNotice', () => () => null)
jest.mock('@/components/ui/Button', () => () => null)
jest.mock('@/components/travel/details/sections/CollapsibleSection', () => ({
  CollapsibleSection: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.mock('@/components/travel/TravelDetailSkeletons', () => ({
  AuthorSectionSkeleton: () => null,
  CommentsSkeleton: () => null,
  FooterSectionSkeleton: () => null,
  MapSectionSkeleton: () => null,
  MapSkeleton: () => null,
  PointListSkeleton: () => null,
  QuickFactsSkeleton: () => null,
  QuickJumpSkeleton: () => null,
  RatingSectionSkeleton: () => null,
}))
jest.mock('@/components/travel/details/TravelAuthorQuickLink', () => () => null)
jest.mock('@/components/travel/details/TravelHeroSlots', () => ({
  TravelHeroExtrasSlot: ({ activeKey }: { activeKey?: string }) =>
    <div data-testid="travel-details-quick-facts" data-active-chip={activeKey} />,
  TravelHeroFavoriteToggleSlot: () => null,
  TravelHeroInteractiveSliderSlot: () => null,
}))
jest.mock('@/components/travel/details/TravelDetailsOptimizedLCPHero', () => ({
  OptimizedLCPHero: () => <img data-testid="lcp-cover" alt="Обложка" />,
  OVERLAY_TRANSITION_MS: 0,
}))
jest.mock('@/hooks/useTravelHeroState', () => ({
  useTravelHeroState: () => ({ firstImg: { id: 1, url: '/image.jpg' }, heroSliderImages: [{ id: 1, url: '/image.jpg', caption: 'Фото маршрута' }], heroHeight: 600, extrasReady: true }),
}))
jest.mock('@/components/travel/details/useTravelSsgHeroHandoff', () => ({
  useTravelSsgHeroHandoff: () => ({ active: false }),
}))
jest.mock('@/components/travel/details/hooks/useTravelDetailsHeroCompositionModel', () => ({
  useTravelDetailsHeroCompositionModel: () => ({ shouldRenderWebOptimizedHero: true }),
}))
jest.mock('@/components/travel/details/hooks/useTravelDetailsMapSectionModel', () => ({
  useTravelDetailsMapSectionModel: () => ({}),
}))
jest.mock('@/components/travel/details/hooks/useTravelDetailsMapSectionContentModel', () => ({
  useTravelDetailsMapSectionContentModel: ({ anchors }: { anchors: AnchorsMap }) => ({
    setMapSectionRef: anchors.map,
    routeFilePoints: [],
    routePreviewItems: [],
  }),
}))
jest.mock('@/components/travel/details/hooks/useTravelRouteMapBlockModel', () => ({
  useTravelRouteMapBlockModel: () => ({ routeFileMarkers: [], routeLines: [], routeProfiles: [] }),
}))
jest.mock('@/components/travel/details/hooks/useTravelDetailsSidebarSectionModel', () => ({
  useTravelDetailsSidebarSectionModel: () => ({ setNearRef: jest.fn(), listsFetching: false }),
}))
jest.mock('@/components/travel/details/hooks/useTravelDeferredSectionsModel', () => ({
  useTravelDeferredSectionsModel: () => ({ setCommentsRef: jest.fn() }),
}))
jest.mock('@/components/travel/details/TravelDeferredAuthorSection', () => () => null)
jest.mock('@/components/travel/details/TravelDeferredRatingSection', () => () => null)
jest.mock('@/components/travel/details/TravelDetailsFooterRuntimeFrame', () => () => null)
jest.mock('@/components/travel/details/TravelDetailsDeferredTransition', () => ({
  TravelDetailsMeasuredFlow: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TravelDetailsDeferredTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDeferredSectionRuntimeSettle: () => ({ settled: false, onRuntimeFrameLayout: jest.fn() }),
}))

const createAnchors = (): AnchorsMap => ({
  gallery: createRef(), video: createRef(), description: createRef(),
  recommendation: createRef(), plus: createRef(), minus: createRef(),
  map: createRef(), points: createRef(), near: createRef(), popular: createRef(),
  excursions: createRef(), comments: createRef(),
})
const travel = {
  id: 2024,
  name: 'Маршрут',
  slug: 'route',
  description: '<p>Описание</p>',
  recommendation: '<p>Советы</p>',
  plus: '<p>Плюсы</p>',
  minus: '<p>Минусы</p>',
  gallery: [{ id: 1, url: '/image.jpg' }],
  youtube_link: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
  countryName: 'Беларусь',
  countryCode: 'BY',
  travelAddress: [{ id: 1, coord: '53.9,27.56', address: 'Минск' }],
} as Travel

function Sections({ anchors, isMobile }: { anchors: AnchorsMap; isMobile: boolean }) {
  return <>
    <TravelHeroSection travel={travel} anchors={anchors} isMobile={isMobile}
      onFirstImageLoad={jest.fn()} sectionLinks={[]} onQuickJump={jest.fn()} />
    <TravelDetailsContentSection travel={travel} anchors={anchors} isMobile={isMobile} forceOpenKey={null} />
    <TravelDetailsMapSection travel={travel} anchors={anchors} canRenderHeavy scrollToMapSection={jest.fn()} />
    <TravelDetailsSidebarSection travel={travel} anchors={anchors} canRenderHeavy />
    <TravelDeferredSections travel={travel} anchors={anchors} isMobile={isMobile}
      forceOpenKey={null} scrollToMapSection={jest.fn()} />
  </>
}

function DelayedSidebar({ anchors, visible }: { anchors: AnchorsMap; visible: boolean }) {
  const { activeSection } = useActiveSection(anchors, 72)
  return <>
    <output data-testid="active-section">{activeSection}</output>
    {visible && <TravelDetailsSidebarSection travel={travel} anchors={anchors} canRenderHeavy />}
  </>
}

describe('travel section anchors in the real React Native Web DOM (#2024)', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    jest.useFakeTimers()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  it('uses the RNW prop filter, which drops raw data-section-key', async () => {
    await act(async () => root.render(<View data-section-key="raw" />))
    expect(container.firstElementChild?.tagName).toBe('DIV')
    expect(container.querySelector('[data-section-key]')).toBeNull()
  })

  it.each([false, true])('renders every section marker at mount, isMobile=%s', async (isMobile) => {
    const anchors = createAnchors()
    // No useTravelDetailsNavigation and no timer advancement can repair these props.
    await act(async () => root.render(<Sections anchors={anchors} isMobile={isMobile} />))
    const navigationKeys = buildTravelSectionLinks(travel, { platform: 'web' }).map(({ key }) => key)
    const expectedKeys = [...navigationKeys, 'rating'].sort()
    const elements = Array.from(container.querySelectorAll<HTMLElement>('[data-section-key]'))
    expect(elements.map((element) => element.dataset.sectionKey).sort()).toEqual(expectedKeys)
    for (const key of navigationKeys) {
      expect(container.querySelector(`[data-section-key="${key}"]`)).toBe(anchors[key as keyof AnchorsMap].current)
    }
    expect(container.querySelector('[data-map-for-pdf="1"]')).not.toBeNull()
  })

  it('does not create content or points anchors for missing sections', async () => {
    const emptyTravel = { ...travel, description: '', recommendation: '', plus: '', minus: '', youtube_link: '', travelAddress: [] }
    const anchors = createAnchors()
    await act(async () => root.render(<>
      <TravelDetailsContentSection travel={emptyTravel} anchors={anchors} isMobile={false} forceOpenKey={null} />
      <TravelDetailsMapSection travel={emptyTravel} anchors={anchors} canRenderHeavy scrollToMapSection={jest.fn()} />
    </>))
    for (const key of ['description', 'recommendation', 'plus', 'minus', 'video', 'points']) {
      expect(container.querySelector(`[data-section-key="${key}"]`)).toBeNull()
      expect(anchors[key as keyof AnchorsMap].current).toBeNull()
    }
  })

  it('discovers and activates a sidebar mounted after the four-second registration window', async () => {
    const anchors = createAnchors()
    const observe = jest.fn()
    jest.spyOn(window, 'IntersectionObserver').mockImplementation(() => ({
      observe, disconnect: jest.fn(), unobserve: jest.fn(), takeRecords: () => [],
      root: null, rootMargin: '', thresholds: [],
    }))
    await act(async () => root.render(<DelayedSidebar anchors={anchors} visible={false} />))
    await act(async () => jest.advanceTimersByTime(5000))
    await act(async () => root.render(<DelayedSidebar anchors={anchors} visible />))

    const popular = container.querySelector<HTMLElement>('[data-section-key="popular"]')!
    const near = container.querySelector<HTMLElement>('[data-section-key="near"]')!
    expect(popular).toBe(anchors.popular.current)
    expect(near).toBe(anchors.near.current)
    jest.spyOn(near, 'getBoundingClientRect').mockReturnValue({ top: -500, bottom: -100, height: 400 } as DOMRect)
    jest.spyOn(popular, 'getBoundingClientRect').mockReturnValue({ top: 80, bottom: 380, height: 300 } as DOMRect)
    await act(async () => {
      window.dispatchEvent(new Event('scroll'))
      jest.advanceTimersByTime(100)
    })
    expect(observe).toHaveBeenCalledWith(popular)
    expect(container.querySelector('output')?.textContent).toBe('popular')
  })
})

it('hydrates only the tapped photo while scrollspy selects the gallery (#3467)', async () => {
  const { createElement, useLayoutEffect, useState } = require('react') as typeof import('react')
  const { hydrateRoot } = require('react-dom/client') as typeof import('react-dom/client')
  const { renderToString } = require('react-dom/server.node') as typeof import('react-dom/server')
  const Shell = require('@/components/travel/details/TravelDetailsCriticalShell').default
  const { Animated } = require('react-native')
  const props = {
    travel, isMobile: true, screenWidth: 390, wrapperStyle: {}, styles: {},
    skeletonPhase: 'hidden', skeletonFallback: null, scrollRef: { current: null }, scrollViewStyle: {},
    scrollEventHandler: jest.fn(), handleContentSizeChange: jest.fn(), handleLayout: jest.fn(),
    contentHorizontalPadding: 16, anchors: createAnchors(), onFirstImageLoad: jest.fn(),
    sectionLinks: buildTravelSectionLinks(travel, { platform: 'web' }), onQuickJump: jest.fn(),
    deferHeroExtras: false, forceOpenKey: null, closeMenu: jest.fn(), onNavigate: jest.fn(),
    menuWidthNum: 320, animatedX: new Animated.Value(0), sideMenuPlatformStyles: {},
    deferredContent: null, mainAriaLabel: travel.name,
  }
  let selectSection: (key: string) => void
  function Article() {
    const [activeSection, setActiveSection] = useState('')
    // Travel scrollspy picks the gallery as the article mounts.
    useLayoutEffect(() => {
      selectSection = setActiveSection
      setActiveSection('gallery')
    }, [])
    return createElement(Shell, { ...props, activeSection })
  }
  const tree = createElement(Article)
  const host = document.createElement('div')
  host.innerHTML = renderToString(tree)
  document.body.appendChild(host)
  const node = (id: string) => host.querySelector<HTMLElement>(`[data-testid="${id}"]`)!
  const hydrated = (id: string) => Object.keys(node(id)).some(key => key.startsWith('__reactFiber$'))
  const errors: unknown[] = []
  let root: Root | undefined
  try {
    expect(node('travel-details-quick-facts')).not.toBeNull()
    expect(node('lcp-cover').getAttribute('alt')).toBe('Обложка')
    expect(node('slider-caption').textContent).toContain('Фото маршрута')
    act(() => {
      root = hydrateRoot(host, tree, { onRecoverableError: error => errors.push(error) })
      node('travel-details-hero-slider-container').dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
      expect(hydrated('travel-details-hero-slider-container')).toBe(true)
      expect(hydrated('lcp-cover')).toBe(false)
      expect(hydrated('slider-caption')).toBe(false)
      expect(hydrated('travel-details-quick-facts')).toBe(false)
    })
    expect(node('travel-details-quick-facts').dataset.activeChip).toBe('map')
    await act(async () => selectSection('description'))
    expect(node('travel-details-quick-facts').dataset.activeChip).toBe('description')
    expect(errors).toEqual([])
  } finally {
    await act(async () => root?.unmount())
    host.remove()
  }
})
