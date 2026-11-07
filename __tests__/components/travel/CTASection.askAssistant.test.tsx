/**
 * #2897: «Спросить про этот маршрут» рядом с «Добавить в план» на странице статьи —
 * только под `EXPO_PUBLIC_AI_ASSISTANT`; видна и гостю (ассистент входа не требует).
 */
import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

const mockPush = jest.fn()
const authState = { isAuthenticated: true }

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => authState,
}))
jest.mock('@/hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ loginHref: '/login', requireAuth: jest.fn() }),
}))
jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => ({ addFavorite: jest.fn(), removeFavorite: jest.fn(), isFavorite: jest.fn(() => false) }),
}))
jest.mock('@/components/travel/TravelStatusButton', () => {
  const { Text } = require('react-native')
  return function TravelStatusButton() {
    return <Text testID="travel-status">Travel status</Text>
  }
})
jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    surface: '#fff',
    borderStrong: '#ddd',
    brandSoft: '#eef',
    text: '#111',
    textSecondary: '#555',
    textOnPrimary: '#fff',
    primary: '#267',
    primaryDark: '#145',
    primaryText: '#145',
    primarySoft: '#def',
    danger: '#b00',
  }),
}))

import CTASection from '@/components/travel/CTASection'

const travel = { id: 816, slug: 'yarmarki-polshi', name: 'Ярмарки Польши', description: '', travel_image_thumb_url: '', url: '/travels/yarmarki-polshi', gallery: [], travelAddress: [] } as never

describe('CTASection: контекстный вход в ассистента (#2897)', () => {
  const originalFlag = process.env.EXPO_PUBLIC_AI_ASSISTANT
  afterEach(() => {
    process.env.EXPO_PUBLIC_AI_ASSISTANT = originalFlag
    authState.isAuthenticated = true
    mockPush.mockClear()
  })

  it('без флага кнопки нет ни у гостя, ни у вошедшего', async () => {
    delete process.env.EXPO_PUBLIC_AI_ASSISTANT
    const signedIn = await render(<CTASection travel={travel} />)
    expect(signedIn.getByTestId('travel-status')).toBeTruthy()
    expect(signedIn.queryByTestId('ask-assistant-source')).toBeNull()
    await signedIn.unmount()
    authState.isAuthenticated = false
    const guest = await render(<CTASection travel={travel} />)
    expect(guest.queryByTestId('ask-assistant-source')).toBeNull()
  })

  it('с флагом кнопка стоит рядом с «Добавить в план» и ведёт в ассистента с источником статьи; гостю — тоже', async () => {
    process.env.EXPO_PUBLIC_AI_ASSISTANT = '1'
    const signedIn = await render(<CTASection travel={travel} />)
    expect(signedIn.getByTestId('travel-status')).toBeTruthy()
    await fireEvent.press(signedIn.getByTestId('ask-assistant-source'))
    expect(mockPush).toHaveBeenCalledWith('/assistant?source=travel:816')
    await signedIn.unmount()

    authState.isAuthenticated = false
    const guest = await render(<CTASection travel={travel} />)
    await fireEvent.press(guest.getByTestId('ask-assistant-source'))
    expect(mockPush).toHaveBeenLastCalledWith('/assistant?source=travel:816')
  })
})
