import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import Footer from '@/components/Footer'
import { DESIGN_TOKENS } from '@/constants/designSystem'

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () =>
    (global as any).__mockResponsive ?? {
      width: 390,
      height: 844,
      isSmallPhone: false,
      isPhone: true,
      isLargePhone: false,
      isTablet: false,
      isLargeTablet: false,
      isDesktop: false,
      isMobile: true,
      isPortrait: true,
      isLandscape: false,
      orientation: 'portrait',
      breakpoints: {},
      isAtLeast: () => false,
      isAtMost: () => true,
      isBetween: () => false,
    },
}))

// Mock Linking
const mockOpenURL = jest.fn(() => Promise.resolve())
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: mockOpenURL,
  canOpenURL: jest.fn(() => Promise.resolve(true)),
}))

describe('Footer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global as any).__mockResponsive = undefined
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('renders mobile dock correctly', () => {
    const { getByTestId } = render(<Footer />)
    expect(getByTestId('footer-item-home')).toBeTruthy()
    expect(getByTestId('footer-item-search')).toBeTruthy()
    expect(getByTestId('footer-item-map')).toBeTruthy()
    expect(getByTestId('footer-item-favorites')).toBeTruthy()
    expect(getByTestId('footer-item-create')).toBeTruthy()
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
      ;(global as any).__mockResponsive = {
        width: Math.max(1400, DESIGN_TOKENS.breakpoints.mobile + 100),
        height: 800,
        isSmallPhone: false,
        isPhone: false,
        isLargePhone: false,
        isTablet: false,
        isLargeTablet: false,
        isDesktop: true,
        isMobile: false,
        isPortrait: false,
        isLandscape: true,
        orientation: 'landscape',
        breakpoints: {},
        isAtLeast: () => true,
        isAtMost: () => false,
        isBetween: () => false,
      }

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

