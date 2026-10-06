import type { Root } from 'react-dom/client'
import type { PublicTrip } from '@/api/publicTrips'
import type { ScreenMetrics } from '../../../e2e/helpers/mobileScreenBudget'

let ReactActual: typeof import('react')
let createRoot: typeof import('react-dom/client').createRoot
let Catalog: typeof import('@/components/trips/PublicTripsCatalog').default
let budgetHelpers: typeof import('../../../e2e/helpers/mobileScreenBudget')
let mockResult: { data: PublicTrip[]; isLoading: boolean; isError: boolean }

beforeAll(() => {
  jest.resetModules()
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 390 })
  Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 844 })
  jest.doMock('react-native', () => jest.requireActual('react-native-web'))
  jest.doMock('@expo/vector-icons/Feather', () => () => null)
  jest.doMock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
  jest.doMock('@/hooks/useTheme', () => ({ useThemedColors: () => new Proxy({}, { get: () => '#222222' }) }))
  jest.doMock('@/hooks/usePublicTripsApi', () => ({ usePublicTrips: () => mockResult }))
  jest.doMock('@/utils/tripAnalytics', () => ({ trackTripCatalogViewed: jest.fn() }))
  jest.doMock('@/i18n', () => ({ translate: (key: string) => key }))
  jest.doMock('@/components/layout/ScreenHeaderContext', () => ({ useScreenHeader: (value: unknown) => value }))
  for (const module of ['@/components/ui/ScreenHeader', '@/components/ui/SafetyNotice', '@/components/trips/PublicTripCard']) {
    jest.doMock(module, () => () => null)
  }
  jest.doMock('@/components/trips/PublicTripFilters', () => (props: { onChange: (filters: { region: string }) => void }) =>
    require('react').createElement('button', { onClick: () => props.onChange({ region: 'missing' }) }, 'Filter'))
  jest.doMock('@/components/ui/EmptyState', () => (props: { testID: string; action?: { testID: string } }) =>
    require('react').createElement('div', { 'data-testid': props.testID },
      props.action ? require('react').createElement('button', { 'data-testid': props.action.testID }, 'Reset') : null))
  jest.doMock('@playwright/test', () => ({ expect: jest.fn() }))
  jest.doMock('../../../e2e/helpers/navigation', () => ({ gotoWithRetry: jest.fn(), preacceptCookies: jest.fn() }))
  ReactActual = require('react')
  ;({ createRoot } = require('react-dom/client'))
  Catalog = require('@/components/trips/PublicTripsCatalog').default
  budgetHelpers = require('../../../e2e/helpers/mobileScreenBudget')
})

const trip = { id: 1, title: 'Minsk', description: '', region: 'Minsk', tripType: 'car', organizer: { name: 'Julia' }, startDate: '2026-10-10', featured: false } as PublicTrip
let container: HTMLDivElement
let root: Root
beforeEach(() => {
  mockResult = { data: [trip], isLoading: false, isError: false }
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})
afterEach(async () => {
  await ReactActual.act(async () => root.unmount())
  container.remove()
})

const metrics = (): ScreenMetrics => ({
  screen: 'trips', path: '/trips', viewport: '390x844', theme: 'light',
  firstContentTopRatio: null, pinnedChromeRatio: null, titleOccurrences: 1,
  searchboxCount: container.querySelectorAll('input[role="searchbox"]').length,
  publicTripsUnfilteredEmpty: budgetHelpers.isPublicTripsUnfilteredEmpty(container),
  ctaOccluded: false, darkBottomMatchesTheme: null, unlabeledInteractive: 0,
  emptyCtaDockGap: null, brandRowVisible: false,
})

it('actual populated catalog requires its RNW input role: removal fails and restoration passes', async () => {
  await ReactActual.act(async () => root.render(ReactActual.createElement(Catalog)))
  const input = container.querySelector<HTMLInputElement>('[data-testid="public-trips-search-input"]')!
  expect(input).not.toBeNull()
  expect(input.getAttribute('aria-label')).toBeTruthy()
  expect(container.querySelector('[data-testid="public-trips-controls-scroll"]')).not.toBeNull()
  expect(metrics().publicTripsUnfilteredEmpty).toBe(false)
  expect(metrics().searchboxCount).toBe(1)
  expect(budgetHelpers.assertWithinBudget(metrics(), budgetHelpers.MOBILE_SCREEN_BUDGET.trips)).toEqual([])
  input.removeAttribute('role')
  expect(metrics().publicTripsUnfilteredEmpty).toBe(false)
  expect(budgetHelpers.assertWithinBudget(metrics(), budgetHelpers.MOBILE_SCREEN_BUDGET.trips).join()).toContain('searchboxCount ожидалось 1, стало 0')
  input.setAttribute('role', 'searchbox')
  expect(budgetHelpers.assertWithinBudget(metrics(), budgetHelpers.MOBILE_SCREEN_BUDGET.trips)).toEqual([])
})

it('actual resolved unfiltered empty catalog omits controls and proves the zero-field state', async () => {
  mockResult.data = []
  await ReactActual.act(async () => root.render(ReactActual.createElement(Catalog)))
  expect(metrics()).toMatchObject({ publicTripsUnfilteredEmpty: true, searchboxCount: 0 })
  expect(budgetHelpers.assertWithinBudget(metrics(), budgetHelpers.MOBILE_SCREEN_BUDGET.trips)).toEqual([])
})

it.each(['isLoading', 'isError'] as const)('does not exempt the actual %s catalog', async (state) => {
  mockResult = { data: [], isLoading: false, isError: false, [state]: true }
  await ReactActual.act(async () => root.render(ReactActual.createElement(Catalog)))
  expect(metrics().publicTripsUnfilteredEmpty).toBe(false)
  expect(budgetHelpers.assertWithinBudget(metrics(), budgetHelpers.MOBILE_SCREEN_BUDGET.trips).join()).toContain('searchboxCount ожидалось 1, стало 0')
})

it('actual filtered empty results retain the search and cannot claim the no-controls exception', async () => {
  await ReactActual.act(async () => root.render(ReactActual.createElement(Catalog)))
  mockResult.data = []
  await ReactActual.act(async () => container.querySelector('button')!.click())
  expect(container.querySelector('[data-testid="public-trips-reset-empty"]')).not.toBeNull()
  expect(metrics()).toMatchObject({ publicTripsUnfilteredEmpty: false, searchboxCount: 1 })
  expect(budgetHelpers.assertWithinBudget(metrics(), budgetHelpers.MOBILE_SCREEN_BUDGET.trips)).toEqual([])
})
