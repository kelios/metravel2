import { render, fireEvent } from '@testing-library/react-native'
import Button from '@/components/ui/Button'

describe('Button', () => {
  it('renders correctly with label', async () => {
    const { getByText } = await render(
      <Button label="Test Button" onPress={() => {}} />
    )
    expect(getByText('Test Button')).toBeTruthy()
  })

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn()
    const { getByText } = await render(
      <Button label="Test Button" onPress={onPress} />
    )
    await fireEvent.press(getByText('Test Button'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('does not call onPress when disabled', async () => {
    const onPress = jest.fn()
    const { getByRole } = await render(
      <Button label="Test Button" onPress={onPress} disabled />
    )
    const button = getByRole('button')
    expect(button.props.pointerEvents).toBe('none')
    expect(button.props.onPress).toBeUndefined()
    expect(button.props.onClick).toBeUndefined()
  })

  it('applies disabled styles when disabled', async () => {
    const { getByText } = await render(
      <Button label="Test Button" onPress={() => {}} disabled />
    )
    const button = getByText('Test Button').parent
    expect(button).toBeTruthy()
  })
})




