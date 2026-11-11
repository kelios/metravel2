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

  // #3264: один формат id у разметки фасада и у обработчика клика.
  it('writes into data-yt only an id the click handler accepts', () => {
    const { YOUTUBE_FACADE_VIDEO_ID_RE, extractYouTubeFacadeVideoId } = require('@/components/travel/stableContent/youtubeFacadeId')
    const tooLong = 'a'.repeat(21)

    expect(extractYouTubeFacadeVideoId('https://www.youtube.com/embed/GvF5aa5dsbw?rel=0')).toBe('GvF5aa5dsbw')
    expect(extractYouTubeFacadeVideoId('https://www.youtube.com/watch?list=x&v=GvF5aa5dsbw')).toBe('GvF5aa5dsbw')
    expect(extractYouTubeFacadeVideoId('https://youtu.be/GvF5aa5dsbw')).toBe('GvF5aa5dsbw')
    expect(extractYouTubeFacadeVideoId(`https://www.youtube.com/embed/${tooLong}`)).toBeUndefined()
    expect(YOUTUBE_FACADE_VIDEO_ID_RE.test(tooLong)).toBe(false)

    const result = prepareStableContentHtml(`<p><iframe src="https://www.youtube.com/embed/${tooLong}"></iframe></p>`)
    expect(result).not.toContain('data-yt=')
  })
})
