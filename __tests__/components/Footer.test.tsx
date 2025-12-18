import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import Footer from '@/components/Footer'
import { DESIGN_TOKENS } from '@/constants/designSystem'

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

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('renders mobile dock correctly', () => {
    const { getByText } = render(<Footer />)
    expect(getByText('Путешествия')).toBeTruthy()
    expect(getByText('Карта')).toBeTruthy()
    expect(getByText('Избранное')).toBeTruthy()
    expect(getByText('Создать')).toBeTruthy()
  })

  it('calls onDockHeight callback', () => {
    const onDockHeight = jest.fn()
    const { getByTestId } = render(<Footer onDockHeight={onDockHeight} />)

    fireEvent(getByTestId('footer-dock-measure'), 'layout', {
      nativeEvent: { layout: { height: 56 } },
    })

    expect(onDockHeight).toHaveBeenCalledWith(56)
  })

  it('renders desktop footer groups', () => {
    const { Platform } = require('react-native')
    const prevOS = Platform.OS
    ;(Platform as any).OS = 'web'

    try {
      // Force desktop mode by mocking useWindowDimensions
      jest
        .spyOn(require('react-native'), 'useWindowDimensions')
        .mockReturnValue({ width: DESIGN_TOKENS.breakpoints.mobile + 100, height: 800, scale: 2, fontScale: 2 })

      const { getByTestId } = render(<Footer />)
      expect(getByTestId('footer-item-about')).toBeTruthy()
      expect(getByTestId('footer-item-privacy')).toBeTruthy()
      expect(getByTestId('footer-item-cookies')).toBeTruthy()
      expect(getByTestId('footer-item-press')).toBeTruthy()
      expect(getByTestId('footer-item-tt')).toBeTruthy()
    } finally {
      ;(Platform as any).OS = prevOS
    }
  })
})

