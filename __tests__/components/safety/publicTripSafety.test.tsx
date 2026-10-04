// #2133 (Apple 1.2(c)): жалоба на чужую публичную поездку и блок организатора.
// Телефон — пункты «⋯» строки экрана, desktop — «…» рядом с организатором.

import React from 'react'
import { render as rtlRender } from '@testing-library/react-native'

import { createQueryWrapper } from '../../helpers/testQueryClient'
import type { ScreenHeaderConfig } from '@/components/layout/ScreenHeaderContext'

jest.mock('@/stores/authStore', () => require('../../helpers/contentSafetyMocks').authStoreMock)
jest.mock('@/api/userSafety', () => require('../../helpers/contentSafetyMocks').userSafetyApiMock)
jest.mock('@/utils/toast', () => ({ showToast: jest.fn(() => Promise.resolve()) }))
jest.mock('@/utils/tripAnalytics', () => ({ trackTripViewed: jest.fn() }))
jest.mock('@/components/ui/ImageCardMedia', () => {
  const { View } = require('react-native')
  return { __esModule: true, default: () => <View testID="mock-image-card-media" /> }
})

let mockIsOwner = false
jest.mock('@/api/publicTrips', () => ({
  ...jest.requireActual('@/api/publicTrips'),
  fetchPublicTrip: jest.fn(() =>
    Promise.resolve({
      id: 11,
      slug: '11',
      title: 'Поездка на Нарочь',
      coverUrl: null,
      region: 'Минская область',
      tripType: null,
      startDate: '2026-11-01T09:00:00Z',
      endDate: null,
      organizer: { id: 42, name: 'Организатор', avatarUrl: null },
      seatsTotal: 4,
      seatsTaken: 1,
      status: 'closed',
      description: 'Описание',
      featured: false,
      myApplicationStatus: null,
      isOwner: mockIsOwner,
      meetingPoint: null,
      contactNote: null,
    }),
  ),
  fetchMyApplications: jest.fn(() => Promise.resolve([])),
}))

let mockIsScreenHeaderMobile = true
let mockHeader: ScreenHeaderConfig | null = null
jest.mock('@/components/layout/ScreenHeaderContext', () => ({
  ...jest.requireActual('@/components/layout/ScreenHeaderContext'),
  useIsScreenHeaderMobile: () => mockIsScreenHeaderMobile,
  useScreenHeader: (config: ScreenHeaderConfig) => {
    mockHeader = config
    return config
  },
}))

import PublicTripDetail from '@/components/trips/PublicTripDetail'

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: createQueryWrapper().Wrapper })

beforeEach(() => {
  mockIsOwner = false
  mockIsScreenHeaderMobile = true
  mockHeader = null
})

describe('PublicTripDetail safety (#2133)', () => {
  it('phone: puts report and block of the organizer into the header overflow', async () => {
    const { findByTestId, queryByTestId } = render(<PublicTripDetail tripId={11} />)
    await findByTestId('trip-detail-11')
    expect(mockHeader?.overflow?.map((item) => item.key)).toEqual(['report', 'block'])
    expect(queryByTestId('trip-detail-safety-menu')).toBeNull()
  })

  it('desktop: renders the trigger next to the organizer', async () => {
    mockIsScreenHeaderMobile = false
    const { findByTestId } = render(<PublicTripDetail tripId={11} />)
    expect(await findByTestId('trip-detail-safety-menu')).toBeTruthy()
  })

  it('owner: no safety actions on an own trip', async () => {
    mockIsOwner = true
    const { findByTestId, queryByTestId } = render(<PublicTripDetail tripId={11} />)
    await findByTestId('trip-detail-11')
    expect(mockHeader?.overflow).toBeUndefined()
    expect(queryByTestId('trip-detail-safety-menu')).toBeNull()
  })
})
