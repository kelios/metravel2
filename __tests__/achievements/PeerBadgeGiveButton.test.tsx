import { fireEvent, render } from '@testing-library/react-native'
import PeerBadgeGiveButton from '@/components/achievements/PeerBadgeGiveButton'
import { useAuthStore } from '@/stores/authStore'

jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.requireActual('zustand').create(() => ({ isAuthenticated: true })),
}))
jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => require('@/constants/modernMattePalette').MODERN_MATTE_PALETTE,
}))
const mockPickerProps = jest.fn()
jest.mock('@/components/achievements/PeerBadgePickerSheet', () => {
  const { Text } = require('react-native')
  return function Picker(props: { visible: boolean }) {
    mockPickerProps(props)
    return props.visible ? <Text testID="test-peer-picker">Picker</Text> : null
  }
})

describe('PeerBadgeGiveButton', () => {
  beforeEach(() => { useAuthStore.setState({ isAuthenticated: true }) })

  it.each([false, true])('notifies before opening the existing picker (iconOnly=%s)', async iconOnly => {
    const onPress = jest.fn(() => {
      expect(screen.queryByTestId('test-peer-picker')).toBeNull()
    })
    const screen = await render(
      <PeerBadgeGiveButton target="user" recipientId={7} received={[]} onPress={onPress} iconOnly={iconOnly} testID="give" />,
    )
    await fireEvent.press(screen.getByTestId('give'))
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('test-peer-picker')).toBeTruthy()
    expect(mockPickerProps.mock.calls.at(-1)?.[0]).toMatchObject({
      visible: true, target: 'user', recipientId: 7,
    })
  })

  it('keeps the existing authorization boundary', async () => {
    useAuthStore.setState({ isAuthenticated: false })
    const screen = await render(<PeerBadgeGiveButton target="user" recipientId={7} received={[]} />)
    expect(screen.toJSON()).toBeNull()
  })
})
