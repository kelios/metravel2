import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Alert, Platform } from 'react-native'

import CalendarScreen from '@/app/(tabs)/calendar'
import type { TravelStatusEntry } from '@/stores/travelStatusStore'

const mockPush = jest.fn()
const mockReplace = jest.fn()
const mockBack = jest.fn()
const mockLoadLocal = jest.fn(() => Promise.resolve())
const mockSetStatus = jest.fn(() => Promise.resolve())
const mockRemoveStatus = jest.fn(() => Promise.resolve())
const mockShowToast = jest.fn(() => Promise.resolve())

let mockEntries: TravelStatusEntry[] = []
let mockParams: Record<string, string | undefined> = {}

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack, canGoBack: jest.fn(() => true) }),
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
    // #994: travelStatus на React Query — реактивный список + модульные функции.
    // Обёртки лениво читают mock-и (const'ы инициализируются после hoisted-import).
    useTravelStatus: () => mockEntries,
    loadTravelStatus: (...args: any[]) => mockLoadLocal(...args),
    setTravelStatus: (...args: any[]) => mockSetStatus(...args),
    removeTravelStatus: (...args: any[]) => mockRemoveStatus(...args),
  }
})

jest.mock('@/components/profile/ProfileCollectionHeader', () => {
  return function MockProfileCollectionHeader({ title, onBackPress }: { title: string; onBackPress: () => void }) {
    const { Pressable, Text, View } = require('react-native')
    return (
      <View>
        <Text>{title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Назад" onPress={onBackPress}>
          <Text>Назад</Text>
        </Pressable>
      </View>
    )
  }
})

jest.mock('@/utils/toast', () => ({
  showToast: (...args: unknown[]) => mockShowToast(...args),
}))

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
    mockEntries = [makeEntry()]
    mockParams = {}
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  // #1726 / NATIVE-DUP-BACK-AFFORDANCE-001: основной список на native не рисует
  // свою шапку — «Назад» уже даёт глобальный HeaderContextBar.
  it.each(['android', 'ios'])('%s: в основном списке нет второго «Назад»', async (os) => {
    const prevOS = Platform.OS
    ;(Platform.OS as any) = os
    try {
      render(<CalendarScreen />)
      await waitFor(() => expect(mockLoadLocal).toHaveBeenCalledWith('42'))
      expect(screen.queryByText('Назад')).toBeNull()
    } finally {
      ;(Platform.OS as any) = prevOS
    }
  })

  it('web: в основном списке своя шапка с «Назад» одна', async () => {
    const prevOS = Platform.OS
    ;(Platform.OS as any) = 'web'
    try {
      render(<CalendarScreen />)
      await waitFor(() => expect(mockLoadLocal).toHaveBeenCalledWith('42'))
      expect(screen.getAllByText('Назад')).toHaveLength(1)
    } finally {
      ;(Platform.OS as any) = prevOS
    }
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

  it('removes an authored future route from plans by moving it to visited', async () => {
    mockEntries = [makeEntry({ isAuthoredTravel: true })]
    render(<CalendarScreen />)

    await waitFor(() => expect(mockLoadLocal).toHaveBeenCalledWith('42'))

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Убрать «Test Travel» из планов' }))
    })

    expect(mockSetStatus).toHaveBeenCalledWith(
      expect.objectContaining({ id: 123, status: 'visited', isAuthoredTravel: true }),
      '42'
    )
    expect(mockRemoveStatus).not.toHaveBeenCalled()
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'info' }))
  })

  it('keeps an authored route actionable when the status mutation fails', async () => {
    mockEntries = [makeEntry({ isAuthoredTravel: true })]
    mockSetStatus.mockRejectedValueOnce(new Error('network'))
    render(<CalendarScreen />)

    await waitFor(() => expect(mockLoadLocal).toHaveBeenCalledWith('42'))

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Убрать «Test Travel» из планов' }))
    })

    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
    expect(mockRemoveStatus).not.toHaveBeenCalled()
  })

  it('returns to profile even when calendar has no useful history entry', async () => {
    // Своя шапка с «Назад» есть только на web (#1726); на native кнопку рисует
    // глобальный HeaderContextBar вне этого экрана.
    const prevOS = Platform.OS
    ;(Platform.OS as any) = 'web'
    try {
      render(<CalendarScreen />)

      await waitFor(() => expect(mockLoadLocal).toHaveBeenCalledWith('42'))
      fireEvent.press(screen.getByRole('button', { name: 'Назад' }))

      expect(mockReplace).toHaveBeenCalledWith('/profile')
      expect(mockBack).not.toHaveBeenCalled()
    } finally {
      ;(Platform.OS as any) = prevOS
    }
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
