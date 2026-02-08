import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { Linking } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import AuthorCard from '@/components/travel/AuthorCard'

jest.mock('@/hooks/useUserProfileCached', () => ({
  useUserProfileCached: () => ({ profile: mockProfile }),
}))

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ userId: '99', isAuthenticated: true }),
}))

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

let mockProfile: any = null

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
    mockProfile = null
    const { getByText, getByLabelText, queryByText } = renderWithClient(<AuthorCard travel={baseTravel} />)

    expect(getByText('Test User')).toBeTruthy()
    expect(queryByText('Беларусь')).toBeNull()
    expect(getByText('3 путешествия')).toBeTruthy()

    // Кнопка "Все путешествия"
    const button = getByLabelText('Все путешествия автора')
    expect(button).toBeTruthy()
  })

  it('calls onViewAuthorTravels when provided instead of navigation', () => {
    const onViewAuthorTravels = jest.fn()

    const { getByLabelText } = renderWithClient(
      <AuthorCard travel={baseTravel} onViewAuthorTravels={onViewAuthorTravels} />,
    )

    const button = getByLabelText('Все путешествия автора')
    fireEvent.press(button)

    expect(onViewAuthorTravels).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
    expect((Linking.openURL as jest.Mock)).not.toHaveBeenCalled()
  })

  it('navigates with router.push on web when userId exists and no onViewAuthorTravels', () => {
    const { getByLabelText } = renderWithClient(<AuthorCard travel={baseTravel} />)

    const button = getByLabelText('Все путешествия автора')
    fireEvent.press(button)
    expect(mockPush).toHaveBeenCalledWith('/search?user_id=42')
  })

  it('extracts userId from userIds string and shows subscribe/message buttons', () => {
    mockProfile = null
    const travelWithStringUserIds: any = {
      id: 10,
      userName: 'String ID User',
      countryName: 'Польша',
      userIds: '55',
      userTravelsCount: 2,
      travel_image_thumb_small_url: null,
    }
    const { getByText, getByLabelText } = renderWithClient(
      <AuthorCard travel={travelWithStringUserIds} />,
    )
    expect(getByText('String ID User')).toBeTruthy()
    const button = getByLabelText('Все путешествия автора')
    fireEvent.press(button)
    expect(mockPush).toHaveBeenCalledWith('/search?user_id=55')
  })

  it('extracts userId from comma-separated userIds string', () => {
    mockProfile = null
    const travelWithCommaUserIds: any = {
      id: 11,
      userName: 'Comma User',
      countryName: 'Чехия',
      userIds: '77,88',
      travel_image_thumb_small_url: null,
    }
    const { getByText, getByLabelText } = renderWithClient(
      <AuthorCard travel={travelWithCommaUserIds} />,
    )
    expect(getByText('Comma User')).toBeTruthy()
    const button = getByLabelText('Все путешествия автора')
    fireEvent.press(button)
    expect(mockPush).toHaveBeenCalledWith('/search?user_id=77')
  })

  it('does not show travel countries when profile is absent', () => {
    mockProfile = null
    const { queryByText } = renderWithClient(
      <AuthorCard travel={{ ...baseTravel, countryName: 'Россия, Беларусь' }} />,
    )
    expect(queryByText('Россия, Беларусь')).toBeNull()
  })

  it('shows author country from profile when available', () => {
    mockProfile = { countryName: 'Испания' }
    const { getByText } = renderWithClient(
      <AuthorCard travel={{ ...baseTravel, countryName: 'Россия, Беларусь' }} />,
    )
    expect(getByText('Испания')).toBeTruthy()
  })
})
