import fs from 'fs'
import path from 'path'
import React from 'react'
import { Platform } from 'react-native'
import { render, waitFor } from '@testing-library/react-native'

jest.mock('expo-router', () => ({
  usePathname: jest.fn(() => '/'),
}))

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () => ({ isHydrated: true, width: 1280 }),
}))

jest.mock('@/components/home/Home', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    __esModule: true,
    default: () => React.createElement(View, { testID: 'home-screen-content' }),
  }
})

jest.mock('@/components/seo/LazyInstantSEO', () => {
  const React = require('react')
  return {
    __esModule: true,
    default: () => React.createElement(React.Fragment, null),
  }
})

describe('Home screen regression guards', () => {
  beforeEach(() => {
    Platform.OS = 'web'
  })

  it('does not use raw HTML heading tags inside RN screen source', () => {
    const filePath = path.resolve(process.cwd(), 'app/(tabs)/index.tsx')
    const source = fs.readFileSync(filePath, 'utf8')

    expect(source).not.toMatch(/<\s*h1\b/i)
  })

  it('renders home route on web without runtime crash', async () => {
    const HomeScreen = require('@/app/(tabs)/index').default
    const { getByTestId } = render(<HomeScreen />)

    await waitFor(() => {
      expect(getByTestId('home-screen-content')).toBeTruthy()
    })
  })
})
