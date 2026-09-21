import React, { act, createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { View } from 'react-native'

import type { Travel } from '@/types/types'
import type { AnchorsMap } from '@/components/travel/details/TravelDetailsTypes'
import { TravelHeroSection } from '@/components/travel/details/TravelDetailsHero'
import { TravelDetailsContentSection } from '@/components/travel/details/sections/TravelDetailsContentSection'
import { TravelDetailsMapSection } from '@/components/travel/details/sections/TravelDetailsMapSection'
import { TravelDetailsSidebarSection } from '@/components/travel/details/sections/TravelDetailsSidebarSection'
import { TravelDeferredSections } from '@/components/travel/details/TravelDetailsDeferred'
import { buildTravelSectionLinks } from '@/components/travel/sectionLinks'
import { useActiveSection } from '@/hooks/useActiveSection'

// The native Jest View accepts arbitrary props; RNW deliberately drops raw data-*.
// Keep the real web primitives and section wrappers so this catches that boundary.
jest.mock('react-native', () => jest.requireActual('react-native-web'))
jest.mock('@/components/travel/details/TravelDetailsStyles', () => ({ useTravelDetailsStyles: () => ({}) }))
jest.mock('@/components/travel/details/TravelDetailsHeroStyles', () => ({ useTravelDetailsHeroStyles: () => ({}) }))
jest.mock('@/hooks/useTheme', () => ({ useThemedColors: () => ({}) }))
jest.mock('@/hooks/useProgressiveLoading', () => ({
  useProgressiveLoad: () => ({ shouldLoad: false, setElementRef: jest.fn() }),
}))
jest.mock('@/hooks/useCountryCodeByCoords', () => ({ useCountryCodeByCoords: () => 'BY' }))
jest.mock('@/components/belkraj/belkrajAvailability', () => ({ canRenderBelkrajWidget: () => true }))
jest.mock('@/components/affiliate/affiliateConfig', () => ({
  isAffiliateEnabled: () => true,
  getAffiliateOffers: () => [{ id: 'offer' }],
}))
jest.mock('@/components/affiliate/AffiliateOffers', () => () => null)
jest.mock('@/components/belkraj/BelkrajWidget', () => () => null)
jest.mock('@/components/travel/TravelDescription', () => () => null)
jest.mock('@/components/travel/PointList', () => () => null)
jest.mock('@/components/travel/NearTravelList', () => () => null)
jest.mock('@/components/travel/PopularTravelList', () => () => null)
jest.mock('@/components/travel/NavigationArrows', () => () => null)
jest.mock('@/components/travel/ToggleableMapSection', () => () => null)
jest.mock('@/components/travel/details/sections/TravelWeatherBlock', () => () => null)
jest.mock('@/components/travel/details/sections/DeferredQuestForCitySection', () => () => null)
jest.mock('@/components/travel/details/sections/TravelRegisterCtaSection', () => () => null)
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
  SidebarSectionSkeleton: () => null,
}))
jest.mock('@/components/travel/details/TravelAuthorQuickLink', () => () => null)
jest.mock('@/components/travel/details/TravelHeroSlots', () => ({
  TravelHeroExtrasSlot: () => null,
  TravelHeroFavoriteToggleSlot: () => null,
  TravelHeroInteractiveSliderSlot: () => null,
}))
jest.mock('@/components/travel/details/TravelDetailsOptimizedLCPHero', () => ({
  OptimizedLCPHero: () => null,
  OVERLAY_TRANSITION_MS: 0,
}))
jest.mock('@/hooks/useTravelHeroState', () => ({
  useTravelHeroState: () => ({ firstImg: { id: 1, url: '/image.jpg' }, heroHeight: 600, extrasReady: true }),
}))
jest.mock('@/components/travel/details/useTravelSsgHeroHandoff', () => ({
  useTravelSsgHeroHandoff: () => ({ active: false }),
}))
jest.mock('@/components/travel/details/hooks/useTravelDetailsHeroCompositionModel', () => ({
  useTravelDetailsHeroCompositionModel: () => ({}),
}))
jest.mock('@/components/travel/details/hooks/useTravelHeroExtrasModel', () => ({
  useTravelHeroExtrasModel: () => ({ quickJumpLinks: [], showQuickJumps: false }),
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
    const expectedKeys = [...navigationKeys, 'rating', 'affiliate'].sort()
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
