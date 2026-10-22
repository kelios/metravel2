import { fireEvent, render } from '@testing-library/react-native'
import PeerBadgeGiveButton from '@/components/achievements/PeerBadgeGiveButton'
import PeerBadgePickerSheet from '@/components/achievements/PeerBadgePickerSheet'
import { useAuthStore } from '@/stores/authStore'

jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.requireActual('zustand').create(() => ({ isAuthenticated: true })),
}))
jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => require('@/constants/modernMattePalette').MODERN_MATTE_PALETTE,
}))
jest.mock('@/components/achievements/PeerBadgePickerSheet', () => {
  const { Text } = require('react-native')
  return function Picker({ visible }: { visible: boolean }) {
    return visible ? <Text testID="test-peer-picker">Picker</Text> : null
  }
})

describe('PeerBadgeGiveButton', () => {
  beforeEach(() => { useAuthStore.setState({ isAuthenticated: true }) })

  it.each([false, true])('notifies before opening the existing picker (iconOnly=%s)', iconOnly => {
    const onPress = jest.fn(() => {
      expect(screen.queryByTestId('test-peer-picker')).toBeNull()
    })
    const screen = render(
      <PeerBadgeGiveButton target="user" recipientId={7} received={[]} onPress={onPress} iconOnly={iconOnly} testID="give" />,
    )
    fireEvent.press(screen.getByTestId('give'))
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('test-peer-picker')).toBeTruthy()
    expect(screen.UNSAFE_getByType(PeerBadgePickerSheet).props).toMatchObject({
      visible: true, target: 'user', recipientId: 7,
    })
  })

  it('keeps the existing authorization boundary', () => {
    useAuthStore.setState({ isAuthenticated: false })
    const screen = render(<PeerBadgeGiveButton target="user" recipientId={7} received={[]} />)
    expect(screen.toJSON()).toBeNull()
  })
})
