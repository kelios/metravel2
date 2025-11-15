import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import ArticleListItem from '@/components/ArticleListItem'

// Mock expo-router
const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  router: {
    push: mockPush,
  },
}))

// Mock react-native-render-html
jest.mock('react-native-render-html', () => ({
  default: ({ source }: any) => {
    const { Text } = require('react-native')
    return <Text>{source.html}</Text>
  },
}))

describe('ArticleListItem', () => {
  const mockArticle = {
    id: 1,
    name: 'Test Article',
    description: '<p>Test description</p>',
    article_image_thumb_url: 'https://example.com/image.jpg',
    article_type: { name: 'News' },
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders correctly', () => {
    const { getByText } = render(<ArticleListItem article={mockArticle} />)
    expect(getByText('Test Article')).toBeTruthy()
  })

  it('navigates to article page when pressed', () => {
    const { getByText } = render(<ArticleListItem article={mockArticle} />)
    fireEvent.press(getByText('Test Article'))
    expect(mockPush).toHaveBeenCalledWith('/article/1')
  })

  it('renders article type when available', () => {
    const { getByText } = render(<ArticleListItem article={mockArticle} />)
    expect(getByText('News')).toBeTruthy()
  })

  it('renders without article type', () => {
    const articleWithoutType = { ...mockArticle, article_type: null }
    const { queryByText } = render(<ArticleListItem article={articleWithoutType} />)
    expect(queryByText('News')).toBeNull()
  })
})

