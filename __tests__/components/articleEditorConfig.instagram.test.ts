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
    expect(output).toContain('class="ql-video"')
    expect(output).toContain('title="Instagram post"')
  })

  it('keeps ql-video class when sanitizing a pasted instagram iframe', () => {
    const output = normalizeArticleEditorHtmlForOutput(
      `<iframe
        class="ql-video"
        frameborder="0"
        allowfullscreen="true"
        src="https://www.instagram.com/p/DPebCAMDdCv/embed/captioned/"
        width="540"
        height="680"></iframe>`,
    )

    expect(output).toContain('class="ql-video"')
    expect(output).toContain('https://www.instagram.com/p/DPebCAMDdCv/embed/captioned/')
  })

  it('does not convert instagram profile links', () => {
    const html =
      '<p><a href="https://www.instagram.com/metravelby/">https://www.instagram.com/metravelby/</a></p>'

    const normalized = normalizeArticleEditorHtmlForInput(html)

    expect(normalized).not.toContain('<iframe')
    expect(normalized).toContain('https://www.instagram.com/metravelby/')
  })
})
