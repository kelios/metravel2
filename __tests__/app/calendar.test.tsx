import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Alert } from 'react-native'

import CalendarScreen from '@/app/(tabs)/calendar'
import type { TravelStatusEntry } from '@/stores/travelStatusStore'

const mockPush = jest.fn()
const mockLoadLocal = jest.fn(() => Promise.resolve())
const mockSetStatus = jest.fn(() => Promise.resolve())
const mockRemoveStatus = jest.fn(() => Promise.resolve())

let mockEntries: TravelStatusEntry[] = []
let mockParams: Record<string, string | undefined> = {}

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), canGoBack: jest.fn(() => true) }),
  usePathname: jest.fn(() => '/calendar'),
  useLocalSearchParams: () => mockParams,
}))

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    authReady: true,
    userId: '42',
  }),
}))

jest.mock('@/stores/travelStatusStore', () => {
  const actual = jest.requireActual('@/stores/travelStatusStore')
  return {
    ...actual,
    useTravelStatusStore: jest.fn((selector) => selector({
      entries: mockEntries,
      loadLocal: mockLoadLocal,
      setStatus: mockSetStatus,
      removeStatus: mockRemoveStatus,
    })),
  }
})

jest.mock('@/components/profile/ProfileCollectionHeader', () => {
  return function MockProfileCollectionHeader({ title }: { title: string }) {
    const { Text } = require('react-native')
    return <Text>{title}</Text>
  }
})

jest.mock('@/components/calendar/MiniCalendar', () => {
  return function MockMiniCalendar() {
    const { View } = require('react-native')
    return <View testID="mini-calendar" />
  }
})

jest.mock('@/components/ui/UnifiedTravelCard', () => {
  return function MockUnifiedTravelCard({ title, contentSlot, onPress, testID }: any) {
    const { Pressable, Text } = require('react-native')
    return (
      <Pressable onPress={onPress} testID={testID}>
        <Text>{title}</Text>
        {contentSlot}
      </Pressable>
    )
  }
})

jest.mock('@/components/seo/LazyInstantSEO', () => {
  return function MockInstantSEO() {
    return null
  }
})

jest.mock('@/components/ui/SkeletonLoader', () => ({
  SkeletonLoader: () => {
    const { View } = require('react-native')
    return <View testID="skeleton-loader" />
  },
}))

jest.mock('@/components/ui/EmptyState', () => {
  return function MockEmptyState({ title, action }: any) {
    const { Pressable, Text, View } = require('react-native')
    return (
      <View>
        <Text>{title}</Text>
        {action ? <Pressable onPress={action.onPress}><Text>{action.label}</Text></Pressable> : null}
      </View>
    )
  }
})

const makeEntry = (extra?: Partial<TravelStatusEntry>): TravelStatusEntry => ({
  id: 123,
  type: 'travel',
  title: 'Test Travel',
  url: '/travels/test-travel',
  country: 'Беларусь',
  status: 'planned',
  plannedDate: '2026-07-15',
  addedAt: 1000,
  ...extra,
})

describe('CalendarScreen status editor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const confirmButton = buttons?.find((button) => button.style === 'destructive') ?? buttons?.[1]
      confirmButton?.onPress?.()
    })
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      jest.spyOn(window, 'confirm').mockReturnValue(true)
    }
    mockEntries = [makeEntry()]
    mockParams = {}
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('allows changing calendar status from planned to visited', async () => {
    render(<CalendarScreen />)

    await waitFor(() => expect(mockLoadLocal).toHaveBeenCalledWith('42'))

    fireEvent.press(screen.getByLabelText('Изменить дату 2026-07-15'))
    fireEvent.press(screen.getAllByRole('button', { name: 'Был' }).at(-1)!)

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Сохранить дату' }))
    })

    expect(mockSetStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 123,
        status: 'visited',
        visitedDate: '2026-07-15',
      }),
      '42'
    )
  })

  it('allows deleting an explicit status from calendar', async () => {
    render(<CalendarScreen />)

    await waitFor(() => expect(mockLoadLocal).toHaveBeenCalledWith('42'))

    fireEvent.press(screen.getByLabelText('Изменить дату 2026-07-15'))

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Удалить из календаря' }))
    })

    expect(mockRemoveStatus).toHaveBeenCalledWith(123, '42')
  })

  it('shows empty state when the user has no explicit travel statuses', async () => {
    mockEntries = []

    render(<CalendarScreen />)

    await waitFor(() => expect(mockLoadLocal).toHaveBeenCalledWith('42'))

    expect(screen.getByText('Нет запланированных поездок')).toBeTruthy()
    expect(screen.queryByText('Test Travel')).toBeNull()
  })

  it('opens the tab requested by profile status links', async () => {
    mockParams = { status: 'visited' }
    mockEntries = [makeEntry({ status: 'visited', visitedDate: '2026-06-20', plannedDate: undefined })]

    render(<CalendarScreen />)

    await waitFor(() => expect(mockLoadLocal).toHaveBeenCalledWith('42'))

    expect(screen.getByText('Test Travel')).toBeTruthy()
    expect(screen.queryByText('Нет запланированных поездок')).toBeNull()
  })
})
