import { fireEvent, render } from '@testing-library/react-native'

import TravelRegisterCtaSection from '@/components/travel/details/sections/TravelRegisterCtaSection'
import { queueAnalyticsEvent } from '@/utils/analytics'
import { saveGuestFavoriteIntent } from '@/utils/guestFavoriteIntent'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    surface: '#fff',
    border: '#ccc',
    text: '#000',
    textSecondary: '#666',
    primary: '#ff7043',
  }),
}))

jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}))

jest.mock('@/utils/analytics', () => ({
  queueAnalyticsEvent: jest.fn(),
}))

jest.mock('@/utils/guestFavoriteIntent', () => ({
  saveGuestFavoriteIntent: jest.fn(() => Promise.resolve()),
}))

const { useAuth } = jest.requireMock('@/context/AuthContext') as { useAuth: jest.Mock }

describe('TravelRegisterCtaSection', () => {
  beforeEach(() => {
    mockPush.mockReset()
    ;(queueAnalyticsEvent as jest.Mock).mockReset()
    ;(saveGuestFavoriteIntent as jest.Mock).mockClear()
  })

  it('renders CTA for a guest and navigates to registration with redirect and analytics on press', () => {
    useAuth.mockReturnValue({ isAuthenticated: false })

    const { getByLabelText } = render(
      <TravelRegisterCtaSection
        redirect="/travels/test-route"
        travelId={42}
        title="Тестовый маршрут"
        imageUrl="https://example.com/travel.jpg"
      />,
    )

    const button = getByLabelText('Сохранить маршрут')
    expect(button).toBeTruthy()

    fireEvent.press(button)

    expect(queueAnalyticsEvent).toHaveBeenCalledWith('cta_register_click', {
      source: 'travel_article',
      intent: 'favorite',
      auth_state: 'guest',
    })
    expect(queueAnalyticsEvent).toHaveBeenCalledWith('favorite_intent_guest', {
      item_type: 'travel',
      item_id: '42',
      source: 'travel_article',
      url: '/travels/test-route',
      auth_state: 'guest',
    })
    expect(saveGuestFavoriteIntent).toHaveBeenCalledWith({
      id: '42',
      type: 'travel',
      title: 'Тестовый маршрут',
      imageUrl: 'https://example.com/travel.jpg',
      url: '/travels/test-route',
      source: 'travel_article',
    })
    expect(mockPush).toHaveBeenCalledWith('/registration?redirect=%2Ftravels%2Ftest-route&intent=favorite')
  })

  it('renders nothing for an authenticated user', () => {
    useAuth.mockReturnValue({ isAuthenticated: true })

    const { queryByLabelText } = render(<TravelRegisterCtaSection />)

    expect(queryByLabelText('Сохранить маршрут')).toBeNull()
  })
})
