jest.mock('react-native', () => ({
  Platform: {
    OS: 'web',
  },
}))

import { prepareStableContentHtml } from '@/components/travel/stableContent/htmlTransform'
import { replaceInstagramEmbedsWithCards } from '@/utils/instagramRichText'
import { sanitizeRichText } from '@/utils/sanitizeRichText'

describe('prepareStableContentHtml Instagram embeds on web travel content', () => {
  it('defers real Instagram iframe embeds behind a lazy facade on web', () => {
    const result = prepareStableContentHtml(
      '<p><iframe src="https://www.instagram.com/p/CRTm_GpnjVR/embed/captioned/?cr=1&amp;v=14" width="540" height="680"></iframe></p>',
    )

    expect(result).not.toContain('<iframe')
    expect(result).toContain('ig-lite')
    expect(result).toContain('data-ig-embed')
    expect(result).toContain('https://www.instagram.com/p/CRTm_GpnjVR/embed/')
  })

  it('builds a facade from production Instagram iframe embeds with long query and hash params', () => {
    const result = prepareStableContentHtml(
      '<iframe src="https://www.instagram.com/p/CRTm_GpnjVR/embed/captioned/?cr=1&amp;v=14&amp;wp=607&amp;rd=https%3A%2F%2Fmetravel.by&amp;rp=%2Ftravels%2Fakkaunty-v-instagram-o-puteshestviyah-po-belarusi%2Fedit#%7B%22ci%22%3A0%7D" title="Embedded content" allowfullscreen="true" frameborder="0" height="1354"></iframe>',
    )

    expect(result).not.toContain('<iframe')
    expect(result).toContain('ig-lite')
    expect(result).toContain('https://www.instagram.com/p/CRTm_GpnjVR/embed/')
  })

  it('builds a facade from protocol-relative and self-closing Instagram iframe embeds', () => {
    const result = prepareStableContentHtml(
      '<p><iframe src="//www.instagram.com/reel/CScU4bJI2Ud/embed/captioned/?utm_source=ig_embed&amp;utm_campaign=loading" /></p>',
    )

    expect(result).not.toContain('<iframe')
    expect(result).toContain('ig-lite')
    expect(result).toContain('https://www.instagram.com/reel/CScU4bJI2Ud/embed/')
  })

  it('escapes the embed src inside the facade attribute', () => {
    const result = prepareStableContentHtml(
      '<p><iframe src="https://www.instagram.com/p/CRTm_GpnjVR/embed/captioned/?cr=1"></iframe></p>',
    )

    expect(result).toContain(
      'data-ig-embed="https://www.instagram.com/p/CRTm_GpnjVR/embed/?omitscript=true&amp;hidecaption=1"',
    )
  })

  it('leaves non-Instagram iframes untouched under the facade strategy', () => {
    const html = '<iframe src="https://player.vimeo.com/video/123"></iframe>'
    const result = replaceInstagramEmbedsWithCards(html, { iframeStrategy: 'facade' })

    expect(result).toBe(html)
  })

  it('falls back to a static card for story URLs that have no embed endpoint', () => {
    const result = replaceInstagramEmbedsWithCards(
      '<iframe src="https://www.instagram.com/stories/metravelby/123456/"></iframe>',
      { iframeStrategy: 'facade' },
    )

    expect(result).toContain('rich-social-card--instagram')
    expect(result).not.toContain('ig-lite')
    expect(result).not.toContain('data-ig-embed')
  })

  it('still converts Instagram blockquote fallbacks into safe cards', () => {
    const result = replaceInstagramEmbedsWithCards(
      '<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/CRTm_GpnjVR/"></blockquote>',
    )

    expect(result).toContain('rich-social-card--instagram')
    expect(result).not.toContain('instagram-media')
  })

  it('allows data-ig-embed only on div during sanitization', () => {
    const sanitized = sanitizeRichText(
      '<div class="ig-lite" data-ig-embed="https://www.instagram.com/p/X/embed/"></div>' +
        '<p data-ig-embed="https://evil.example/">text</p>',
    )

    expect(sanitized).toContain('<div class="ig-lite" data-ig-embed=')
    expect(sanitized).not.toContain('evil.example')
  })
})
