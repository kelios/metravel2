// #2133 (Apple 1.2(c)): жалоба на травел из карточки каталога и «Скрыть» в ленте.

import React from 'react'
import { render } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import TravelListItem from '@/components/listTravel/TravelListItem'
import { useAuthStore } from '@/stores/authStore'
import { useHiddenContentStore } from '@/stores/hiddenContentStore'
import type { Travel } from '@/types/types'

jest.mock('@/components/travel/FavoriteButton', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/travel/TravelStatusButton', () => ({ __esModule: true, default: () => null }))
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '',
  useLocalSearchParams: () => ({}),
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

const ME = '7'

const travel = {
  id: 1,
  name: 'Foreign travel',
  slug: 'foreign-travel',
  travel_image_thumb_url: '',
  url: '',
  userName: 'Author',
  userIds: '42',
  countryName: '',
  countUnicIpView: '0',
  gallery: [],
  travelAddress: [],
} as Travel

const renderItem = (props: Partial<React.ComponentProps<typeof TravelListItem>> = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <TravelListItem travel={travel} currentUserId={ME} {...props} />
    </QueryClientProvider>,
  )
}

describe('TravelListItem content safety', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: true, userId: ME })
    useHiddenContentStore.setState({ byOwner: {} })
  })

  it('shows the safety trigger in the corner slot of a foreign travel card', () => {
    const { getByTestId, queryByTestId } = renderItem()
    expect(getByTestId('travel-card-safety-menu')).toBeTruthy()
    expect(queryByTestId('admin-actions')).toBeNull()
  })

  it('keeps admin actions and no safety trigger on an own travel card', () => {
    useAuthStore.setState({ isAuthenticated: true, userId: '42' })
    const { getByTestId, queryByTestId } = renderItem({ currentUserId: '42' })
    expect(getByTestId('admin-actions')).toBeTruthy()
    expect(queryByTestId('travel-card-safety-menu')).toBeNull()
  })

  it('shows no safety trigger in selectable (export) mode', () => {
    const { queryByTestId } = renderItem({ selectable: true })
    expect(queryByTestId('travel-card-safety-menu')).toBeNull()
  })

  it('renders the hidden placeholder instead of a hidden travel', () => {
    useHiddenContentStore.setState({ byOwner: { [ME]: ['travel:1'] } })
    const { getByTestId, queryByTestId } = renderItem()
    expect(getByTestId('hidden-content')).toBeTruthy()
    expect(queryByTestId('travel-card-foreign-travel')).toBeNull()
  })
})
