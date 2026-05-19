import React from 'react'
import { render, screen } from '@testing-library/react-native'

import HomeHowItWorks from '@/components/home/HomeHowItWorks'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}))

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({
    isSmallPhone: false,
    isPhone: false,
    isTablet: false,
    isDesktop: true,
  }),
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    primary: '#bb8844',
    primaryText: '#7a5723',
    primaryAlpha30: 'rgba(187, 136, 68, 0.3)',
    text: '#111111',
    textMuted: '#666666',
    textOnPrimary: '#ffffff',
    surface: '#ffffff',
    backgroundSecondary: '#faf8f5',
    borderLight: '#e5ded4',
  }),
}))

jest.mock('@/components/layout', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => children,
}))

describe('HomeHowItWorks copy', () => {
  it('renders a clearer explanatory heading on the homepage', () => {
    render(<HomeHowItWorks />)

    expect(
      screen.getByText('Как сохранить маршрут и вернуться к нему позже'),
    ).toBeTruthy()
    expect(
      screen.getByText(
        'Выберите поездку, добавьте заметки и откройте всё снова, когда это понадобится',
      ),
    ).toBeTruthy()
    expect(screen.queryByText('Три шага до вашей книги')).toBeNull()
    expect(
      screen.queryByText('Просто выберите маршрут, сохраните поездку и получите красивый PDF'),
    ).toBeNull()
  })
})

