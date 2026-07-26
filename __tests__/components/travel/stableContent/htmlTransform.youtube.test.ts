jest.mock('react-native', () => ({
  Platform: {
    OS: 'web',
  },
}))

import { prepareStableContentHtml } from '@/components/travel/stableContent/htmlTransform'

describe('prepareStableContentHtml YouTube embeds on web travel content', () => {
  it('turns a canonical /embed/<id> iframe into a click-to-play facade', () => {
    const result = prepareStableContentHtml(
      '<p><iframe src="https://www.youtube.com/embed/GvF5aa5dsbw" width="560" height="315"></iframe></p>',
    )

    expect(result).not.toContain('<iframe')
    expect(result).toContain('class="yt-lite"')
    expect(result).toContain('data-yt="GvF5aa5dsbw"')
    expect(result).toContain('https://i.ytimg.com/vi/GvF5aa5dsbw/hqdefault.jpg')
  })
})
