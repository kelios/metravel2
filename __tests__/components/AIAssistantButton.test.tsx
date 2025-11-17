import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import AIAssistantButton from '@/components/AIAssistantButton'

// Mock expo-router
const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock useWindowDimensions
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native')
  return {
    ...RN,
    useWindowDimensions: () => ({ width: 375, height: 667 }),
  }
})

describe('AIAssistantButton', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders correctly', () => {
    const { getByLabelText } = render(<AIAssistantButton />)
    expect(getByLabelText('Открыть AI-помощника')).toBeTruthy()
  })

  it('navigates to chat screen on press', () => {
    const { getByLabelText } = render(<AIAssistantButton />)
    const button = getByLabelText('Открыть AI-помощника')
    
    fireEvent.press(button)
    
    expect(mockPush).toHaveBeenCalledWith('/chat')
  })
})

