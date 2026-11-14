// #3408: серверный остров тела статьи адресует первопартийные фото теми же
// ступенями, что полный рендер (`prepareStableContentHtml`), а не оригиналом без
// `w`. Проверяется по живым функциям: построитель, инертный проход, обе
// реализации выпуска и сам полный рендер — без подмены ни одного из них.
import { Platform } from 'react-native'

import { buildArticleBodyIslandImageSources } from '@/components/travel/stableContent/articleBodyImageUrls'
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

const island = (src: string, media: ArticleBodyMediaIndex | null = MEDIA) =>
  toInertHtml(`<p>Текст</p><p><img src="${src}" alt=""></p>`, {
    deferImages: { sources: (value) => buildArticleBodyIslandImageSources(value, media) },
  })

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
