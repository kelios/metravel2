import type { PlannedTrip } from '@/api/plannedTrips'

let createElement: typeof import('react').createElement
let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup
let StyleSheet: { getSheet: () => { textContent: string } }
let MyCreatedTripsList: typeof import('@/components/trips/MyCreatedTripsList').default
let colors: ReturnType<typeof import('@/constants/designSystem').getThemedColors>
let mockDesktop = false
let mockPending = true
const mockPush = jest.fn()
const mockDelete = jest.fn()

const makeTrip = (overrides: Partial<PlannedTrip>): PlannedTrip => ({
  id: 1,
  slug: 'trip-1',
  title: 'Организуемая поездка',
  description: 'Описание',
  startDate: '2026-08-01',
  startTime: '09:00',
  transport: 'car',
  visibility: 'private',
  seatsTotal: 4,
  startPoint: null,
  status: 'planning',
  organizer: { id: 1, name: 'Юля', avatarUrl: null },
  route: [],
  routeGeometry: null,
  routeSummary: null,
  routingState: null,
  participants: [],
  coverUrl: null,
  region: 'Беларусь',
  publishedToCommunity: false,
  report: null,
  isOwner: true,
  myRsvp: 'going',
  createdAt: '2026-07-09T10:00:00Z',
  ...overrides,
});

beforeAll(() => {
  jest.resetModules()
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  // Animation platform leaf only; actual card/media/content DOM stays intact.
  jest.doMock('react-native-reanimated', () => ({
    __esModule: true,
    default: { View: require('react-native').View },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (factory: () => object) => factory(),
    withSpring: (value: number) => value,
  }))
  jest.doMock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
  jest.doMock('@/hooks/useTheme', () => ({ useThemedColors: () => colors, useTheme: () => ({ isDark: false }) }))
  jest.doMock('@/hooks/useResponsive', () => ({ useResponsive: () => ({ width: mockDesktop ? 1280 : 390, isDesktop: mockDesktop, isPhone: !mockDesktop, isLargePhone: false }), useBreakpoints: () => ({ isPhone: !mockDesktop, isDesktop: mockDesktop }) }))
  jest.doMock('@/hooks/useAuthedQuerySettled', () => ({ useAuthedQuerySettled: () => !mockPending }))
  jest.doMock('@/hooks/usePlannedTripsApi', () => ({ useMyPlannedTrips: () => ({ data: mockPending ? undefined : [makeTrip({ id: 59, title: 'Поездка' })], isPending: mockPending, isError: false, refetch: () => undefined }), useDeletePlannedTrip: () => ({ mutate: mockDelete, isPending: false }) }))
  // External/image/icon leaves only. MyCreatedTripsList, TripPlanCard,
  // TripPlanCardSkeleton and UnifiedTravelCard all render their actual DOM.
  jest.doMock('@expo/vector-icons/Feather', () => {
    const react = require('react'), rn = require('react-native')
    return { __esModule: true, default: ({ size }: { size: number }) => react.createElement(rn.View, { style: { width: size, height: size } }) }
  })
  jest.doMock('@/components/MapPage/MapIcon', () => ({ __esModule: true, default: () => null }))
  jest.doMock('@/components/trips/planning/tripFallbackCover', () => ({ getTripFallbackCover: () => ({ uri: 'fallback.png', key: 'fallback' }) }))
  ;({ createElement } = require('react'))
  ;({ renderToStaticMarkup } = require('react-dom/server.node'))
  ;({ StyleSheet } = require('react-native'))
  colors = require('@/constants/designSystem').getThemedColors(false)
  MyCreatedTripsList = require('@/components/trips/MyCreatedTripsList').default
})

const render = () => {
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(createElement(MyCreatedTripsList))
  return host
}
const geometry = (node: Element) => {
  const declarations = [...node.classList].map(name => StyleSheet.getSheet().textContent.match(new RegExp(`\\.${name}\\{([^}]*)\\}`))?.[1] || '').join(';') + ';' + (node.getAttribute('style') || '')
  return [...new Set(declarations.split(';').filter(v => /^(?:width|height|min-|max-|padding|margin|flex|display|align-|justify-|border-(?:[a-z-]+-)?(?:width|radius))/.test(v)))].sort().join(';')
}
const media = (card: Element) => [card, ...card.querySelectorAll('*')].find(node => geometry(node).split(';').some(rule => rule === 'height:176px'))!

it.each([false, true])('pending and loaded actual trip consumers share shell/frame/media geometry (desktop=%s)', desktop => {
  mockDesktop = desktop; mockPending = true
  const pending = render()
  mockPending = false
  const loaded = render()
  for (const id of ['my-created-trips-list', 'my-created-trips-search']) {
    expect(geometry(pending.querySelector(`[data-testid="${id}"]`)!)).toBe(geometry(loaded.querySelector(`[data-testid="${id}"]`)!))
  }
  expect(pending.querySelector('[data-testid="my-created-trips-search-input"]')?.getAttribute('readonly')).not.toBeNull()
  expect(pending.querySelectorAll('[data-testid="trip-plan-card-skeleton"]')).toHaveLength(2)
  const skeleton = pending.querySelector('[data-testid="trip-plan-card-skeleton-frame"]')!
  const card = loaded.querySelector('[data-testid="trip-plan-card-59"]')!
  expect(card).not.toBeNull()
  expect(geometry(skeleton)).toContain('border')
  expect(geometry(skeleton)).toBe(geometry(card))
  expect(media(skeleton)).toBeTruthy(); expect(media(card)).toBeTruthy()
  expect(geometry(media(skeleton))).toBe(geometry(media(card)))
  expect(pending.querySelector('[data-testid="trip-plan-card-skeleton"]')?.getAttribute('aria-hidden')).toBe('true')
  expect(pending.querySelector('[data-testid="trip-plan-card-skeleton"] [tabindex="0"]')).toBeNull()
  expect(pending.querySelector('[data-testid="my-created-trips-empty"]')).toBeNull()
  expect(mockPush).not.toHaveBeenCalled(); expect(mockDelete).not.toHaveBeenCalled()
})
