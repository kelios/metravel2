import {
  buildInstagramEmbedHtmlFromUrl,
  normalizeArticleEditorHtmlForInput,
  normalizeArticleEditorHtmlForOutput,
} from '@/components/article/articleEditorConfig'

describe('articleEditorConfig instagram embeds', () => {
  it('builds embed html from instagram post url', () => {
    expect(
      buildInstagramEmbedHtmlFromUrl(
        'https://www.instagram.com/p/CScU4bJI2Ud/?utm_source=ig_web_copy_link',
      ),
    ).toContain('https://www.instagram.com/p/CScU4bJI2Ud/embed/captioned/')
  })

  it('converts standalone instagram anchor paragraph into iframe embed', () => {
    const html =
      '<p><a href="https://www.instagram.com/p/CScU4bJI2Ud/">https://www.instagram.com/p/CScU4bJI2Ud/</a></p>'

    const normalized = normalizeArticleEditorHtmlForInput(html)

    expect(normalized).toContain('<iframe')
    expect(normalized).toContain('https://www.instagram.com/p/CScU4bJI2Ud/embed/captioned/')
  })

  it('converts standalone instagram plain url into iframe embed', () => {
    const normalized = normalizeArticleEditorHtmlForInput('https://www.instagram.com/reel/CScU4bJI2Ud/')

    expect(normalized).toContain('<iframe')
    expect(normalized).toContain('https://www.instagram.com/reel/CScU4bJI2Ud/embed/captioned/')
  })

  it('preserves instagram embed in sanitized output', () => {
    const output = normalizeArticleEditorHtmlForOutput('https://www.instagram.com/p/CScU4bJI2Ud/')

    expect(output).toContain('<iframe')
    expect(output).toContain('title="Instagram post"')
  })

  it('does not convert instagram profile links', () => {
    const html =
      '<p><a href="https://www.instagram.com/metravelby/">https://www.instagram.com/metravelby/</a></p>'

    const normalized = normalizeArticleEditorHtmlForInput(html)

    expect(normalized).not.toContain('<iframe')
    expect(normalized).toContain('https://www.instagram.com/metravelby/')
  })
})
