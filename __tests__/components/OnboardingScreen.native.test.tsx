import { act, fireEvent, render, waitFor } from '@testing-library/react-native'

import AsyncStorage from '@react-native-async-storage/async-storage'

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}))

jest.mock('@expo/vector-icons/Feather', () => 'Feather')

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => new Proxy({}, { get: () => '#334455' }),
}))

jest.mock('@/utils/haptics', () => ({
  hapticImpact: jest.fn(),
}))

import OnboardingScreen from '@/components/onboarding/OnboardingScreen.native'

const mockGetItem = AsyncStorage.getItem as jest.MockedFunction<typeof AsyncStorage.getItem>
const mockSetItem = AsyncStorage.setItem as jest.MockedFunction<typeof AsyncStorage.setItem>

const renderFreshOnboarding = async () => {
  const result = render(<OnboardingScreen />)
  await waitFor(() => expect(result.getAllByRole('button')).toHaveLength(2))
  return result
}

describe('OnboardingScreen native persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetItem.mockResolvedValue(null)
    mockSetItem.mockResolvedValue()
  })

  it('keeps the overlay mounted until Skip persistence completes', async () => {
    let resolveWrite!: () => void
    mockSetItem.mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveWrite = resolve
      }),
    )
    const screen = await renderFreshOnboarding()

    fireEvent.press(screen.getAllByRole('button')[1])

    expect(mockSetItem).toHaveBeenCalledWith('metravel.onboarding.v1', '1')
    expect(screen.getAllByRole('button')).toHaveLength(2)

    await act(async () => resolveWrite())

    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('persists the final slide before hiding the overlay', async () => {
    let resolveWrite!: () => void
    mockSetItem.mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveWrite = resolve
      }),
    )
    const screen = await renderFreshOnboarding()

    fireEvent.press(screen.getAllByRole('button')[0])
    fireEvent.press(screen.getAllByRole('button')[0])
    expect(screen.getAllByRole('button')).toHaveLength(1)

    fireEvent.press(screen.getByRole('button'))

    expect(mockSetItem).toHaveBeenCalledWith('metravel.onboarding.v1', '1')
    expect(screen.getAllByRole('button')).toHaveLength(1)

    await act(async () => resolveWrite())

    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('still hides the overlay when persistence fails', async () => {
    mockSetItem.mockRejectedValue(new Error('storage unavailable'))
    const screen = await renderFreshOnboarding()

    fireEvent.press(screen.getAllByRole('button')[1])

    await waitFor(() => expect(screen.queryAllByRole('button')).toHaveLength(0))
  })
})
