jest.mock('react-native', () => ({
  Platform: {
    OS: 'web',
  },
}))

import { prepareStableContentHtml } from '@/components/travel/stableContent/htmlTransform'
import { replaceInstagramEmbedsWithCards } from '@/utils/instagramRichText'

describe('prepareStableContentHtml Instagram embeds on web travel content', () => {
  it('converts real Instagram iframe embeds into safe cards for travel rich text', () => {
    const result = prepareStableContentHtml(
      '<p><iframe src="https://www.instagram.com/p/CRTm_GpnjVR/embed/captioned/?cr=1&amp;v=14" width="540" height="680"></iframe></p>',
    )

    expect(result).not.toContain('<iframe')
    expect(result).toContain('rich-social-card--instagram')
    expect(result).toContain('https://www.instagram.com/p/CRTm_GpnjVR/')
  })

  it('still converts Instagram blockquote fallbacks into safe cards', () => {
    const result = replaceInstagramEmbedsWithCards(
      '<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/CRTm_GpnjVR/"></blockquote>',
    )

    expect(result).toContain('rich-social-card--instagram')
    expect(result).not.toContain('instagram-media')
  })
})
