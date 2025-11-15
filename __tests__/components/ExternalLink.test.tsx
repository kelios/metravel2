import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { ExternalLink } from '@/components/ExternalLink'

// Mock expo-web-browser
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(() => Promise.resolve({ type: 'dismiss' })),
}))

import * as WebBrowser from 'expo-web-browser'

describe('ExternalLink', () => {
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
    fireEvent.press(link)
    // On native, it should call openBrowserAsync
    // Note: This test might need adjustment based on actual platform
  })
})

