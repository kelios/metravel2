const mockOpenExternalUrl = jest.fn(async () => true)

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...(args as [])),
}))

import {
  createThirdPartyNavigationGuard,
  decideThirdPartyNavigation,
} from '@/utils/thirdPartyWebViewPrivacy'

// #2135 / App Review 5.1.2(i): в стороннем WebView грузится только исходный
// документ; переход по карточке партнёра открыл страницу belkraj.by с GTM
// (Facebook Pixel, Google Ads, GA4) внутри приложения (iOS QA 03.10.2026).

const WIDGET_URL =
  'https://belkraj.by/partner/widget?lat=53.9&lng=27.56&term=place&theme=cards&partner=u180793&size=6&country=BY'
const CARD_URL = 'https://belkraj.by/belarus/minsk/experience/alyy-minsk?utm_source=u180793&partner=u180793'
const YOUTUBE_BASE_URL = 'https://metravel.by'
const YOUTUBE_EMBED_URL =
  'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=https%3A%2F%2Fmetravel.by'

const widgetPolicy = { documentUrl: WIDGET_URL }
const youtubePolicy = { documentUrl: YOUTUBE_BASE_URL, frameUrls: [YOUTUBE_EMBED_URL] }

describe('decideThirdPartyNavigation (#2135)', () => {
  it('allows the initial document, its reload and in-page anchors', () => {
    expect(decideThirdPartyNavigation({ url: WIDGET_URL, navigationType: 'other', isTopFrame: true }, widgetPolicy)).toBe('allow')
    expect(decideThirdPartyNavigation({ url: WIDGET_URL, navigationType: 'reload', isTopFrame: true }, widgetPolicy)).toBe('allow')
    expect(decideThirdPartyNavigation({ url: `${WIDGET_URL}#top`, navigationType: 'click', isTopFrame: true }, widgetPolicy)).toBe('allow')
  })

  it('normalizes scheme/host case, default port and the empty path of the initial document', () => {
    expect(decideThirdPartyNavigation({ url: 'https://metravel.by/', navigationType: 'other', isTopFrame: true }, youtubePolicy)).toBe('allow')
    expect(decideThirdPartyNavigation({ url: 'HTTPS://Metravel.by:443', navigationType: 'other', isTopFrame: true }, youtubePolicy)).toBe('allow')
  })

  it('sends a same-origin click on another path outside the app', () => {
    expect(decideThirdPartyNavigation({ url: CARD_URL, navigationType: 'click', isTopFrame: true }, widgetPolicy)).toBe('external')
  })

  it('sends another path and another query outside the app even without a click', () => {
    expect(decideThirdPartyNavigation({ url: CARD_URL, navigationType: 'other', isTopFrame: true }, widgetPolicy)).toBe('external')
    expect(
      decideThirdPartyNavigation({ url: 'https://belkraj.by/partner/widget?lat=1', navigationType: 'other', isTopFrame: true }, widgetPolicy),
    ).toBe('external')
  })

  it('sends another host outside the app', () => {
    expect(decideThirdPartyNavigation({ url: 'https://example.com/tour', navigationType: 'click', isTopFrame: true }, widgetPolicy)).toBe('external')
    expect(
      decideThirdPartyNavigation({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', navigationType: 'click', isTopFrame: true }, youtubePolicy),
    ).toBe('external')
  })

  it('treats a new window (target=_blank) as leaving the document, even on the same URL', () => {
    expect(decideThirdPartyNavigation({ url: CARD_URL, navigationType: 'click', hasTargetFrame: false }, widgetPolicy)).toBe('external')
    expect(decideThirdPartyNavigation({ url: WIDGET_URL, navigationType: 'click', hasTargetFrame: false }, widgetPolicy)).toBe('external')
  })

  it('allows inert documents: about:blank, about:srcdoc and data:', () => {
    expect(decideThirdPartyNavigation({ url: 'about:blank', isTopFrame: true }, widgetPolicy)).toBe('allow')
    expect(decideThirdPartyNavigation({ url: 'about:srcdoc', isTopFrame: false }, widgetPolicy)).toBe('allow')
    expect(decideThirdPartyNavigation({ url: 'data:text/html,<p>x</p>', isTopFrame: false }, widgetPolicy)).toBe('allow')
  })

  it('treats Android events (no navigationType/isTopFrame) as top-level navigation', () => {
    expect(decideThirdPartyNavigation({ url: CARD_URL }, widgetPolicy)).toBe('external')
    expect(decideThirdPartyNavigation({ url: WIDGET_URL }, widgetPolicy)).toBe('allow')
  })

  it('allows only declared frames and blocks undeclared ones silently', () => {
    expect(decideThirdPartyNavigation({ url: YOUTUBE_EMBED_URL, navigationType: 'other', isTopFrame: false }, youtubePolicy)).toBe('allow')
    expect(
      decideThirdPartyNavigation(
        { url: 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=0', navigationType: 'other', isTopFrame: false },
        youtubePolicy,
      ),
    ).toBe('allow')
    expect(
      decideThirdPartyNavigation({ url: 'https://www.googletagmanager.com/ns.html?id=GTM-X', navigationType: 'other', isTopFrame: false }, youtubePolicy),
    ).toBe('block')
    expect(decideThirdPartyNavigation({ url: YOUTUBE_EMBED_URL, navigationType: 'other', isTopFrame: false }, widgetPolicy)).toBe('block')
  })

  it('sends a user navigation inside a frame outside the app', () => {
    expect(
      decideThirdPartyNavigation({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', navigationType: 'click', isTopFrame: false }, youtubePolicy),
    ).toBe('external')
  })

  it('blocks empty, scripted and look-alike addresses', () => {
    expect(decideThirdPartyNavigation({ url: '' }, widgetPolicy)).toBe('block')
    expect(decideThirdPartyNavigation({ url: 'javascript:alert(1)', isTopFrame: true }, widgetPolicy)).toBe('block')
    expect(decideThirdPartyNavigation({ url: 'https://belkraj.by@evil.example/partner/widget', isTopFrame: true }, widgetPolicy)).toBe('block')
    expect(
      decideThirdPartyNavigation({ url: 'https://belkraj.by.evil.example/partner/widget?lat=53.9', isTopFrame: true }, widgetPolicy),
    ).toBe('external')
  })
})

describe('createThirdPartyNavigationGuard (#2135)', () => {
  beforeEach(() => {
    mockOpenExternalUrl.mockClear()
  })

  it('keeps the initial document in the WebView without opening anything', () => {
    const guard = createThirdPartyNavigationGuard(widgetPolicy)

    expect(guard.onShouldStartLoadWithRequest({ url: WIDGET_URL, navigationType: 'other', isTopFrame: true })).toBe(true)
    expect(guard.onShouldStartLoadWithRequest({ url: 'about:blank', isTopFrame: true })).toBe(true)
    expect(mockOpenExternalUrl).not.toHaveBeenCalled()
  })

  it('cancels a card click and opens it through the external-link chokepoint', () => {
    const guard = createThirdPartyNavigationGuard(widgetPolicy)

    expect(guard.onShouldStartLoadWithRequest({ url: CARD_URL, navigationType: 'click', isTopFrame: true })).toBe(false)
    expect(mockOpenExternalUrl).toHaveBeenCalledTimes(1)
    expect(mockOpenExternalUrl).toHaveBeenCalledWith(CARD_URL, { allowedProtocols: ['https:'] })
  })

  it('cancels an undeclared frame without opening the browser', () => {
    const guard = createThirdPartyNavigationGuard(youtubePolicy)

    expect(
      guard.onShouldStartLoadWithRequest({ url: 'https://ads.example/frame', navigationType: 'other', isTopFrame: false }),
    ).toBe(false)
    expect(mockOpenExternalUrl).not.toHaveBeenCalled()
  })

  it('opens target=_blank windows outside the app and ignores blank ones', () => {
    const guard = createThirdPartyNavigationGuard(youtubePolicy)

    guard.onOpenWindow({ nativeEvent: { targetUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } })
    guard.onOpenWindow({ nativeEvent: { targetUrl: 'about:blank' } })
    guard.onOpenWindow({ nativeEvent: { targetUrl: '' } })

    expect(mockOpenExternalUrl).toHaveBeenCalledTimes(1)
    expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://www.youtube.com/watch?v=dQw4w9WgXcQ', {
      allowedProtocols: ['https:'],
    })
  })

  it('pins window settings so new windows reach the guard on both platforms', () => {
    const guard = createThirdPartyNavigationGuard(widgetPolicy)

    expect(guard.setSupportMultipleWindows).toBe(false)
    expect(guard.javaScriptCanOpenWindowsAutomatically).toBe(false)
    expect(Object.isFrozen(guard)).toBe(true)
  })
})
