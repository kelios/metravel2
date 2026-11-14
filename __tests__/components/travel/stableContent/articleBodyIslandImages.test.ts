// #3408: серверный остров тела статьи адресует первопартийные фото теми же
// ступенями, что полный рендер (`prepareStableContentHtml`), а не оригиналом без
// `w`. Проверяется по живым функциям: построитель, инертный проход, обе
// реализации выпуска и сам полный рендер — без подмены ни одного из них.
import { Platform } from 'react-native'

import {
  articleBodyIslandDeferredImages,
  buildArticleBodyIslandImageSources,
} from '@/components/travel/stableContent/articleBodyImageUrls'
import { buildArticleBodyMediaIndex, type ArticleBodyMediaIndex } from '@/components/travel/stableContent/articleBodyMedia'
import { prepareStableContentHtml } from '@/components/travel/stableContent/htmlTransform'
import { toInertHtml } from '@/utils/inertHtml'
import { releaseDeferredRichTextImages } from '@/utils/richTextDeferredImages'
import { buildDeferredRichTextImagesScript } from '@/utils/richTextDeferredImagesShell'
import { isMetravelMediaHostname } from '@/utils/webResourceHints'
import {
  ARTICLE_BODY_ADDRESS_IMAGE_URL,
  ARTICLE_BODY_DESCRIPTION_IMAGE_URL,
  ARTICLE_BODY_LEGACY_UPLOAD_URL,
  PROD_ARTICLE_BODY_GROUP,
} from '@/__tests__/fixtures/prodArticleBodyManifest'
import type { TravelMediaGroup } from '@/types/types'

const MEDIA = buildArticleBodyMediaIndex(PROD_ARTICLE_BODY_GROUP)
// Кадр без манифеста — так выглядит сохранённый адрес, который на проде шёл без `w`.
const STORED_DESCRIPTION_IMAGE = 'https://metravel.by/travel-description-image/7351/description/photo.png.webp'
const EXTERNAL_IMAGE = 'https://example.com/photos/a.jpg'

type ImageAttrs = { src: string | null; srcset: string | null; sizes: string | null }

const withViewport = <T,>(width: number, os: typeof Platform.OS, run: () => T): T => {
  const originalOs = Platform.OS
  const originalWidth = window.innerWidth
  const originalDpr = window.devicePixelRatio
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true })
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
  Object.defineProperty(window, 'devicePixelRatio', { value: 3, configurable: true })
  try {
    return run()
  } finally {
    Object.defineProperty(Platform, 'OS', { value: originalOs, configurable: true })
    Object.defineProperty(window, 'innerWidth', { value: originalWidth, configurable: true })
    Object.defineProperty(window, 'devicePixelRatio', { value: originalDpr, configurable: true })
  }
}

const parse = (html: string) => {
  const host = document.createElement('div')
  host.innerHTML = html
  return host
}

const attrsOf = (img: Element | null | undefined): ImageAttrs => ({
  src: img?.getAttribute('src') ?? null,
  srcset: img?.getAttribute('srcset') ?? null,
  sizes: img?.getAttribute('sizes') ?? null,
})

// Тот же набор, что берёт `TravelDescription`: адреса ступеней и резерв места.
const islandOf = (html: string, media: ArticleBodyMediaIndex | null = MEDIA) =>
  toInertHtml(html, { deferImages: articleBodyIslandDeferredImages(media) })

const island = (src: string, media: ArticleBodyMediaIndex | null = MEDIA) =>
  islandOf(`<p>Текст</p><p><img src="${src}" alt=""></p>`, media)

const fullRender = (src: string, width: number, media: ArticleBodyMediaIndex | null = MEDIA): ImageAttrs =>
  withViewport(width, 'web', () =>
    attrsOf(parse(prepareStableContentHtml(`<p><img src="${src}" alt=""></p>`, {
      serverSanitized: true,
      articleBodyMedia: media,
    })).querySelector('img')),
  )

const releasedByComponent = (src: string, width: number, media: ArticleBodyMediaIndex | null = MEDIA): ImageAttrs =>
  withViewport(width, 'web', () => {
    const root = parse(`<div data-ssr-html-island="description">${island(src, media)}</div>`)
    releaseDeferredRichTextImages(root)
    return attrsOf(root.querySelector('img'))
  })

const releasedByShell = (src: string, width: number, media: ArticleBodyMediaIndex | null = MEDIA): ImageAttrs =>
  withViewport(width, 'web', () => {
    document.documentElement.className = ''
    // Без LCP-картинки первого экрана оболочка выпускает адреса сразу.
    document.body.innerHTML = `<div data-ssr-html-island="description">${island(src, media)}</div>`
    try {
      new Function(buildDeferredRichTextImagesScript())()
      return attrsOf(document.querySelector('[data-ssr-html-island] img'))
    } finally {
      document.body.innerHTML = ''
    }
  })

/** Все сетевые адреса острова, включая отложенные и `noscript`-двойник. */
const islandUrls = (html: string): string[] => {
  const body = new DOMParser().parseFromString(html, 'text/html').body
  return Array.from(body.querySelectorAll('img')).flatMap((img) =>
    ['src', 'srcset', 'data-deferred-src', 'data-deferred-srcset', 'data-deferred-srcset-mobile']
      .map((name) => img.getAttribute(name))
      .filter((value): value is string => Boolean(value) && !String(value).startsWith('data:'))
      .flatMap((value) => value.split(',').map((entry) => entry.trim().split(/\s+/)[0])),
  )
}

const FIRST_PARTY_SOURCES = [
  ['manifest description image', ARTICLE_BODY_DESCRIPTION_IMAGE_URL],
  ['manifest address image (family clamp)', ARTICLE_BODY_ADDRESS_IMAGE_URL],
  ['stored description image without manifest', STORED_DESCRIPTION_IMAGE],
  ['legacy upload (one width, no ladder)', ARTICLE_BODY_LEGACY_UPLOAD_URL],
] as const

describe('server island addresses body photos like the full render (#3408)', () => {
  it.each(FIRST_PARTY_SOURCES)('%s: no first-party address without w, noscript carries the desktop ladder', (_, src) => {
    const html = island(src)
    const urls = islandUrls(html)
    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) {
      const parsed = new URL(url)
      expect({ url, firstParty: isMetravelMediaHostname(parsed.hostname), w: parsed.searchParams.get('w') })
        .toEqual({ url, firstParty: true, w: expect.stringMatching(/^\d+$/) })
    }

    const deferred = parse(html).querySelector('img')
    const twin = new DOMParser().parseFromString(html, 'text/html').body.querySelector('noscript img')
    expect(twin?.getAttribute('src')).toBe(deferred?.getAttribute('data-deferred-src'))
    expect(twin?.getAttribute('srcset')).toBe(deferred?.getAttribute('data-deferred-srcset'))
    expect(twin?.getAttribute('sizes')).toBe(deferred?.getAttribute('data-deferred-sizes'))
    expect(twin?.getAttribute('alt')).toBe('')
    // Сеть по-прежнему молчит до выпуска (#3316).
    expect(deferred?.getAttribute('src')).toMatch(/^data:image\/svg\+xml,/)
    expect(deferred?.hasAttribute('srcset')).toBe(false)
  })

  it.each(FIRST_PARTY_SOURCES)('%s: released slot equals the full render on mobile and desktop', (_, src) => {
    for (const width of [390, 768, 1280, 1920]) {
      const expected = fullRender(src, width)
      expect({ width, ...releasedByComponent(src, width) }).toEqual({ width, ...expected })
      expect({ width, ...releasedByShell(src, width) }).toEqual({ width, ...expected })
    }
  })

  it('keeps the mobile ceiling: a phone never gets the desktop 1600 rung', () => {
    const mobile = releasedByComponent(STORED_DESCRIPTION_IMAGE, 390)
    const desktop = releasedByComponent(STORED_DESCRIPTION_IMAGE, 1440)
    expect(mobile.srcset).toContain('w=800 800w')
    expect(mobile.srcset).not.toContain('1600w')
    expect(desktop.srcset).toContain('1600w')
    expect(releasedByShell(STORED_DESCRIPTION_IMAGE, 390).srcset).toBe(mobile.srcset)
  })

  it('a mobile ladder of one manifest rung leaves the phone on src, as the full render does', () => {
    const base = 'https://metravel.by/travel-description-image/9/description/two-rungs.webp'
    const group = {
      gallery: [{
        ...PROD_ARTICLE_BODY_GROUP.gallery![0],
        src: `${base}?w=1600`,
        src_contain: `${base}?w=1600`,
        srcset: `${base}?w=800 800w, ${base}?w=1600 1600w`,
        srcset_contain: `${base}?w=800 800w, ${base}?w=1600 1600w`,
      }],
    } as TravelMediaGroup
    const media = buildArticleBodyMediaIndex(group)
    const mobile = fullRender(base, 390, media)
    expect(mobile).toEqual({ src: `${base}?w=800`, srcset: null, sizes: null })
    expect(parse(island(base, media)).querySelector('img')?.getAttribute('data-deferred-srcset-mobile')).toBe('')
    expect(releasedByComponent(base, 390, media)).toEqual(mobile)
    expect(releasedByShell(base, 390, media)).toEqual(mobile)
    expect(releasedByComponent(base, 1440, media)).toEqual(fullRender(base, 1440, media))
  })

  it('leaves external images as they are', () => {
    const deferred = parse(island(EXTERNAL_IMAGE)).querySelector('img')
    expect(deferred?.getAttribute('data-deferred-src')).toBe(EXTERNAL_IMAGE)
    expect(deferred?.hasAttribute('data-deferred-srcset')).toBe(false)
    expect(deferred?.hasAttribute('data-deferred-srcset-mobile')).toBe(false)
    expect(releasedByComponent(EXTERNAL_IMAGE, 390)).toEqual({ src: EXTERNAL_IMAGE, srcset: null, sizes: null })
  })

  it('builds the same markup on every viewport and platform: hydration has nothing to diff', () => {
    for (const src of [ARTICLE_BODY_DESCRIPTION_IMAGE_URL, STORED_DESCRIPTION_IMAGE]) {
      const reference = island(src)
      for (const width of [0, 390, 1920]) {
        for (const os of ['web', 'ios', 'android'] as const) {
          expect(withViewport(width, os, () => island(src))).toBe(reference)
        }
      }
    }
  })

  it('drops an authored mobile ladder and authored srcset on a first-party photo', () => {
    const html = toInertHtml(
      `<img src="${STORED_DESCRIPTION_IMAGE}" srcset="https://evil.example/x.webp 1w" sizes="1px"`
        + ' data-deferred-srcset-mobile="https://evil.example/m.webp 1w" alt="">'
        + `<img src="${EXTERNAL_IMAGE}" data-deferred-srcset-mobile="https://evil.example/m.webp 1w" alt="">`,
      { deferImages: { sources: (value) => buildArticleBodyIslandImageSources(value, MEDIA) } },
    )
    expect(html).not.toContain('evil.example')
    const [own, external] = Array.from(parse(html).querySelectorAll('img'))
    expect(own.getAttribute('data-deferred-sizes')).toBe('(max-width: 768px) 100vw, (max-width: 1439px) 720px, 920px')
    expect(external.hasAttribute('data-deferred-srcset-mobile')).toBe(false)
  })

  it('a plain deferImages pass keeps the authored addresses (other surfaces)', () => {
    const deferred = parse(toInertHtml(`<img src="${STORED_DESCRIPTION_IMAGE}" alt="">`, { deferImages: true })).querySelector('img')
    expect(deferred?.getAttribute('data-deferred-src')).toBe(STORED_DESCRIPTION_IMAGE)
    expect(deferred?.hasAttribute('data-deferred-srcset-mobile')).toBe(false)
  })
})

// #3414: от выпуска адреса до загрузки файла коробку кадра держит только резерв.
// Он обязан совпасть с резервом полного рендера, который подменяет остров.
describe('server island reserves the frame box of the full render (#3414)', () => {
  const SIZED_FILE = 'https://metravel.by/travel-description-image/7351/description/pano-1600x900.webp'
  const BOXES = [
    ['no declared size: fallback reserve', `<img src="${STORED_DESCRIPTION_IMAGE}" alt="">`, { width: '800', height: '450', fallback: true }],
    ['declared portrait', `<img src="${STORED_DESCRIPTION_IMAGE}" width="1200" height="1600" alt="">`, { width: '1200', height: '1600', fallback: false }],
    ['size in the file name', `<img src="${SIZED_FILE}" alt="">`, { width: '1600', height: '900', fallback: false }],
    ['one declared side: still a fallback', `<img src="${STORED_DESCRIPTION_IMAGE}" width="640" alt="">`, { width: '640', height: '450', fallback: true }],
    ['authored style is kept', `<img src="${STORED_DESCRIPTION_IMAGE}" style="border-radius:8px" alt="">`, { width: '800', height: '450', fallback: true }],
    ['authored fallback marker on a declared size', `<img src="${STORED_DESCRIPTION_IMAGE}" data-aspect-fallback="1" width="900" height="600" alt="">`, { width: '900', height: '600', fallback: false }],
    ['external image', `<img src="${EXTERNAL_IMAGE}" alt="">`, { width: '800', height: '450', fallback: true }],
  ] as const

  const boxOf = (img: Element | null | undefined) => ({
    width: img?.getAttribute('width') ?? null,
    height: img?.getAttribute('height') ?? null,
    fallback: img?.getAttribute('data-aspect-fallback') ?? null,
    style: img?.getAttribute('style') ?? null,
  })
  const fullRenderImage = (html: string, width: number) =>
    withViewport(width, 'web', () =>
      parse(prepareStableContentHtml(`<p>${html}</p>`, { serverSanitized: true, articleBodyMedia: MEDIA })).querySelector('img'))
  const mountIsland = (html: string) => parse(`<div data-ssr-html-island="description">${islandOf(`<p>${html}</p>`)}</div>`)

  it.each(BOXES)('%s: same width, height and marker as the full render', (_, html, expected) => {
    const deferred = mountIsland(html).querySelector('img')
    expect(boxOf(deferred)).toMatchObject({
      width: expected.width,
      height: expected.height,
      fallback: expected.fallback ? '1' : null,
    })
    for (const viewport of [390, 1280]) {
      const full = boxOf(fullRenderImage(html, viewport))
      expect({ viewport, ...boxOf(deferred), style: undefined }).toEqual({ viewport, ...full, style: undefined })
      // Запасной резерв уступает пропорции файла через CSS — полный рендер делает
      // то же скриптом после загрузки. Объявленные размеры совпадают дословно.
      const ratio = `aspect-ratio:${expected.width}/${expected.height}`
      expect(full.style).toContain(ratio)
      expect(boxOf(deferred).style).toBe(
        expected.fallback ? full.style?.replace(ratio, `aspect-ratio:auto ${expected.width}/${expected.height}`) : full.style,
      )
    }
  })

  it.each(BOXES)('%s: the placeholder and the noscript twin carry the same box', (_, html, expected) => {
    const markup = islandOf(`<p>${html}</p>`)
    const deferred = parse(markup).querySelector('img')
    expect(deferred?.getAttribute('src')).toBe(
      `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${expected.width} ${expected.height}'%2F%3E`,
    )
    const twin = new DOMParser().parseFromString(markup, 'text/html').body.querySelector('noscript img')
    expect(twin?.getAttribute('width')).toBe(expected.width)
    expect(twin?.getAttribute('height')).toBe(expected.height)
    expect(twin?.getAttribute('loading')).toBe('lazy')
  })

  it('the released photo keeps the box and stays lazy in both release implementations', () => {
    for (const [, html, expected] of BOXES) {
      const before = boxOf(mountIsland(html).querySelector('img'))

      const byComponent = mountIsland(html)
      releaseDeferredRichTextImages(byComponent)
      expect(boxOf(byComponent.querySelector('img'))).toEqual(before)
      expect(byComponent.querySelector('img')?.getAttribute('loading')).toBe('lazy')
      expect(byComponent.querySelector('img')?.getAttribute('src')).not.toMatch(/^data:/)

      document.documentElement.className = ''
      document.body.innerHTML = mountIsland(html).innerHTML
      try {
        new Function(buildDeferredRichTextImagesScript())()
        const released = document.querySelector('[data-ssr-html-island] img')
        expect(boxOf(released)).toEqual(before)
        expect(released?.getAttribute('loading')).toBe('lazy')
        expect(released?.getAttribute('width')).toBe(expected.width)
      } finally {
        document.body.innerHTML = ''
      }
    }
  })

  it('an image the pass does not defer still gets the reserve', () => {
    const img = parse(islandOf('<p><img alt=""></p>')).querySelector('img')
    expect(boxOf(img)).toMatchObject({ width: '800', height: '450', fallback: '1' })
    expect(img?.hasAttribute('src')).toBe(false)
  })

  it('a plain deferImages pass adds no reserve (other surfaces)', () => {
    const img = parse(toInertHtml(`<img src="${STORED_DESCRIPTION_IMAGE}" alt="">`, { deferImages: true })).querySelector('img')
    expect(boxOf(img)).toEqual({ width: null, height: null, fallback: null, style: null })
  })
})
