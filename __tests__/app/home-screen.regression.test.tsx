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

const mockInstantSEO = jest.fn((_props: unknown) => null)

jest.mock('@/components/seo/LazyInstantSEO', () => {
  return {
    __esModule: true,
    default: (props: unknown) => mockInstantSEO(props),
  }
})

describe('Home screen regression guards', () => {
  beforeEach(() => {
    Platform.OS = 'web'
    mockInstantSEO.mockClear()
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

  it('hydrates InstantSEO from the canonical RU home metadata keys', async () => {
    const { resources } = require('@/i18n/resources')
    const HomeScreen = require('@/app/(tabs)/index').default
    render(<HomeScreen />)

    await waitFor(() => {
      expect(mockInstantSEO).toHaveBeenCalled()
    })

    const latestProps = mockInstantSEO.mock.calls.at(-1)?.[0] as {
      title?: string
      description?: string
    }
    expect(latestProps.title).toBe(resources.ru.seoStatic['root.home.title'])
    expect(latestProps.description).toBe(resources.ru.seoStatic['root.home.description'])
  })
})
