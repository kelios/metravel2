import { render, fireEvent } from '@testing-library/react-native'
import ArticleListItem from '@/components/article/ArticleListItem'

// Mock expo-router
const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  __esModule: true,
  router: {
    push: (...args: any[]) => mockPush(...args),
  },
}))

// Mock react-native-render-html
jest.mock('react-native-render-html', () => {
  require('react')
  const { Text } = require('react-native')
  return function RenderHTML({ source }: any) {
    return <Text>{source.html}</Text>
  }
})

// Mock react-native-paper components used in ArticleListItem
jest.mock('react-native-paper', () => {
  require('react')
  const { View, Text } = require('react-native')

  const Card = ({ children }: any) => <View>{children}</View>
  Card.Cover = () => <View testID="card-cover" />
  Card.Content = ({ children }: any) => <View>{children}</View>

  return {
    Card,
    Title: ({ children }: any) => <Text>{children}</Text>,
    Paragraph: ({ children }: any) => <Text>{children}</Text>,
    Text: ({ children }: any) => <Text>{children}</Text>,
  }
})

describe('ArticleListItem', () => {
  const mockArticle = {
    id: 1,
    name: 'Test Article',
    description: '<p>Test description</p>',
    article_image_thumb_url: 'https://example.com/image.jpg',
    article_image_thumb_small_url: 'https://example.com/image_small.jpg',
    article_type: { name: 'News' },
  } as any

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

