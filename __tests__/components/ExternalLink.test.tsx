import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { ExternalLink } from '@/components/ui/ExternalLink'

// Mock expo-web-browser
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(() => Promise.resolve({ type: 'dismiss' })),
}))

import * as WebBrowser from 'expo-web-browser'

describe('ExternalLink', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders correctly', () => {
    const { getByText } = render(
      <ExternalLink href="https://example.com">Test Link</ExternalLink>
    )
    expect(getByText('Test Link')).toBeTruthy()
  })

  it('opens browser on native platforms', () => {
    const { getByText } = render(
      <ExternalLink href="https://example.com">Test Link</ExternalLink>
    )
    const link = getByText('Test Link')
    fireEvent.press(link, { preventDefault: jest.fn() })
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://example.com')
  })
})

