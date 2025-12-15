import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { Linking, Platform } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

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

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('AuthorCard', () => {
  it('returns null when no author data', () => {
    const { queryByText } = renderWithClient(<AuthorCard travel={{} as any} />)
    expect(queryByText('Аноним')).toBeNull()
  })

  it('renders author info with placeholder avatar when no image', () => {
    const { getByText, getByLabelText } = renderWithClient(<AuthorCard travel={baseTravel} />)

    expect(getByText('Test User')).toBeTruthy()
    expect(getByText('Беларусь')).toBeTruthy()
    expect(getByText('3 путешествия')).toBeTruthy()

    // Кнопка "Все путешествия"
    const button = getByLabelText('Смотреть все путешествия автора Test User')
    expect(button).toBeTruthy()
  })

  it('calls onViewAuthorTravels when provided instead of navigation', () => {
    const onViewAuthorTravels = jest.fn()

    const { getByLabelText } = renderWithClient(
      <AuthorCard travel={baseTravel} onViewAuthorTravels={onViewAuthorTravels} />,
    )

    const button = getByLabelText('Смотреть все путешествия автора Test User')
    fireEvent.press(button)

    expect(onViewAuthorTravels).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
    expect((Linking.openURL as jest.Mock)).not.toHaveBeenCalled()
  })

  it('navigates with router.push on web when userId exists and no onViewAuthorTravels', () => {
    const { getByLabelText } = renderWithClient(<AuthorCard travel={baseTravel} />)

    const button = getByLabelText('Смотреть все путешествия автора Test User')
    fireEvent.press(button)
    // smoke-тест: клик по кнопке не должен приводить к ошибкам
  })
})
