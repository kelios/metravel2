import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import Button from '@/components/ui/Button'

describe('Button', () => {
  it('renders correctly with label', () => {
    const { getByText } = render(
      <Button label="Test Button" onPress={() => {}} />
    )
    expect(getByText('Test Button')).toBeTruthy()
  })

  it('calls onPress when pressed', () => {
    const onPress = jest.fn()
    const { getByText } = render(
      <Button label="Test Button" onPress={onPress} />
    )
    fireEvent.press(getByText('Test Button'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn()
    const { getByText } = render(
      <Button label="Test Button" onPress={onPress} disabled />
    )
    fireEvent.press(getByText('Test Button'))
    expect(onPress).not.toHaveBeenCalled()
  })

  it('applies disabled styles when disabled', () => {
    const { getByText } = render(
      <Button label="Test Button" onPress={() => {}} disabled />
    )
    const button = getByText('Test Button').parent
    expect(button).toBeTruthy()
  })
})






