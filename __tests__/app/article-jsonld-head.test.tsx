/**
 * @jest-environment jsdom
 *
 * /article/<id> JSON-LD must survive Helmet. Do not mock LazyInstantSEO.
 */

import React from 'react'
import { Platform } from 'react-native'
import { waitFor } from '@testing-library/react-native'
import { createRootRegistry } from '../helpers/rawRootLifecycle'
import { HelmetProvider } from 'expo-router/vendor/react-helmet-async/lib'
import { readHelmetHead } from '../helpers/helmetHead'

import ArticleScreen from '@/app/(tabs)/article/[id].web'

const mockUseLocalSearchParams = jest.fn()
const mockFetchArticle = jest.fn()
const mockFetchArticleBySlug = jest.fn()

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  useIsFocused: () => true,
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/api/articles', () => ({
  extractArticleIdFromParam: (value: string) => Number(value) || null,
  fetchArticle: (...args: unknown[]) => mockFetchArticle(...args),
  fetchArticleBySlug: (...args: unknown[]) => mockFetchArticleBySlug(...args),
}))

jest.mock('@/components/article/SafeHtml', () => ({
  SafeHtml: () => null,
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    background: '#fff',
    surface: '#fff',
    border: '#ddd',
    primary: '#ff7043',
    primaryDark: '#e64a19',
    primarySoft: '#fff3e0',
    primaryAlpha30: '#ff70434d',
    text: '#111',
    textSecondary: '#666',
    textOnPrimary: '#fff',
  }),
}))

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}))

jest.mock('@/context/FavoritesContext', () => ({
  useFavorites: () => ({
    isFavorite: jest.fn(() => false),
    addFavorite: jest.fn(),
    addToHistory: jest.fn(),
  }),
}))

jest.mock('@/ui/paper', () => {
  const ReactLib = require('react')
  const { View, Text } = require('react-native')
  const Card = ({ children }: { children?: React.ReactNode }) => ReactLib.createElement(View, null, children)
  Card.Content = ({ children }: { children?: React.ReactNode }) => ReactLib.createElement(View, null, children)
  const Title = ({ children }: { children?: React.ReactNode }) => ReactLib.createElement(Text, null, children)
  return { Card, Title }
})

jest.mock('expo-router/head', () => require('../helpers/helmetHead').createHelmetHeadMock())

// The .web route deliberately contains HTML headings. Keep the real web
// subtree under the generic renderer; native tests retain strict RNTL rules.
const webRoots = createRootRegistry()
afterEach(() => webRoots.cleanup())

describe('Article JSON-LD Helmet contract (#1967)', () => {
  const originalOS = Platform.OS
  const originalCanUseDOM = HelmetProvider.canUseDOM

  beforeAll(() => {
    HelmetProvider.canUseDOM = false
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
  })

  afterAll(() => {
    HelmetProvider.canUseDOM = originalCanUseDOM
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS })
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseLocalSearchParams.mockReturnValue({ id: '1' })
    mockFetchArticle.mockResolvedValue({
      id: 1,
      name: 'Розыгрыш трех термосов.',
      description: '<p>Описание статьи</p>',
      article_image_thumb_url: 'https://metravel.by/uploads/article.jpg',
    })
  })

  it('emits application/ld+json with data-rh from real LazyInstantSEO additionalTags', async () => {
    const root = webRoots.createRoot()
    await React.act(() => root.render(<ArticleScreen />))

    await waitFor(() => {
      expect(readHelmetHead().scripts).toHaveLength(1)
    })

    const { children, scripts } = readHelmetHead()
    const [additionalTags] = React.Children.toArray(children) as React.ReactElement[]
    expect(additionalTags.props).not.toHaveProperty('dangerouslySetInnerHTML')
    expect(scripts).toHaveLength(1)
    expect(scripts[0].type).toBe('application/ld+json')
    expect(scripts[0].getAttribute('data-rh')).toBe('true')
    expect(JSON.parse(scripts[0].textContent ?? '')).toMatchObject({
      '@type': 'Article',
      headline: 'Розыгрыш трех термосов.',
    })
  })
})
