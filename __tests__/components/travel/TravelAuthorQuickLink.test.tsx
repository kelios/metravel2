import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import TravelAuthorQuickLink from '@/components/travel/details/TravelAuthorQuickLink'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: () => {
    const React = require('react')
    const { View } = require('react-native')
    return React.createElement(View, { testID: 'author-avatar' })
  },
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    backgroundSecondary: '#f4f4f4',
    borderLight: '#dddddd',
    primarySoft: '#eef7f2',
    primaryText: '#2f6b52',
    surface: '#ffffff',
    text: '#111111',
    textMuted: '#666666',
    textSecondary: '#444444',
  }),
}))

describe('TravelAuthorQuickLink', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it('renders a compact author block and opens profile or author travels', () => {
    const travel: any = {
      id: 1,
      slug: 'demo',
      name: 'Demo travel',
      userName: 'Мария Иванова',
      userIds: '42',
      userTravelsCount: 7,
      gallery: [],
      travelAddress: [],
    }

    const { getByLabelText, getByText } = render(<TravelAuthorQuickLink travel={travel} />)

    expect(getByText('Автор путешествия')).toBeTruthy()
    expect(getByText('Мария Иванова')).toBeTruthy()
    expect(getByText('7 путешествий')).toBeTruthy()

    fireEvent.press(getByLabelText('Открыть профиль автора Мария Иванова'))
    expect(mockPush).toHaveBeenCalledWith('/user/42')

    fireEvent.press(getByLabelText('Открыть все путешествия автора Мария Иванова'))
    expect(mockPush).toHaveBeenCalledWith('/search?user_id=42')
  })

  it('does not render without author name or id', () => {
    const { queryByTestId } = render(<TravelAuthorQuickLink travel={{ id: 1 } as any} />)

    expect(queryByTestId('travel-author-quick-link')).toBeNull()
  })
})
