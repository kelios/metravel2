import type { PlannedTrip } from '@/api/plannedTrips'

let createElement: typeof import('react').createElement
let renderToStaticMarkup: typeof import('react-dom/server').renderToStaticMarkup
let StyleSheet: { getSheet: () => { textContent: string } }
let MyCreatedTripsList: typeof import('@/components/trips/MyCreatedTripsList').default
let colors: ReturnType<typeof import('@/constants/designSystem').getThemedColors>
let mockDesktop = false
let mockPending = true
let mockWidth = 390
let mockTripOverrides: Partial<PlannedTrip> = {}
let formatTripDateTime: typeof import('@/components/trips/planning/tripPlanFormatting').formatTripDateTime
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
  jest.doMock('@/hooks/useResponsive', () => ({ useResponsive: () => ({ width: mockDesktop ? 1280 : mockWidth, isDesktop: mockDesktop, isPhone: !mockDesktop, isLargePhone: false }), useBreakpoints: () => ({ isPhone: !mockDesktop, isDesktop: mockDesktop }) }))
  jest.doMock('@/hooks/useAuthedQuerySettled', () => ({ useAuthedQuerySettled: () => !mockPending }))
  jest.doMock('@/hooks/usePlannedTripsApi', () => ({ useMyPlannedTrips: () => ({ data: mockPending ? undefined : [makeTrip({ id: 59, title: 'Поездка', ...mockTripOverrides })], isPending: mockPending, isError: false, refetch: () => undefined }), useDeletePlannedTrip: () => ({ mutate: mockDelete, isPending: false }) }))
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
  ;({ formatTripDateTime } = require('@/components/trips/planning/tripPlanFormatting'))
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


const allDeclarations = (node: Element) => [...node.classList].map(name => StyleSheet.getSheet().textContent.match(new RegExp(`\\.${name}\\{([^}]*)\\}`))?.[1] || '').join(';') + ';' + (node.getAttribute('style') || '')
const actualText = (host: HTMLElement, text: string) => [...host.querySelectorAll<HTMLElement>('*')].find(node => node.childElementCount === 0 && node.textContent === text)!
const skeletonSlot = (host: HTMLElement, minHeight: number) => [...host.querySelectorAll<HTMLElement>('*')].find(node => allDeclarations(node).includes(`min-height:${minHeight}px;`))!

it.each([320, 390])('shared real text slots survive short/long content at mobile width%s without metadata clipping', width => {
  mockDesktop = false
  mockWidth = width
  for (const title of ['Поездка', 'Поездка по городам с длинным названием и историческими достопримечательностями']) {
    mockTripOverrides = { title, startDate: '2026-09-26', endDate: '2026-10-04', startTime: '09:00' }
    mockPending = true
    const loading = render()
    mockPending = false
    const loaded = render()
    const realTitle = actualText(loaded, title)
    const metadataText = `На машине · ${formatTripDateTime('2026-09-26', '09:00', '2026-10-04')}`
    const realMeta = actualText(loaded, metadataText)
    expect(realTitle).toBeTruthy()
    expect(realMeta).toBeTruthy()
    const titleSkeleton = skeletonSlot(loading, 36)
    const metaSkeleton = skeletonSlot(loading, 32)
    expect(titleSkeleton).toBeTruthy()
    expect(metaSkeleton).toBeTruthy()
    expect(titleSkeleton.textContent).toBe('\u00a0\n\u00a0')
    expect(metaSkeleton.textContent).toBe('\u00a0\n\u00a0')
    for (const [real, placeholder, lineHeight, minimum] of [[realTitle, titleSkeleton, 18, 36], [realMeta, metaSkeleton, 16, 32]] as const) {
      expect(allDeclarations(real)).toContain(`line-height:${lineHeight}px;`)
      expect(allDeclarations(real)).toContain(`min-height:${minimum}px;`)
      expect(allDeclarations(placeholder)).toContain(`line-height:${lineHeight}px;`)
      expect(allDeclarations(placeholder)).toContain(`min-height:${minimum}px;`)
      expect(allDeclarations(real).split(';')).not.toContain(`height:${minimum}px`)
    }
    expect(allDeclarations(realMeta)).not.toMatch(/line-clamp|text-overflow:ellipsis|overflow:(?:hidden|clip)/)
    expect(realMeta.textContent).toBe(metadataText)
    expect(geometry(media(loading.querySelector('[data-testid="trip-plan-card-skeleton-frame"]')!))).toBe(geometry(media(loaded.querySelector('[data-testid="trip-plan-card-59"]')!)))
  }
  mockTripOverrides = {}
  mockWidth = 390
})

it('keeps metadata of more than two explicit lines intact and growable', () => {
  // Actual shared style's minimum does not become a fixed maximum/clamp.
  // This checks emitted consumer CSS; real pixel wrapping is browser acceptance.
  mockDesktop = false; mockPending = false
  const metadata = 'На машине · строка1\nстрока2\nстрока3'
  const host = document.createElement('div')
  const { Text } = require('react-native')
  const { createTripPlanCardStyles } = require('@/components/trips/planning/TripPlanCard.styles')
  host.innerHTML = renderToStaticMarkup(createElement(Text, { style: createTripPlanCardStyles(colors).meta }, metadata))
  const text = actualText(host, metadata)
  expect(text.textContent).toBe(metadata)
  expect(allDeclarations(text)).toContain('min-height:32px;')
  expect(allDeclarations(text).split(';')).not.toContain('height:32px')
  expect(allDeclarations(text)).not.toMatch(/max-height|line-clamp|text-overflow:ellipsis|overflow:(?:hidden|clip)/)
})
