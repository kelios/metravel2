import { fireEvent, render, screen } from '@testing-library/react-native'
import { Platform } from 'react-native'

// #2898: «Добавить в план» гостя сохраняется для завершения после входа — но
// только когда сессия уже прочитана (во время восстановления это может быть не гость).

jest.mock('@/context/AuthContext', () => ({ useAuth: jest.fn() }))
jest.mock('@/hooks/useRequireAuth', () => ({ useRequireAuth: jest.fn() }))
jest.mock('@/utils/guestPlanIntent', () => ({ saveGuestPlanIntent: jest.fn(() => Promise.resolve()) }))
jest.mock('@/stores/travelStatusStore', () => ({
  useTravelStatus: jest.fn(() => []),
  setTravelStatus: jest.fn(() => Promise.resolve()),
  removeTravelStatus: jest.fn(() => Promise.resolve()),
  parseTravelStatusDateParts: jest.fn(() => null),
}))
jest.mock('@/utils/toast', () => ({ showToast: jest.fn(() => Promise.resolve()) }))
jest.mock('@/styles/globalFocus', () => ({ globalFocusStyles: { focusable: {} } }))

const { useAuth } = require('@/context/AuthContext') as { useAuth: jest.Mock }
const { useRequireAuth } = require('@/hooks/useRequireAuth') as { useRequireAuth: jest.Mock }
const { saveGuestPlanIntent } = require('@/utils/guestPlanIntent') as { saveGuestPlanIntent: jest.Mock }

import TravelStatusButton from '@/components/travel/TravelStatusButton'

const props = { travelId: 42, travelTitle: 'Гродно за 1 день', travelUrl: '/travels/grodno', travelCountry: 'Беларусь' }

beforeEach(() => {
  jest.clearAllMocks()
  Platform.OS = 'ios'
  useAuth.mockReturnValue({ isAuthenticated: false, userId: null })
})

it('гость: сохраняет намерение и ведёт на вход', async () => {
  const requireAuth = jest.fn()
  useRequireAuth.mockReturnValue({ requireAuth, authReady: true })
  await render(<TravelStatusButton {...props} />)
  await fireEvent.press(screen.getByRole('button', { name: 'Добавить в план' }))
  expect(saveGuestPlanIntent).toHaveBeenCalledWith(
    expect.objectContaining({ id: '42', title: 'Гродно за 1 день', url: '/travels/grodno', country: 'Беларусь' }),
  )
  expect(requireAuth).toHaveBeenCalledTimes(1)
})

it('сессия ещё восстанавливается: намерение не сохраняется', async () => {
  const requireAuth = jest.fn()
  useRequireAuth.mockReturnValue({ requireAuth, authReady: false })
  await render(<TravelStatusButton {...props} />)
  await fireEvent.press(screen.getByRole('button', { name: 'Добавить в план' }))
  expect(saveGuestPlanIntent).not.toHaveBeenCalled()
})
