import { fireEvent, render } from '@testing-library/react-native'

import ArticleAuthorBanner, { resolveArticleAuthor } from '@/components/article/ArticleAuthorBanner'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
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

describe('ArticleAuthorBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('resolves author from user payload first', () => {
    expect(resolveArticleAuthor({
      name: 'Article',
      description: '',
      article_image_thumb_url: '',
      article_image_thumb_small_url: '',
      article_type: {} as any,
      user: {
        id: 42,
        first_name: 'Юлия',
        last_name: 'Савран',
      },
      userName: 'Legacy Name',
    })).toEqual({ name: 'Юлия Савран', userId: '42' })
  })

  it('opens travels by author when author id exists', () => {
    const { getByText, getByLabelText } = render(
      <ArticleAuthorBanner
        article={{
          name: 'Article',
          description: '',
          article_image_thumb_url: '',
          article_image_thumb_small_url: '',
          article_type: {} as any,
          user: {
            id: 42,
            name: 'Анна Автор',
          },
        }}
      />,
    )

    expect(getByText('Анна Автор')).toBeTruthy()
    expect(getByText('Путешествия автора')).toBeTruthy()

    fireEvent.press(getByLabelText('Открыть путешествия автора Анна Автор'))

    expect(mockPush).toHaveBeenCalledWith('/search?user_id=42')
  })

  it('does not render a fake author when backend does not provide author fields', () => {
    const { queryByText } = render(
      <ArticleAuthorBanner
        article={{
          id: 1,
          name: 'Розыгрыш трех термосов.',
          description: '',
          article_image_thumb_url: '',
          article_image_thumb_small_url: '',
          article_type: {} as any,
        }}
      />,
    )

    expect(queryByText('Автор путешествия')).toBeNull()
    expect(queryByText('Путешествия автора')).toBeNull()
  })
})
