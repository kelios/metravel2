import fs from 'fs'
import path from 'path'
import React from 'react'
import { Platform } from 'react-native'
import { waitFor, within } from '@testing-library/react-native'
import { createRootRegistry } from '../helpers/rawRootLifecycle'

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

// The .web route deliberately contains HTML headings. Keep the real web
// subtree under the generic renderer; native tests retain strict RNTL rules.
const webRoots = createRootRegistry()
afterEach(() => webRoots.cleanup())

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
    const root = webRoots.createRoot()
    await React.act(() => root.render(<HomeScreen />))
    const { getByTestId } = within(root.container)

    await waitFor(() => {
      expect(getByTestId('home-screen-content')).toBeTruthy()
    })
  })

  it('hydrates InstantSEO from the canonical RU home metadata keys', async () => {
    const { resources } = require('@/i18n/resources')
    const HomeScreen = require('@/app/(tabs)/index').default
    const root = webRoots.createRoot()
    await React.act(() => root.render(<HomeScreen />))

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
