/**
 * @jest-environment jsdom
 *
 * /article/<id> JSON-LD must survive Helmet. Do not mock LazyInstantSEO.
 */

import React from 'react'
import { Platform } from 'react-native'
import { render, waitFor } from '@testing-library/react-native'
import { Helmet, HelmetProvider, type HelmetServerState } from 'expo-router/vendor/react-helmet-async/lib'

import ArticleScreen from '@/app/(tabs)/article/[id].web'
import LazyInstantSEO from '@/components/seo/LazyInstantSEO'

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

const emitHelmetScripts = (node: React.ReactNode) => {
  const context: { helmet?: HelmetServerState } = {}
  const originalCanUseDOM = HelmetProvider.canUseDOM
  let helmetScreen: ReturnType<typeof render> | undefined
  HelmetProvider.canUseDOM = false
  try {
    helmetScreen = render(
      <HelmetProvider context={context}>
        <Helmet>{node}</Helmet>
      </HelmetProvider>,
    )
    const html = context.helmet?.script.toString() ?? ''
    const template = document.createElement('template')
    template.innerHTML = html
    return [...template.content.querySelectorAll('script')]
  } finally {
    helmetScreen?.unmount()
    HelmetProvider.canUseDOM = originalCanUseDOM
  }
}

describe('Article JSON-LD Helmet contract (#1967)', () => {
  const originalOS = Platform.OS

  beforeAll(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' })
  })

  afterAll(() => {
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
    const screen = render(<ArticleScreen />)

    await waitFor(() => {
      expect(screen.UNSAFE_root.findByType(LazyInstantSEO).props.additionalTags).toBeTruthy()
    })

    const { additionalTags } = screen.UNSAFE_root.findByType(LazyInstantSEO).props
    expect(additionalTags.props).not.toHaveProperty('dangerouslySetInnerHTML')
    const scripts = emitHelmetScripts(additionalTags)
    expect(scripts).toHaveLength(1)
    expect(scripts[0].type).toBe('application/ld+json')
    expect(scripts[0].getAttribute('data-rh')).toBe('true')
    expect(JSON.parse(scripts[0].textContent ?? '')).toMatchObject({
      '@type': 'Article',
      headline: 'Розыгрыш трех термосов.',
    })
  })
})
