/**
 * @jest-environment node
 */

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
}))

import { prepareStableContentHtml } from '@/components/travel/stableContent/htmlTransform'
import { replaceInstagramEmbedsWithCards } from '@/utils/instagramRichText'

// Native-ветка `prepareStableContentHtml` — это `Platform.OS !== 'web'` И отсутствие
// DOM, поэтому мало замокать Platform: нужен node-environment и снятый `document`
// (его подкладывает общий setup). Через `delete` нельзя — jsdom-teardown падает.
const globalScope = globalThis as { document?: unknown }
const originalDocument = globalScope.document

beforeAll(() => {
  Object.defineProperty(globalScope, 'document', { value: undefined, configurable: true })
})

afterAll(() => {
  Object.defineProperty(globalScope, 'document', { value: originalDocument, configurable: true })
})

// Регресс-страж: на Android посты Instagram обязаны оставаться постами, а не
// схлопываться в карточку-ссылку — mobile web и Android показывают одно и то же
// (AGENTS.md 3.3). iframe доезжает до RNRH, который отдаёт его в WebView-компонент.
describe('prepareStableContentHtml Instagram embeds on native travel content', () => {
  it('keeps a real Instagram iframe embed instead of a link card', () => {
    const result = prepareStableContentHtml(
      '<p><iframe src="https://www.instagram.com/p/CRTm_GpnjVR/embed/captioned/?cr=1&amp;v=14" width="540" height="680"></iframe></p>',
    )

    expect(result).toContain('<iframe')
    expect(result).toContain('https://www.instagram.com/p/CRTm_GpnjVR/embed/?omitscript=true&amp;hidecaption=1')
    expect(result).not.toContain('rich-social-card')
    expect(result).not.toContain('ig-lite')
  })

  it('converts a standalone Instagram post link into an embed', () => {
    const result = prepareStableContentHtml(
      '<p><a href="https://www.instagram.com/p/CRTm_GpnjVR/">https://www.instagram.com/p/CRTm_GpnjVR/</a></p>',
    )

    expect(result).toContain('<iframe')
    expect(result).toContain('https://www.instagram.com/p/CRTm_GpnjVR/embed/')
  })

  it('uses the same embed URL as the web facade', () => {
    const native = replaceInstagramEmbedsWithCards(
      '<iframe src="https://www.instagram.com/reel/CScU4bJI2Ud/embed/captioned/"></iframe>',
      { iframeStrategy: 'embed' },
    )
    const web = replaceInstagramEmbedsWithCards(
      '<iframe src="https://www.instagram.com/reel/CScU4bJI2Ud/embed/captioned/"></iframe>',
      { iframeStrategy: 'facade' },
    )

    const nativeSrc = native.match(/src="([^"]+)"/)?.[1]
    const webSrc = web.match(/data-ig-embed="([^"]+)"/)?.[1]
    expect(nativeSrc).toBe(webSrc)
  })

  it('falls back to a static card for story URLs that have no embed endpoint', () => {
    const result = replaceInstagramEmbedsWithCards(
      '<iframe src="https://www.instagram.com/stories/metravelby/123456/"></iframe>',
      { iframeStrategy: 'embed' },
    )

    expect(result).toContain('rich-social-card--instagram')
    expect(result).not.toContain('<iframe')
  })

  it('leaves plain profile links alone — они не embeddable', () => {
    const html = '<p><a href="https://www.instagram.com/udivitelnaya_belarus">@udivitelnaya_belarus</a></p>'
    const result = replaceInstagramEmbedsWithCards(html, { iframeStrategy: 'embed' })

    expect(result).toBe(html)
  })

  it('leaves non-Instagram iframes untouched', () => {
    const html = '<iframe src="https://player.vimeo.com/video/123"></iframe>'

    expect(replaceInstagramEmbedsWithCards(html, { iframeStrategy: 'embed' })).toBe(html)
  })
})
