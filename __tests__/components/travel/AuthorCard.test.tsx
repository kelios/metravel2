import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { Linking, Platform } from 'react-native'

import AuthorCard from '@/components/travel/AuthorCard'

// Мокаем expo-router useRouter
const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// Мокаем Linking
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native')
  return {
    ...RN,
    Linking: {
      ...(RN as any).Linking,
      openURL: jest.fn(),
    },
    Platform: { OS: 'web', select: (obj: any) => obj.web || obj.default },
    useWindowDimensions: () => ({ width: 1024, height: 768 }),
  }
})

const baseTravel: any = {
  id: 1,
  userName: 'Test User',
  countryName: 'Беларусь',
  userId: 42,
  userTravelsCount: 3,
  travel_image_thumb_small_url: null,
}

describe('AuthorCard', () => {
  it('returns null when no author data', () => {
    const { queryByText } = render(<AuthorCard travel={{} as any} />)
    expect(queryByText('Автор путешествия')).toBeNull()
  })

  it('renders author info with placeholder avatar when no image', () => {
    const { getByText, getByLabelText } = render(<AuthorCard travel={baseTravel} />)

    expect(getByText('Test User')).toBeTruthy()
    expect(getByText('Беларусь')).toBeTruthy()
    expect(getByText('3 путешествия')).toBeTruthy()

    // Кнопка "Все путешествия"
    const button = getByLabelText('Смотреть все путешествия автора Test User')
    expect(button).toBeTruthy()
  })

  it('calls onViewAuthorTravels when provided instead of navigation', () => {
    const onViewAuthorTravels = jest.fn()

    const { getByLabelText } = render(
      <AuthorCard travel={baseTravel} onViewAuthorTravels={onViewAuthorTravels} />,
    )

    const button = getByLabelText('Смотреть все путешествия автора Test User')
    fireEvent.press(button)

    expect(onViewAuthorTravels).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
    expect((Linking.openURL as jest.Mock)).not.toHaveBeenCalled()
  })

  it('navigates with router.push on web when userId exists and no onViewAuthorTravels', () => {
    const { getByLabelText } = render(<AuthorCard travel={baseTravel} />)

    const button = getByLabelText('Смотреть все путешествия автора Test User')
    fireEvent.press(button)

    expect(mockPush).toHaveBeenCalledWith('/?user_id=42')
    expect((Linking.openURL as jest.Mock)).not.toHaveBeenCalled()
  })
})
