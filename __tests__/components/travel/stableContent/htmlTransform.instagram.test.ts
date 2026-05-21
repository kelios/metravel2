jest.mock('react-native', () => ({
  Platform: {
    OS: 'web',
  },
}))

import { prepareStableContentHtml } from '@/components/travel/stableContent/htmlTransform'
import { replaceInstagramEmbedsWithCards } from '@/utils/instagramRichText'

describe('prepareStableContentHtml Instagram embeds on web travel content', () => {
  it('keeps real Instagram iframe embeds visible in travel rich text on web', () => {
    const result = prepareStableContentHtml(
      '<p><iframe src="https://www.instagram.com/p/CRTm_GpnjVR/embed/captioned/?cr=1&amp;v=14" width="540" height="680"></iframe></p>',
    )

    expect(result).toContain('<iframe')
    expect(result).not.toContain('rich-social-card--instagram')
    expect(result).toContain('https://www.instagram.com/p/CRTm_GpnjVR/embed/captioned/?cr=1&amp;v=14')
  })

  it('keeps production Instagram iframe embeds with long query and hash params visible', () => {
    const result = prepareStableContentHtml(
      '<iframe src="https://www.instagram.com/p/CRTm_GpnjVR/embed/captioned/?cr=1&amp;v=14&amp;wp=607&amp;rd=https%3A%2F%2Fmetravel.by&amp;rp=%2Ftravels%2Fakkaunty-v-instagram-o-puteshestviyah-po-belarusi%2Fedit#%7B%22ci%22%3A0%7D" title="Embedded content" allowfullscreen="true" frameborder="0" height="1354"></iframe>',
    )

    expect(result).toContain('<iframe')
    expect(result).not.toContain('rich-social-card--instagram')
    expect(result).toContain('https://www.instagram.com/p/CRTm_GpnjVR/embed/captioned/?cr=1&amp;v=14')
  })

  it('keeps protocol-relative and self-closing Instagram iframe embeds visible', () => {
    const result = prepareStableContentHtml(
      '<p><iframe src="//www.instagram.com/reel/CScU4bJI2Ud/embed/captioned/?utm_source=ig_embed&amp;utm_campaign=loading" /></p>',
    )

    expect(result).toContain('<iframe')
    expect(result).not.toContain('rich-social-card--instagram')
    expect(result).toContain('https://www.instagram.com/reel/CScU4bJI2Ud/embed/captioned/')
  })

  it('still converts Instagram blockquote fallbacks into safe cards', () => {
    const result = replaceInstagramEmbedsWithCards(
      '<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/CRTm_GpnjVR/"></blockquote>',
    )

    expect(result).toContain('rich-social-card--instagram')
    expect(result).not.toContain('instagram-media')
  })
})
