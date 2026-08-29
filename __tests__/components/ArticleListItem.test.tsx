import { render, fireEvent } from '@testing-library/react-native'
import { Platform } from 'react-native'
import type { ReactTestInstance } from 'react-test-renderer'
import ArticleListItem from '@/components/article/ArticleListItem'

// Mock expo-router
const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  __esModule: true,
  usePathname: () => '/articles',
  router: {
    push: (...args: any[]) => mockPush(...args),
  },
}))

jest.mock('@/components/ui/ImageCardMedia', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    __esModule: true,
    default: (props: any) => <View testID={props.testID || 'image-card-media'} {...props} />,
  }
})

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
    expect(mockPush).toHaveBeenCalledWith('/article/1?from=%2Farticles')
  })

  it('passes list return href with source to article detail navigation', () => {
    const { getByText } = render(
      <ArticleListItem article={mockArticle} returnHref="/articles?from=%2Fmap" />,
    )
    fireEvent.press(getByText('Test Article'))
    expect(mockPush).toHaveBeenCalledWith('/article/1?from=%2Farticles%3Ffrom%3D%252Fmap')
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

  it('uses compact neutral media geometry when an article image is missing', () => {
    const withImage = render(<ArticleListItem article={mockArticle} />)
    const imageHeight = withImage.getByTestId('article-list-media').props.height

    const withoutImage = render(
      <ArticleListItem
        article={{
          ...mockArticle,
          article_image_thumb_url: '',
          article_image_thumb_small_url: undefined,
        }}
      />,
    )
    const placeholder = withoutImage.getByTestId('article-list-media')

    expect(placeholder.props.src).toBeNull()
    expect(placeholder.props.height).toBeLessThan(imageHeight)
  })

  it('keeps the first production article compact when cover fields are absent', () => {
    const productionArticleWithoutCover = {
      id: 1,
      name: 'Розыгрыш трех термосов.',
      description: '<p>Сегодня у нас в Минске выпал первый снег.</p>',
      article_type: { name: 'Розыгрыш' },
    } as any

    const { getByTestId } = render(<ArticleListItem article={productionArticleWithoutCover} />)
    const placeholder = getByTestId('article-list-media')

    expect(placeholder.props.src).toBeNull()
    expect(placeholder.props.height).toBeLessThanOrEqual(140)
  })

  it('normalizes fallback article thumbnail URLs before passing them to media', () => {
    const { getByTestId } = render(
      <ArticleListItem
        article={{
          ...mockArticle,
          article_image_thumb_url: undefined,
          article_image_thumb_small_url: '/uploads/article-cover.jpg',
        }}
      />,
    )

    const media = getByTestId('article-list-media')
    expect(media.props.src).toBe('https://metravel.by/uploads/article-cover.jpg')
  })

  it('switches broken article media to compact neutral placeholder after load error', () => {
    const { getByTestId } = render(<ArticleListItem article={mockArticle} />)
    const media = getByTestId('article-list-media')
    const imageHeight = media.props.height

    fireEvent(media, 'onError')

    const placeholder = getByTestId('article-list-media')
    expect(placeholder.props.src).toBeNull()
    expect(placeholder.props.height).toBeLessThan(imageHeight)
  })

  // #1619 — on web the card used to be a plain Pressable with no `href`/link
  // role, so keyboard "next link" navigation, crawlers and native browser
  // actions (open in new tab, copy link address) never saw it even though
  // pointer clicks worked via `router.push`. It is now a real anchor on web
  // (native keeps the original Pressable). Mirrors the equivalent regression
  // coverage in `screens/tabs/QuestCard.tsx` / `TravelListItem`'s own tests.
  describe('web link semantics (#1619)', () => {
    const originalPlatformOS = Platform.OS
    const getWebCardLink = (root: ReactTestInstance) =>
      root.find((node) => node.type === 'a')

    beforeEach(() => {
      ;(Platform as { OS: string }).OS = 'web'
    })

    afterEach(() => {
      ;(Platform as { OS: string }).OS = originalPlatformOS
    })

    it('renders a real, crawlable anchor with the article href and a title-based accessible name', () => {
      const { UNSAFE_root } = render(<ArticleListItem article={mockArticle} />)

      const link = getWebCardLink(UNSAFE_root)
      expect(link.props.href).toBe('/article/1?from=%2Farticles')
      // The article title is the accessible name — no invented UI phrase, and
      // the excerpt/category text inside stays out of it (matches the Task
      // Contract's "link name берётся из существующего article title").
      expect(link.props['aria-label']).toBe('Test Article')
      // A real `<a href>` is keyboard-focusable natively — unlike the old
      // Pressable-as-div output, no explicit `tabIndex` is needed (or set).
      expect(link.props.tabIndex).toBeUndefined()
    })

    it('uses client routing for a primary click and leaves modified clicks to the browser', () => {
      const { UNSAFE_root } = render(<ArticleListItem article={mockArticle} />)
      const link = getWebCardLink(UNSAFE_root)

      const primaryPreventDefault = jest.fn()
      fireEvent(link, 'click', { button: 0, preventDefault: primaryPreventDefault })
      expect(primaryPreventDefault).toHaveBeenCalledTimes(1)
      expect(mockPush).toHaveBeenCalledWith('/article/1?from=%2Farticles')

      mockPush.mockClear()
      const modifiedPreventDefault = jest.fn()
      fireEvent(link, 'click', {
        button: 0,
        ctrlKey: true,
        preventDefault: modifiedPreventDefault,
      })
      // A real `href` lets the browser open a new tab on its own — nothing to
      // intercept, so the router must stay untouched.
      expect(modifiedPreventDefault).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('activates on Space, the one key anchors do not handle natively', () => {
      const { UNSAFE_root } = render(<ArticleListItem article={mockArticle} />)
      const link = getWebCardLink(UNSAFE_root)

      const preventDefault = jest.fn()
      fireEvent(link, 'keyDown', { key: ' ', preventDefault })
      expect(preventDefault).toHaveBeenCalledTimes(1)
      expect(mockPush).toHaveBeenCalledWith('/article/1?from=%2Farticles')
    })

    it('keeps the whole card inside a single anchor with no nested interactive descendants', () => {
      const { UNSAFE_root } = render(<ArticleListItem article={mockArticle} />)

      const links = UNSAFE_root.findAll((node) => node.type === 'a')
      expect(links).toHaveLength(1)

      const [link] = links
      const nestedInteractive = link.findAll(
        (node) =>
          node !== link &&
          (node.type === 'a' ||
            typeof node.props?.onPress === 'function' ||
            node.props?.role === 'button' ||
            node.props?.accessibilityRole === 'button'),
      )
      expect(nestedInteractive).toHaveLength(0)
    })
  })
})
