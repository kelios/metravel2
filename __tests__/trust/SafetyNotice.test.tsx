import { render, fireEvent } from '@testing-library/react-native'

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}))

import SafetyNotice from '@/components/ui/SafetyNotice'

describe('SafetyNotice', () => {
  it('renders the default liability warning', async () => {
    const { getByText } = await render(<SafetyNotice />)
    expect(getByText(/MeTravel не несёт ответственности/)).toBeTruthy()
  })

  it('renders custom text', async () => {
    const { getByText } = await render(<SafetyNotice text="Будьте осторожны при встрече" />)
    expect(getByText('Будьте осторожны при встрече')).toBeTruthy()
  })

  it('hides itself when dismissed (with a storageKey)', async () => {
    const { getByTestId, queryByTestId } = await render(
      <SafetyNotice storageKey="test-notice" testID="sn" />,
    )
    expect(getByTestId('sn')).toBeTruthy()
    await fireEvent.press(getByTestId('sn-dismiss'))
    expect(queryByTestId('sn')).toBeNull()
  })

  it('has no dismiss button without a storageKey', async () => {
    const { queryByTestId } = await render(<SafetyNotice testID="sn" />)
    expect(queryByTestId('sn-dismiss')).toBeNull()
  })
})
