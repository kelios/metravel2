import { fireEvent, render } from '@testing-library/react-native'

import TravelRegisterCtaSection from '@/components/travel/details/sections/TravelRegisterCtaSection'
import { queueAnalyticsEvent } from '@/utils/analytics'

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

const { useAuth } = jest.requireMock('@/context/AuthContext') as { useAuth: jest.Mock }

describe('TravelRegisterCtaSection', () => {
  beforeEach(() => {
    mockPush.mockReset()
    ;(queueAnalyticsEvent as jest.Mock).mockReset()
  })

  it('renders CTA for a guest and navigates to /registration with analytics on press', () => {
    useAuth.mockReturnValue({ isAuthenticated: false })

    const { getByLabelText } = render(<TravelRegisterCtaSection />)

    const button = getByLabelText('Создать бесплатный аккаунт')
    expect(button).toBeTruthy()

    fireEvent.press(button)

    expect(queueAnalyticsEvent).toHaveBeenCalledWith('cta_register_click', {
      source: 'travel_article',
    })
    expect(mockPush).toHaveBeenCalledWith('/registration')
  })

  it('renders nothing for an authenticated user', () => {
    useAuth.mockReturnValue({ isAuthenticated: true })

    const { queryByLabelText } = render(<TravelRegisterCtaSection />)

    expect(queryByLabelText('Создать бесплатный аккаунт')).toBeNull()
  })
})
