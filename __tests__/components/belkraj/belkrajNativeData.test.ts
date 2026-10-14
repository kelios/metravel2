import { loadBelkrajNativeData, parseBelkrajNativeData } from '@/components/belkraj/belkrajNativeData.native'

// Shape of the server-rendered Minsk/Warsaw widget, including relative affiliate links.
const fixture = `<html><head><script src="https://www.googletagmanager.com/gtm.js"></script></head>
<body><noscript><iframe src="https://www.googletagmanager.com/ns.html"></iframe></noscript>
<h2><a class="exp-row__title-link" href="/poland/warszawa/experiences?partner=u180793">Экскурсии в Варшаве</a></h2>
<figure class="exp-card">
<a class="exp-card__img-link" href="/poland/warszawa/experience/walk?partner=u180793"><img class="exp-card__img"
src="https://belkraj.by/sites/default/files/styles/381x288/public/uploads/experience/photo.jpg?itok=test&amp;tracking=bad"></a>
<figcaption><a class="exp-card__title exp-card__title__link" onclick="track()" href="/poland/warszawa/experience/walk?utm_source=u180793&amp;partner=u180793">Варшава &amp; история</a>
<div class="exp-card__text"><span>Пешеходная экскурсия</span><script>trackUser()</script></div>
<a class="exp-card__rating" title="5 баллов по 8 отзывам"><i></i></a></figcaption></figure>
<div class="exp-footer"><a href="/poland/warszawa/experiences?partner=u180793">Посмотреть все</a></div></body></html>`

describe('Belkraj native data extraction', () => {
  it('extracts visible editorial fields without executing/loading scripts or embeds', () => {
    expect(parseBelkrajNativeData(fixture)).toEqual({
      title: 'Экскурсии в Варшаве',
      listUrl: 'https://belkraj.by/poland/warszawa/experiences?partner=u180793',
      listLabel: 'Посмотреть все',
      cards: [{
        url: 'https://belkraj.by/poland/warszawa/experience/walk?utm_source=u180793&partner=u180793',
        title: 'Варшава & история',
        imageUrl: 'https://belkraj.by/sites/default/files/styles/381x288/public/uploads/experience/photo.jpg?itok=test',
        subtitle: 'Пешеходная экскурсия',
        rating: '5 баллов по 8 отзывам',
      }],
    })
  })

  it.each(['javascript:track()', 'https://evil.test/experience/walk', 'https://belkraj.by@evil.test/experience/walk', '/partner/widget'])('rejects unsafe/non-excursion card links %s', (url) => {
    const invalid = fixture.replace('href="/poland/warszawa/experience/walk?utm_source=u180793&amp;partner=u180793"', `href="${url}"`)
    expect(() => parseBelkrajNativeData(invalid)).toThrow('selection unavailable')
  })

  it.each([
    'https://evil.test/photo.jpg',
    'https://belkraj.by/pixel.jpg',
    'https://belkraj.by/sites/default/files/styles/381x288/public/uploads/experience/pixel.svg',
    'http://belkraj.by/sites/default/files/styles/381x288/public/uploads/experience/photo.jpg',
  ])('keeps a card but blocks unsafe image %s', (url) => {
    const result = parseBelkrajNativeData(fixture.replace(/src="https:\/\/belkraj.by[^"]+"/, `src="${url}"`))
    expect(result.cards[0].imageUrl).toBeNull()
    expect(result.cards[0].title).toBe('Варшава & история')
  })

  it('rejects challenge/empty pages and bounds document size', () => {
    expect(() => parseBelkrajNativeData('<html>Checking your browser</html>')).toThrow('selection unavailable')
    expect(() => parseBelkrajNativeData('x'.repeat(1_000_001))).toThrow('document too large')
  })

  it('does not treat a default promotional tile as an excursion', () => {
    expect(() => parseBelkrajNativeData('<figure class="exp-card exp-card_default"><a href="/" class="exp-card-default__title">Partner</a></figure>')).toThrow('selection unavailable')
  })
})

describe('Belkraj transport', () => {
  const originalFetch = global.fetch
  const url = 'https://belkraj.by/partner/widget?lat=53.9&lng=27.56&country=BY&partner=u180793'
  afterEach(() => { global.fetch = originalFetch })

  it('uses the partner endpoint without auth headers or credentials', async () => {
    const signal = new AbortController().signal
    global.fetch = jest.fn().mockResolvedValue({ ok: true, url, text: async () => fixture })
    const result = await loadBelkrajNativeData(url, signal)
    expect(global.fetch).toHaveBeenCalledWith(url, { credentials: 'omit', signal, headers: { Accept: 'text/html' } })
    expect(result.cards).toHaveLength(1)
  })

  it('rejects redirects to other origins and HTTP failures', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, url: 'https://evil.test/', text: jest.fn() })
    await expect(loadBelkrajNativeData(url, new AbortController().signal)).rejects.toThrow('redirect')
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 })
    await expect(loadBelkrajNativeData(url, new AbortController().signal)).rejects.toThrow('HTTP 503')
  })

  it('rejects cancellation while reading the body', async () => {
    const controller = new AbortController()
    global.fetch = jest.fn().mockResolvedValue({ ok: true, url, text: async () => { controller.abort(); return fixture } })
    await expect(loadBelkrajNativeData(url, controller.signal)).rejects.toThrow('cancelled')
  })
})
