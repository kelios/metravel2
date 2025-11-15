import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import ChatScreen from '@/app/(tabs)/chat'

// Mock the API
jest.mock('@/src/api/travels', () => ({
  sendAIMessage: jest.fn(),
}))

import { sendAIMessage } from '@/src/api/travels'

describe('ChatScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders correctly', () => {
    const { getByPlaceholderText, getByText } = render(<ChatScreen />)
    expect(getByPlaceholderText('Задайте ваш вопрос...')).toBeTruthy()
    expect(getByText('Отправить')).toBeTruthy()
  })

  it('updates input text', () => {
    const { getByPlaceholderText } = render(<ChatScreen />)
    const input = getByPlaceholderText('Задайте ваш вопрос...')
    fireEvent.changeText(input, 'Test message')
    expect(input.props.value).toBe('Test message')
  })

  it('does not send empty message', async () => {
    const { getByText } = render(<ChatScreen />)
    const sendButton = getByText('Отправить')
    fireEvent.press(sendButton)
    await waitFor(() => {
      expect(sendAIMessage).not.toHaveBeenCalled()
    })
  })

  it('sends message and displays response', async () => {
    const mockResponse = {
      data: { reply: 'This is a test response' },
    }
    ;(sendAIMessage as jest.Mock).mockResolvedValue(mockResponse)

    const { getByPlaceholderText, getByText, findByText } = render(<ChatScreen />)
    const input = getByPlaceholderText('Задайте ваш вопрос...')
    const sendButton = getByText('Отправить')

    fireEvent.changeText(input, 'Test question')
    fireEvent.press(sendButton)

    await waitFor(() => {
      expect(sendAIMessage).toHaveBeenCalledWith('Test question')
    })

    const userMessage = await findByText('Test question')
    expect(userMessage).toBeTruthy()

    const botMessage = await findByText('This is a test response')
    expect(botMessage).toBeTruthy()
  })

  it('displays error message on API failure', async () => {
    const error = new Error('API Error')
    ;(sendAIMessage as jest.Mock).mockRejectedValue(error)

    const { getByPlaceholderText, getByText, findByText } = render(<ChatScreen />)
    const input = getByPlaceholderText('Задайте ваш вопрос...')
    const sendButton = getByText('Отправить')

    fireEvent.changeText(input, 'Test question')
    fireEvent.press(sendButton)

    const errorMessage = await findByText('Произошла ошибка. Попробуйте снова.')
    expect(errorMessage).toBeTruthy()
  })

  it('clears input after sending message', async () => {
    const mockResponse = {
      data: { reply: 'Response' },
    }
    ;(sendAIMessage as jest.Mock).mockResolvedValue(mockResponse)

    const { getByPlaceholderText, getByText } = render(<ChatScreen />)
    const input = getByPlaceholderText('Задайте ваш вопрос...')
    const sendButton = getByText('Отправить')

    fireEvent.changeText(input, 'Test question')
    fireEvent.press(sendButton)

    await waitFor(() => {
      expect(input.props.value).toBe('')
    })
  })
})

