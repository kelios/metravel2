import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'

import { ApiError } from '@/api/client'

const mockUseMyParticipantRating = jest.fn()
const mockUseRateParticipant = jest.fn()

jest.mock('@/hooks/useParticipantRating', () => ({
  useMyParticipantRating: (...args: unknown[]) => mockUseMyParticipantRating(...args),
  useRateParticipant: (...args: unknown[]) => mockUseRateParticipant(...args),
}))

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { userId: string }) => unknown) => selector({ userId: '1' }),
}))

jest.mock('@/components/ui/StarRating', () => {
  const { View } = require('react-native')
  return function MockStarRating({ testID, disabled }: { testID: string; disabled?: boolean }) {
    return <View testID={testID} accessibilityState={{ disabled: Boolean(disabled) }} />
  }
})

import TripRatingPanel from '@/components/trips/planning/TripRatingPanel'
import type { PlannedTrip } from '@/api/plannedTrips'

const trip = {
  id: 10,
  status: 'completed',
  isOwner: true,
  myRsvp: null,
  participants: [
    { id: 1, name: 'Я', role: 'organizer' },
    { id: 2, name: 'Попутчик', role: 'participant' },
  ],
} as unknown as PlannedTrip

const makeQueryState = (overrides: Record<string, unknown> = {}) => ({
  data: null,
  error: null,
  isError: false,
  isFetching: false,
  refetch: jest.fn().mockResolvedValue(undefined),
  ...overrides,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockUseMyParticipantRating.mockReturnValue(makeQueryState())
  mockUseRateParticipant.mockReturnValue({
    error: null,
    isPending: false,
    mutate: jest.fn(),
  })
})

describe('TripRatingPanel error states', () => {
  it('shows a retryable load error and retries the query', async () => {
    const refetch = jest.fn().mockResolvedValue(undefined)
    mockUseMyParticipantRating.mockReturnValue(
      makeQueryState({
        error: new ApiError(0, 'offline'),
        isError: true,
        refetch,
      }),
    )

    render(<TripRatingPanel trip={trip} />)

    expect(screen.getByText('Не удалось загрузить сохранённую оценку.')).toBeTruthy()
    fireEvent.press(screen.getByTestId('participant-rating-retry-2'))
    expect(refetch).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('participant-stars-2').props.accessibilityState.disabled).toBe(true)
  })

  it('distinguishes an expired session without offering a futile retry', () => {
    mockUseMyParticipantRating.mockReturnValue(
      makeQueryState({
        error: new ApiError(401, 'unauthorized'),
        isError: true,
      }),
    )

    render(<TripRatingPanel trip={trip} />)

    expect(screen.getByText('Сессия истекла. Войдите в аккаунт снова.')).toBeTruthy()
    expect(screen.queryByTestId('participant-rating-retry-2')).toBeNull()
  })

  it('keeps a failed save visible so the user can repeat the action', () => {
    mockUseRateParticipant.mockReturnValue({
      error: new ApiError(500, 'server error'),
      isPending: false,
      mutate: jest.fn(),
    })

    render(<TripRatingPanel trip={trip} />)

    expect(screen.getByText('Не удалось сохранить оценку. Повторите действие.')).toBeTruthy()
  })
})
