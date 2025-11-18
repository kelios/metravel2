import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import ForgotPasswordScreen from '@/components/user/ForgotPasswordScreen'

// Mock AuthContext
const mockSendPassword = jest.fn(() => Promise.resolve(true))
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    sendPassword: mockSendPassword,
  }),
}))

describe('ForgotPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders correctly', () => {
    const { getByPlaceholderText, getByText } = render(<ForgotPasswordScreen />)
    expect(getByPlaceholderText('Email')).toBeTruthy()
    expect(getByText('Отправить инструкцию')).toBeTruthy()
  })

  it('updates email input', () => {
    const { getByPlaceholderText } = render(<ForgotPasswordScreen />)
    const input = getByPlaceholderText('Email')
    fireEvent.changeText(input, 'test@example.com')
    expect(input.props.value).toBe('test@example.com')
  })

  it('calls sendPassword when button is pressed', async () => {
    const { getByPlaceholderText, getByText } = render(<ForgotPasswordScreen />)
    const input = getByPlaceholderText('Email')
    const button = getByText('Отправить инструкцию')

    fireEvent.changeText(input, 'test@example.com')
    fireEvent.press(button)

    await expect(mockSendPassword).toHaveBeenCalledWith('test@example.com')
  })
})


