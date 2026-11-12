import { toInertHtml } from '@/utils/inertHtml'
import { releaseDeferredRichTextImages } from '@/utils/richTextDeferredImages'
import { buildDeferredRichTextImagesScript } from '@/utils/richTextDeferredImagesShell'

/**
 * #3316: картинки серверного острова тела статьи не запрашиваются до LCP-фото.
 * `loading="lazy"` их не держит: под мобильным троттлингом Chrome грузит ленивые
 * картинки ближе 2500 px, и первые кадры тела шли вместе с hero. Читатель без JS
 * получает ту же картинку по исходному адресу из `noscript`.
 */

const BODY =
  '<p>Текст</p>' +
  '<p><img alt="Указатель" height="1600" loading="lazy" src="https://metravel.by/travel-description-image/a.jpg.webp" width="1200"></p>' +
  '<img src="https://metravel.by/b.webp?w=640&amp;v=2" srcset="https://metravel.by/b.webp?w=320 320w, https://metravel.by/b.webp?w=640 640w" sizes="100vw" alt="">' +
  '<img src="https://metravel.by/c.webp" data-deferred-src="javascript:alert(1)" data-deferred-srcset="https://evil.example/x.webp 1w" alt="">' +
  '<img src="javascript:alert(1)" alt="">' +
  '<noscript><img src="https://evil.example/author.webp"></noscript>'

const HOSTILE_ALT =
  '<p><img src="https://metravel.by/d.webp" alt="&quot;&gt;&lt;/noscript&gt;&lt;script&gt;alert(1)&lt;/script&gt;&lt;img src=x onerror=alert(2)&gt;"></p>'

/** Браузер с JS (jsdom в jest разбирает `noscript` как текст). */
const parse = (html: string) => {
  const host = document.createElement('div')
  host.innerHTML = html
  return host
}

/** Читатель без JS: у документа DOMParser скриптинг выключен, `noscript` — разметка. */
const parseWithoutScripting = (html: string) => new DOMParser().parseFromString(html, 'text/html').body

const networkSources = (root: ParentNode) =>
  Array.from(root.querySelectorAll('img')).flatMap((img) =>
    [img.getAttribute('src'), img.getAttribute('srcset')].filter(
      (value): value is string => Boolean(value) && !String(value).startsWith('data:'),
    ),
  )

const island = (html: string) => parse(`<div data-ssr-html-island="description">${html}</div>`)

describe('toInertHtml({ deferImages: true })', () => {
  const deferred = toInertHtml(BODY, { deferImages: true })

  it('leaves no network source on any body image of a scripting browser', () => {
    expect(networkSources(parse(deferred))).toEqual([])
  })

  it('keeps the box of a loading image: placeholder of the declared ratio, lazy, same dimensions', () => {
    const img = parse(deferred).querySelector('img[alt="Указатель"]') as HTMLImageElement
    expect(img.getAttribute('src')).toBe(
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 1600'%2F%3E",
    )
    expect(img.getAttribute('width')).toBe('1200')
    expect(img.getAttribute('height')).toBe('1600')
    expect(img.getAttribute('loading')).toBe('lazy')
    expect(img.getAttribute('data-deferred-src')).toBe('https://metravel.by/travel-description-image/a.jpg.webp')
  })

  it('gives a reader without JS exactly one noscript twin per deferred image, holding only that image', () => {
    const body = parseWithoutScripting(deferred)
    const deferredImages = Array.from(body.querySelectorAll('img[data-deferred-src],img[data-deferred-srcset]'))
    const twins = Array.from(body.querySelectorAll('noscript'))
    expect(deferredImages).toHaveLength(3)
    expect(twins).toHaveLength(deferredImages.length)
    deferredImages.forEach((img, index) => {
      const twin = twins[index]
      expect(img.nextElementSibling).toBe(twin)
      expect(twin.childNodes).toHaveLength(1)
      const fallback = twin.firstElementChild as HTMLImageElement
      expect(fallback.tagName).toBe('IMG')
      expect(fallback.getAttribute('src')).toBe(img.getAttribute('data-deferred-src'))
      expect(fallback.getAttribute('srcset')).toBe(img.getAttribute('data-deferred-srcset'))
      expect(fallback.getAttribute('sizes')).toBe(img.getAttribute('data-deferred-sizes'))
      expect(fallback.getAttribute('alt')).toBe(img.getAttribute('alt'))
      expect(fallback.getAttribute('width')).toBe(img.getAttribute('width'))
      expect(fallback.getAttribute('height')).toBe(img.getAttribute('height'))
      expect(fallback.getAttribute('loading')).toBe('lazy')
      expect(Array.from(fallback.attributes).some(({ name }) => name.startsWith('data-'))).toBe(false)
    })
    // Чужой noscript из исходника выбрасывает toInertHtml.
    expect(networkSources(body).filter((src) => src.includes('evil.example'))).toEqual([])
  })

  it('keeps a hostile alt inside the noscript twin for both readers', () => {
    const html = toInertHtml(HOSTILE_ALT, { deferImages: true })
    for (const root of [parse(html), parseWithoutScripting(html)]) {
      expect(root.querySelector('script')).toBeNull()
      expect(root.querySelectorAll('noscript')).toHaveLength(1)
      const attrs = Array.from(root.querySelectorAll('*')).flatMap((el) => Array.from(el.attributes).map(({ name }) => name))
      expect(attrs.filter((name) => name.startsWith('on'))).toEqual([])
    }
    expect(parse(html).querySelectorAll('img')).toHaveLength(1)
    const crawler = parseWithoutScripting(html)
    expect(crawler.querySelectorAll('img')).toHaveLength(2)
    expect(crawler.querySelector('noscript img')?.getAttribute('alt')).toBe(
      '"></noscript><script>alert(1)</script><img src=x onerror=alert(2)>',
    )
  })

  it('returns only sanitized addresses and adds no duplicate image', () => {
    const root = island(deferred)
    const before = root.querySelectorAll('img').length
    releaseDeferredRichTextImages(root)
    const images = Array.from(root.querySelectorAll('img'))
    expect(images).toHaveLength(before)
    expect(images.map((img) => img.getAttribute('src'))).toEqual([
      'https://metravel.by/travel-description-image/a.jpg.webp',
      'https://metravel.by/b.webp?w=640&v=2',
      'https://metravel.by/c.webp',
      null,
    ])
    expect(images[1].getAttribute('srcset')).toBe('https://metravel.by/b.webp?w=320 320w, https://metravel.by/b.webp?w=640 640w')
    expect(images[1].getAttribute('sizes')).toBe('100vw')
    expect(images[2].hasAttribute('srcset')).toBe(false)
    expect(root.querySelector('[data-deferred-src],[data-deferred-srcset],[data-deferred-sizes]')).toBeNull()
  })
})

describe('buildDeferredRichTextImagesScript', () => {
  const html = toInertHtml(BODY, { deferImages: true })

  const mount = (lcp: string) => {
    document.documentElement.className = ''
    document.body.innerHTML = `${lcp}<div data-ssr-html-island="description">${html}</div>`
    const hero = document.querySelector('img[data-lcp]')
    if (hero) Object.defineProperty(hero, 'complete', { configurable: true, value: false })
    // Исполняем тот же текст, что уйдёт в <script>.
    new Function(buildDeferredRichTextImagesScript())()
  }
  const released = () => networkSources(document.body).filter((src) => !src.includes('/hero.webp'))

  afterEach(() => {
    document.body.innerHTML = ''
    document.documentElement.className = ''
  })

  it('holds body images while the first-screen LCP photo loads and releases them on its load', () => {
    mount('<img data-lcp="true" src="/hero.webp">')
    expect(released()).toEqual([])
    document.querySelector('img[data-lcp]')?.dispatchEvent(new Event('load'))
    expect(released()).toContain('https://metravel.by/travel-description-image/a.jpg.webp')
  })

  it('releases on LCP error and on hydration, whichever comes first', async () => {
    mount('<img data-lcp="true" src="/hero.webp">')
    document.querySelector('img[data-lcp]')?.dispatchEvent(new Event('error'))
    expect(released()).toHaveLength(4)

    mount('<img data-lcp="true" src="/hero.webp">')
    document.documentElement.classList.add('app-hydrated')
    await Promise.resolve()
    expect(released()).toHaveLength(4)
  })

  it('releases at once when the first screen has no LCP photo', () => {
    mount('')
    expect(released()).toHaveLength(4)
  })
})
