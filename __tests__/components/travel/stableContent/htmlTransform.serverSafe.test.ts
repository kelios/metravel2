jest.mock('react-native', () => ({
  Platform: {
    OS: 'web',
  },
}))

jest.mock('@/utils/sanitizeRichText', () => ({
  sanitizeRichText: jest.fn((html: string) => html),
}))

jest.mock('@/components/article/articleEditorConfig', () => ({
  normalizeArticleEditorHtmlForInput: jest.fn((html: string) => html),
}))

import { prepareStableContentHtml } from '@/components/travel/stableContent/htmlTransform'
import { normalizeArticleEditorHtmlForInput } from '@/components/article/articleEditorConfig'
import { sanitizeRichText } from '@/utils/sanitizeRichText'

const mockedSanitize = sanitizeRichText as jest.MockedFunction<typeof sanitizeRichText>
const mockedNormalize = normalizeArticleEditorHtmlForInput as jest.MockedFunction<
  typeof normalizeArticleEditorHtmlForInput
>

describe('prepareStableContentHtml canonical rich_text.safe_html path (#709)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('serverSanitized: uses safe_html without the full normalize+sanitize pipeline', () => {
    const result = prepareStableContentHtml(
      '<h2 id="part1">Раздел</h2><p>Серверный canonical текст</p>',
      { serverSanitized: true },
    )

    expect(mockedSanitize).not.toHaveBeenCalled()
    expect(mockedNormalize).not.toHaveBeenCalled()
    expect(result).toContain('Серверный canonical текст')
    expect(result).toContain('id="part1"')
  })

  it('serverSanitized: cheap guard still strips executable vectors from server html', () => {
    const result = prepareStableContentHtml(
      '<p onclick="alert(1)">text</p><script>alert(2)</script><iframe src="https://evil.example/x"></iframe>',
      { serverSanitized: true },
    )

    expect(mockedSanitize).not.toHaveBeenCalled()
    expect(result).not.toContain('<script>')
    expect(result).not.toMatch(/onclick/i)
    expect(result).not.toContain('evil.example')
    expect(result).toContain('<p>text</p>')
  })

  it('serverSanitized: presentational transforms still apply (img lazy-load parity)', () => {
    const result = prepareStableContentHtml(
      '<p><img src="https://metravel.by/gallery/1.jpg" alt="Фото"></p>',
      { serverSanitized: true },
    )

    expect(result).toContain('loading="lazy"')
    expect(result).toContain('rich-image-frame')
  })

  it('legacy payload (no options): runs the full normalize+sanitize pipeline', () => {
    prepareStableContentHtml('<p>legacy</p>')

    expect(mockedNormalize).toHaveBeenCalledTimes(1)
    expect(mockedSanitize).toHaveBeenCalledTimes(1)
  })

  it('explicit serverSanitized:false also runs the full pipeline', () => {
    prepareStableContentHtml('<p>legacy</p>', { serverSanitized: false })

    expect(mockedNormalize).toHaveBeenCalledTimes(1)
    expect(mockedSanitize).toHaveBeenCalledTimes(1)
  })
})
