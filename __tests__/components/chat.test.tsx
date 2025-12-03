import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import ChatScreen from '@/app/(tabs)/chat'

// Mock the API
jest.mock('@/src/api/misc', () => ({
  sendAIMessage: jest.fn(),
}))

// Mock Linking
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: jest.fn(() => Promise.resolve()),
  canOpenURL: jest.fn(() => Promise.resolve(true)),
}))

// Mock window for web platform
global.window = {
  open: jest.fn(),
} as any

import { sendAIMessage } from '@/src/api/misc'

describe('ChatScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    await AsyncStorage.clear()
  })

  const getInput = (utils: ReturnType<typeof render>) =>
    utils.getByPlaceholderText('Задайте ваш вопрос...')

  it('renders correctly with initial state', () => {
    const { getByText, getByPlaceholderText } = render(<ChatScreen />)
    expect(getByPlaceholderText('Задайте ваш вопрос...')).toBeTruthy()
    expect(getByText('AI Помощник')).toBeTruthy()
    expect(getByText('Начните диалог')).toBeTruthy()
    expect(
      getByText('Задайте вопрос о путешествиях, и я помогу вам найти интересные места')
    ).toBeTruthy()
  })

  it('displays suggested questions', () => {
    const { getByText } = render(<ChatScreen />)
    expect(getByText('Где лучше отдохнуть в Беларуси?')).toBeTruthy()
    expect(getByText('Какие достопримечательности посетить?')).toBeTruthy()
  })

  it('updates input text', () => {
    const utils = render(<ChatScreen />)
    const input = getInput(utils)
    fireEvent.changeText(input, 'Test message')
    expect(input.props.value).toBe('Test message')
  })

  it('does not send empty message', async () => {
    const utils = render(<ChatScreen />)
    const input = getInput(utils)
    
    // Try to submit with empty input
    fireEvent(input, 'submitEditing')
    
    await waitFor(() => {
      expect(sendAIMessage).not.toHaveBeenCalled()
    })
  })

  it('sends message and displays response', async () => {
    const mockResponse = { data: { reply: 'This is a test response' } }
    ;(sendAIMessage as jest.Mock).mockResolvedValue(mockResponse)

    const utils = render(<ChatScreen />)
    const input = getInput(utils)
    
    fireEvent.changeText(input, 'Test question')
    fireEvent(input, 'submitEditing')

    await waitFor(() => {
      expect(sendAIMessage).toHaveBeenCalledWith('Test question')
    })

    const userMessage = await utils.findByText('Test question')
    expect(userMessage).toBeTruthy()

    const botMessage = await utils.findByText('This is a test response')
    expect(botMessage).toBeTruthy()
  })

  it('displays error message on API failure', async () => {
    const error = new Error('API Error')
    ;(sendAIMessage as jest.Mock).mockRejectedValue(error)

    const utils = render(<ChatScreen />)
    const input = getInput(utils)
    
    fireEvent.changeText(input, 'Test question')
    
    // Submit by pressing enter or find send button
    fireEvent(input, 'submitEditing')

    const errorMessage = await utils.findByText(/Произошла ошибка/)
    expect(errorMessage).toBeTruthy()
  })

  it('clears input after sending message', async () => {
    const mockResponse = { data: { reply: 'Response' } }
    ;(sendAIMessage as jest.Mock).mockResolvedValue(mockResponse)

    const utils = render(<ChatScreen />)
    const input = getInput(utils)

    fireEvent.changeText(input, 'Test question')
    fireEvent(input, 'submitEditing')

    await waitFor(() => {
      expect(input.props.value).toBe('')
    })
  })

  it('handles suggestion click by sending predefined question', async () => {
    const mockResponse = { data: { reply: 'Answer' } }
    ;(sendAIMessage as jest.Mock).mockResolvedValue(mockResponse)

    const utils = render(<ChatScreen />)
    const suggestion = utils.getByText('Где лучше отдохнуть в Беларуси?')
    
    fireEvent.press(suggestion)
    
    await waitFor(() => {
      expect(sendAIMessage).toHaveBeenCalledWith('Где лучше отдохнуть в Беларуси?')
    })
  })

  it('displays loading state when sending message', async () => {
    const mockResponse = { data: { reply: 'Response' } }
    ;(sendAIMessage as jest.Mock).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(mockResponse), 100))
    )

    const utils = render(<ChatScreen />)
    const input = getInput(utils)

    fireEvent.changeText(input, 'Test question')
    fireEvent(input, 'submitEditing')

    const loadingText = await utils.findByText('Печатает...')
    expect(loadingText).toBeTruthy()
  })

  it('handles links in response', async () => {
    const mockResponse = {
      data: {
        reply: 'Check this [Travel](https://metravel.by/travels/123)',
      },
    }
    ;(sendAIMessage as jest.Mock).mockResolvedValue(mockResponse)

    const utils = render(<ChatScreen />)
    const input = getInput(utils)

    fireEvent.changeText(input, 'Test question')
    fireEvent(input, 'submitEditing')

    await waitFor(() => {
      expect(sendAIMessage).toHaveBeenCalled()
    })

    const linkText = await utils.findByText(/Check this/)
    expect(linkText).toBeTruthy()
  })

  it('disables input and send button while loading', async () => {
    const mockResponse = { data: { reply: 'Response' } }
    ;(sendAIMessage as jest.Mock).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(mockResponse), 100))
    )

    const utils = render(<ChatScreen />)
    const input = getInput(utils)

    fireEvent.changeText(input, 'Test question')
    fireEvent(input, 'submitEditing')

    await waitFor(() => {
      expect(input.props.editable).toBe(false)
    })
  })
})

