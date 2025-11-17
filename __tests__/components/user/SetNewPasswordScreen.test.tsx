import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import SetNewPasswordScreen from '@/components/user/SetNewPasswordScreen'

// Mock AuthContext
const mockSetNewPassword = jest.fn(() => Promise.resolve(true))
jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    setNewPassword: mockSetNewPassword,
  }),
}))

describe('SetNewPasswordScreen', () => {
  const mockRoute = {
    params: {
      token: 'test-token',
    },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders correctly', () => {
    const { getByPlaceholderText, getByText } = render(
      <SetNewPasswordScreen route={mockRoute} />
    )
    expect(getByPlaceholderText('Новый пароль')).toBeTruthy()
    expect(getByText('Установить новый пароль')).toBeTruthy()
  })

  it('updates password input', () => {
    const { getByPlaceholderText } = render(<SetNewPasswordScreen route={mockRoute} />)
    const input = getByPlaceholderText('Новый пароль')
    fireEvent.changeText(input, 'newpassword123')
    expect(input.props.value).toBe('newpassword123')
  })

  it('calls setNewPassword when button is pressed', async () => {
    const { getByPlaceholderText, getByText } = render(
      <SetNewPasswordScreen route={mockRoute} />
    )
    const input = getByPlaceholderText('Новый пароль')
    const button = getByText('Установить новый пароль')

    fireEvent.changeText(input, 'newpassword123')
    fireEvent.press(button)

    await expect(mockSetNewPassword).toHaveBeenCalledWith('test-token', 'newpassword123')
  })
})

