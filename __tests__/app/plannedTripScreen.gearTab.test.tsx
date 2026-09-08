import { fireEvent, render } from '@testing-library/react-native'

import type { PlannedTrip } from '@/api/plannedTrips'
import type { TripGearItem } from '@/api/plannedTripsGear'

/**
 * #1839: чеклист снаряжения принадлежит вкладке «Ещё». Тест держит две вещи
 * сразу: блок появляется там, где обещает макет, и НЕ прорастает во вкладку
 * «Маршрут» — она и без него самая тяжёлая на экране.
 *
 * Хуки чеклиста замоканы, а сам компонент — нет: проверяется размещение
 * реального блока, а не заглушки.
 */
const mockUsePlannedTrip = jest.fn()
const mockUseTripGear = jest.fn()

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: '8001' }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}))

jest.mock('@/hooks/usePlannedTripsApi', () => ({
  usePlannedTrip: (...args: unknown[]) => mockUsePlannedTrip(...args),
  useDeletePlannedTrip: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdatePlannedTrip: () => ({ mutate: jest.fn(), isPending: false }),
}))

jest.mock('@/hooks/useResponsive', () => ({ useResponsive: () => ({ isMobile: false }) }))

jest.mock('@/hooks/useTripGearApi', () => ({
  useTripGear: (...args: unknown[]) => mockUseTripGear(...args),
  useAddTripGearItem: () => ({ mutate: jest.fn(), error: null, isPending: false }),
  useApplyTripGearTemplate: () => ({ mutate: jest.fn(), error: null, isPending: false, isSuccess: false, data: undefined }),
  useUpdateTripGearItem: () => ({ mutate: jest.fn(), error: null, isPending: false }),
  useDeleteTripGearItem: () => ({ mutate: jest.fn(), error: null, isPending: false }),
}))

jest.mock('@/components/trips/TripsPageSeo', () => ({ __esModule: true, default: () => null }))

const mockStub = (testID: string) => () => {
  const { View } = require('react-native')
  return <View testID={testID} />
}

jest.mock('@/components/trips/planning/RouteBuilder', () => mockStub('route-builder'))
jest.mock('@/components/trips/planning/TripReportForm', () => mockStub('trip-report-form'))
jest.mock('@/components/trips/planning/TripRatingPanel', () => mockStub('trip-rating-panel'))
jest.mock('@/components/trips/planning/TripAffiliateBlock', () => mockStub('trip-affiliate-block'))

const gearItem: TripGearItem = {
  id: 1,
  title: 'Треккинговые ботинки',
  category: 'footwear',
  status: 'owned',
  sortOrder: 0,
}

const trip = {
  id: 8001,
  slug: '8001',
  title: 'Mullerthal Trail',
  description: '',
  startDate: '2026-09-26',
  endDate: null,
  startTime: null,
  transport: 'foot',
  bikeType: null,
  visibility: 'private',
  seatsTotal: 2,
  startPoint: null,
  status: 'planning',
  organizer: { id: 1, name: 'Организатор', avatarUrl: null },
  route: [],
  routeGeometry: null,
  routeSummary: null,
  routingState: null,
  participants: [],
  coverUrl: null,
  region: '',
  publishedToCommunity: false,
  report: null,
  isOwner: true,
  myRsvp: 'going',
  createdAt: '2026-09-06T10:00:00.000Z',
} as unknown as PlannedTrip

const renderScreen = () => {
  const PlannedTripScreen = require('@/app/(tabs)/trips/plan/[id]').default
  return render(<PlannedTripScreen />)
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUsePlannedTrip.mockReturnValue({ data: trip, isLoading: false, isError: false })
  mockUseTripGear.mockReturnValue({
    data: [gearItem],
    error: null,
    isError: false,
    isLoading: false,
    isFetching: false,
    refetch: jest.fn(),
  })
})

describe('PlannedTripScreen — чеклист снаряжения (#1839)', () => {
  it('не показывает чеклист на вкладке «Маршрут»', () => {
    const { queryByTestId, getByTestId } = renderScreen()

    expect(getByTestId('trip-plan-panel-route')).toBeTruthy()
    expect(queryByTestId('trip-gear-checklist')).toBeNull()
  })

  it('показывает чеклист во вкладке «Ещё»', () => {
    const { getByTestId } = renderScreen()

    fireEvent.press(getByTestId('trip-plan-tab-more'))

    expect(getByTestId('trip-plan-panel-more')).toBeTruthy()
    expect(getByTestId('trip-gear-checklist')).toBeTruthy()
    expect(getByTestId('trip-gear-item-1')).toBeTruthy()
  })
})
