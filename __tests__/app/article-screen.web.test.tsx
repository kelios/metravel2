import React from 'react'
import { render, waitFor } from '@testing-library/react-native'

import ArticleScreen from '@/app/(tabs)/article/[id].web'

const mockUseLocalSearchParams = jest.fn()
const mockUseIsFocused = jest.fn()
const mockFetchArticle = jest.fn()
const mockFetchArticleBySlug = jest.fn()
const mockSeo = jest.fn(() => null)

jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}))

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockUseIsFocused(),
}))

jest.mock('@/api/articles', () => ({
  extractArticleIdFromParam: (value: string) => Number(value) || null,
  fetchArticle: (...args: unknown[]) => mockFetchArticle(...args),
  fetchArticleBySlug: (...args: unknown[]) => mockFetchArticleBySlug(...args),
}))

jest.mock('@/components/seo/LazyInstantSEO', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockSeo(props)
    return null
  },
}))

jest.mock('@/components/article/SafeHtml', () => ({
  SafeHtml: () => null,
}))

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    background: '#fff',
    surface: '#fff',
    border: '#ddd',
  }),
}))

jest.mock('@/ui/paper', () => {
  const React = require('react')
  const { View, Text } = require('react-native')
  const Card = ({ children }: any) => React.createElement(View, null, children)
  Card.Content = ({ children }: any) => React.createElement(View, null, children)
  const Title = ({ children }: any) => React.createElement(Text, null, children)
  return { Card, Title }
})

describe('ArticleScreen web SEO focus behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseLocalSearchParams.mockReturnValue({ id: '1' })
    mockUseIsFocused.mockReturnValue(false)
    mockFetchArticle.mockResolvedValue({
      id: 1,
      name: 'Розыгрыш трех термосов.',
      description: '<p>Описание статьи</p>',
      article_image_thumb_url: 'https://metravel.by/uploads/article.jpg',
    })
  })

  it('renders SEO on web even when navigation focus is false', async () => {
    render(<ArticleScreen />)

    await waitFor(() => {
      expect(mockSeo).toHaveBeenCalled()
    })

    const lastCall = mockSeo.mock.calls.at(-1)?.[0] as Record<string, unknown>
    expect(lastCall?.headKey).toBe('article-1')
    expect(lastCall?.canonical).toBe('https://metravel.by/article/1')
    expect(lastCall?.title).toBe('Розыгрыш трех термосов. | MeTravel')
  })
})
