import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import Footer from '@/components/Footer'

// Mock Linking
const mockOpenURL = jest.fn(() => Promise.resolve())
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: mockOpenURL,
  canOpenURL: jest.fn(() => Promise.resolve(true)),
}))

describe('Footer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders correctly', () => {
    const { getByText } = render(<Footer />)
    expect(getByText('Путешествия')).toBeTruthy()
    expect(getByText('Карта')).toBeTruthy()
  })

  it('calls onDockHeight callback', () => {
    const onDockHeight = jest.fn()
    const { getByTestId } = render(<Footer onDockHeight={onDockHeight} />)

    fireEvent(getByTestId('footer-dock-measure'), 'layout', {
      nativeEvent: { layout: { height: 56 } },
    })

    expect(onDockHeight).toHaveBeenCalledWith(56)
  })

  it('renders navigation items', () => {
    const { getByText } = render(<Footer />)
    expect(getByText('Путешествия')).toBeTruthy()
    expect(getByText('Беларусь')).toBeTruthy()
    expect(getByText('Карта')).toBeTruthy()
    expect(getByText('Квесты')).toBeTruthy()
    expect(getByText('О сайте')).toBeTruthy()
  })

  it('renders social links', () => {
    const { getByLabelText } = render(<Footer />)
    // Social links are rendered as accessibility labels
    expect(getByLabelText('TikTok')).toBeTruthy()
    expect(getByLabelText('Instagram')).toBeTruthy()
    expect(getByLabelText('YouTube')).toBeTruthy()
  })
})

