import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import ForgotPasswordLink from '@/components/ForgotPasswordLink'

describe('ForgotPasswordLink', () => {
  it('renders correctly', () => {
    const { getByText } = render(<ForgotPasswordLink onPress={() => {}} />)
    expect(getByText('Забыли пароль?')).toBeTruthy()
  })

  it('calls onPress when pressed', () => {
    const onPress = jest.fn()
    const { getByText } = render(<ForgotPasswordLink onPress={onPress} />)
    fireEvent.press(getByText('Забыли пароль?'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})

