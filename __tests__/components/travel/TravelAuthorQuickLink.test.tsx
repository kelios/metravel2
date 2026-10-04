import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import TravelAuthorQuickLink from '@/components/travel/details/TravelAuthorQuickLink'
import { useAuthStore } from '@/stores/authStore'

const mockPush = jest.fn()
const mockSubscribePress = jest.fn()
const mockUseUserProfileCached = jest.fn()
const mockOpenExternalUrl = jest.fn()
const mockImageCardMedia = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('@/components/ui/ImageCardMedia', () => ({
  __esModule: true,
  default: (props: unknown) => {
    const React = require('react')
    const { View } = require('react-native')
    mockImageCardMedia(props)
    return React.createElement(View, { testID: 'author-avatar' })
  },
}))

jest.mock('@/components/ui/SubscribeButton', () => ({
  __esModule: true,
  default: ({ targetUserId, style }: { targetUserId: string | number; style?: unknown }) => {
    const React = require('react')
    const { Pressable } = require('react-native')
    return React.createElement(Pressable, {
      accessibilityRole: 'button',
      accessibilityLabel: 'Подписаться на пользователя',
      testID: 'travel-author-subscribe-button',
      onPress: () => mockSubscribePress(targetUserId),
      style,
    })
  },
}))

jest.mock('@/hooks/useUserProfileCached', () => ({
  useUserProfileCached: (...args: unknown[]) => mockUseUserProfileCached(...args),
}))

jest.mock('@/api/userSafety', () => ({
  __esModule: true,
  reportContent: jest.fn(() => Promise.resolve({ id: 1, status: 'pending' })),
  blockUser: jest.fn(() => Promise.resolve()),
  unblockUser: jest.fn(() => Promise.resolve()),
  fetchReportReasons: jest.fn(() => Promise.resolve([])),
  fetchBlockedUsers: jest.fn(() => Promise.resolve([])),
  isMockReported: jest.fn(() => false),
  isMockBlocked: jest.fn(() => false),
}))

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
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
    mockSubscribePress.mockClear()
    mockOpenExternalUrl.mockClear()
    mockImageCardMedia.mockClear()
    mockUseUserProfileCached.mockReset()
    mockUseUserProfileCached.mockReturnValue({
      profile: {
        youtube: 'https://youtube.com/@maria',
        instagram: 'https://instagram.com/maria',
        twitter: '',
        vk: '',
      },
    })
  })

  it('renders a compact author block and opens author actions', () => {
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

    const { getByLabelText, getByText, queryByText } = render(<TravelAuthorQuickLink travel={travel} />)

    expect(getByText('Автор путешествия')).toBeTruthy()
    expect(getByText('Мария Иванова')).toBeTruthy()
    expect(queryByText('Профиль автора')).toBeNull()
    expect(queryByText('7 путешествий')).toBeNull()
    expect(queryByText('Все путешествия')).toBeNull()
    expect(queryByText('Подписаться')).toBeNull()
    expect(queryByText('Написать')).toBeNull()
    expect(queryByText('YouTube')).toBeNull()
    expect(queryByText('Instagram')).toBeNull()
    expect(mockUseUserProfileCached).toHaveBeenCalledWith(42, { enabled: true })

    fireEvent.press(getByLabelText('Открыть профиль автора Мария Иванова'))
    expect(mockPush).toHaveBeenCalledWith('/user/42')

    fireEvent.press(getByLabelText('Подписаться на пользователя'))
    expect(mockSubscribePress).toHaveBeenCalledWith(42)

    fireEvent.press(getByLabelText('Написать автору Мария Иванова'))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/messages',
      params: { userId: '42' },
    })

    fireEvent.press(getByLabelText('Открыть все путешествия автора Мария Иванова'))
    expect(mockPush).toHaveBeenCalledWith('/search?user_id=42')

    fireEvent.press(getByLabelText('Открыть YouTube'))
    expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://youtube.com/@maria')

    fireEvent.press(getByLabelText('Открыть Instagram'))
    expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://instagram.com/maria')
  })

  it('does not render without author name or id', () => {
    const { queryByTestId } = render(<TravelAuthorQuickLink travel={{ id: 1 } as any} />)

    expect(queryByTestId('travel-author-quick-link')).toBeNull()
  })

  it('renders the avatar returned by the cached author profile', () => {
    mockUseUserProfileCached.mockReturnValue({
      profile: {
        avatar: 'https://metravel.by/media/avatars/author.jpg',
      },
    })

    const travel: any = {
      id: 1,
      userName: 'Мария Иванова',
      userIds: '42',
    }

    const { getByTestId } = render(<TravelAuthorQuickLink travel={travel} />)

    expect(getByTestId('author-avatar')).toBeTruthy()
    expect(mockImageCardMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        src: 'https://metravel.by/media/avatars/author.jpg',
      }),
    )
  })
  describe('content safety (#2133)', () => {
    const travel: any = { id: 5, userName: 'Мария Иванова', userIds: '42' }
    const renderSigned = () => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
      return render(
        <QueryClientProvider client={client}>
          <TravelAuthorQuickLink travel={travel} />
        </QueryClientProvider>,
      )
    }

    afterEach(() => {
      useAuthStore.setState({ isAuthenticated: false, userId: null })
    })

    it('offers the travel report menu to a signed-in reader', () => {
      useAuthStore.setState({ isAuthenticated: true, userId: '7' })
      expect(renderSigned().getByTestId('travel-author-safety-menu')).toBeTruthy()
    })

    it('hides it from the travel author and from guests', () => {
      useAuthStore.setState({ isAuthenticated: true, userId: '42' })
      expect(renderSigned().queryByTestId('travel-author-safety-menu')).toBeNull()
      useAuthStore.setState({ isAuthenticated: false, userId: null })
      expect(render(<TravelAuthorQuickLink travel={travel} />).queryByTestId('travel-author-safety-menu')).toBeNull()
    })
  })
})
