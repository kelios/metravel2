import fs from 'fs'
import path from 'path'

const {
  collectTravelPageFailures,
  countTag,
  extractItems,
  hasArticleJsonLd,
  hasTravelSsgHeading,
  hasVisibleTravelSsgHeading,
  getTitle,
  getMetaContent,
  shouldFetchNextPage,
  travelPageVariants,
  verifyTravelHtml,
} = require('@/scripts/verify-static-travel-seo')

describe('verify-static-travel-seo network contract', () => {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'scripts/verify-static-travel-seo.js'),
    'utf8',
  )

  it('uses the shared fetchJson module instead of a local HTTP client', () => {
    // Retries/backoff/Retry-After and the build User-Agent all come from the
    // shared module; a local copy silently loses them (#1399, pattern of #1394).
    expect(source).toContain("require('./lib/fetchJson')")
    expect(source).not.toMatch(/function\s+fetchJson\s*\(/)
    expect(source).not.toMatch(/\bconst\s+fetchJson\s*=\s*(?:async\s*)?\(/)
    // The removed client called `mod.get(url, …)` through a ternary alias, so
    // the needle must not be tied to the module name; `node:` is the accepted
    // require spelling across scripts/ and must not slip through either.
    expect(source).not.toMatch(/\bhttps?\.get\s*\(/)
    expect(source).not.toMatch(/\.get\s*\(\s*url\b/)
    expect(source).not.toMatch(/\brequire\(['"](?:node:)?https?['"]\)/)
  })
})

describe('verify-static-travel-seo helpers', () => {
  it('extractItems supports collection payload shapes', () => {
    expect(extractItems([{ id: 1 }])).toEqual([{ id: 1 }])
    expect(extractItems({ data: [{ id: 2 }] })).toEqual([{ id: 2 }])
    expect(extractItems({ results: [{ id: 3 }] })).toEqual([{ id: 3 }])
    expect(extractItems({ items: [{ id: 4 }] })).toEqual([{ id: 4 }])
    expect(extractItems(null)).toEqual([])
  })

  it('verifyTravelHtml passes for a fully populated travel page', () => {
    const html = [
      '<!DOCTYPE html><html><head>',
      '<title data-rh="true">Energylandia | Metravel</title>',
      '<meta name="description" content="Путешествие в парк развлечений"/>',
      '<meta property="og:title" content="Energylandia | Metravel"/>',
      '<meta property="og:url" content="https://metravel.by/travels/energylandia-polskii-disneilend"/>',
      '<meta property="og:image" content="https://metravel.by/travel-image/123/conversions/hero-detail_hd.jpg"/>',
      '<meta name="twitter:image" content="https://metravel.by/travel-image/123/conversions/hero-detail_hd.jpg"/>',
      '<link rel="canonical" href="https://metravel.by/travels/energylandia-polskii-disneilend"/>',
      '<h1 class="ssg-travel-h1">Energylandia</h1>',
      '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article"}</script>',
      '</body></html>',
    ].join('')

    expect(getTitle(html)).toBe('Energylandia | Metravel')
    expect(getMetaContent(html, 'property', 'og:image')).toContain('hero-detail_hd')
    expect(countTag(html, /<meta[^>]*name="description"[^>]*\/?>/gi)).toBe(1)
    expect(hasTravelSsgHeading(html)).toBe(true)
    expect(hasVisibleTravelSsgHeading(html)).toBe(true)
    expect(hasArticleJsonLd(html)).toBe(true)
    expect(verifyTravelHtml(html, 'energylandia-polskii-disneilend')).toEqual([])
  })

  it('verifyTravelHtml reports missing SSR meta fields', () => {
    const html = [
      '<!DOCTYPE html><html><head>',
      '<title data-rh="true">Путешествие | Metravel</title>',
      '<meta name="description" content="Найди место для путешествия и поделись своим опытом."/>',
      '<meta name="description" content="Маршруты, заметки и фото путешествий по Беларуси и не только."/>',
      '<meta property="og:title" content="Путешествие | Metravel"/>',
      '<link rel="canonical" href="https://metravel.by/travels/wrong-slug"/>',
      '</head><body></body></html>',
    ].join('')

    expect(verifyTravelHtml(html, 'energylandia-polskii-disneilend')).toEqual([
      'generic description',
      'duplicate description',
      'missing og:image',
      'missing twitter:image',
      'bad canonical: https://metravel.by/travels/wrong-slug',
      'bad og:url: missing',
      'expected exactly one SSR H1, found 0',
      'missing SSR H1 marker',
      'missing Article JSON-LD',
    ])
  })

  it('rejects hidden and duplicate static travel headings', () => {
    const hidden = '<style>.ssg-travel-h1{position:absolute;width:1px;height:1px;clip:rect(0,0,0,0)}</style><h1 class="ssg-travel-h1">Маршрут</h1>'
    expect(hasTravelSsgHeading(hidden)).toBe(true)
    expect(hasVisibleTravelSsgHeading(hidden)).toBe(false)
    expect(verifyTravelHtml(hidden, 'route')).toContain('hidden or clipped SSR H1')

    const duplicate = '<h1 class="ssg-travel-h1">Маршрут</h1><h1>Дубль</h1>'
    expect(verifyTravelHtml(duplicate, 'route')).toContain('expected exactly one SSR H1, found 2')

    const hiddenByLaterRule = '<style>.ssg-travel-h1{color:#111}html.ready .ssg-travel-h1{display:none}</style><h1 class="ssg-travel-h1">Маршрут</h1>'
    expect(hasVisibleTravelSsgHeading(hiddenByLaterRule)).toBe(false)
  })
})
describe('verify-static-travel-seo catalogue coverage', () => {
  // Прод отдаёт максимум 100 записей на страницу и молча игнорирует perPage=500.
  // Прежнее условие `matched.length === perPage` при этом ложно всегда, и гейт
  // проверял 100 статей из 408, рапортуя «Verified all 100».
  it('keeps paginating when the backend caps the page below the requested perPage', () => {
    expect(
      shouldFetchNextPage(
        { next: 'https://metravel.by/api/travels/?page=2', count: 408 },
        { fetchedCount: 100, pageItemCount: 100, total: 408 },
      ),
    ).toBe(true)
  })

  it('stops on the last page and on an empty page', () => {
    expect(
      shouldFetchNextPage({ next: null, count: 408 }, { fetchedCount: 408, pageItemCount: 8, total: 408 }),
    ).toBe(false)
    expect(
      shouldFetchNextPage({ next: 'https://x/?page=9' }, { fetchedCount: 0, pageItemCount: 0, total: 408 }),
    ).toBe(false)
  })

  // DRF кладёт ключ `next` всегда и на последней странице ставит его в null.
  it('stops on an explicit null cursor even when fewer items were collected than total', () => {
    expect(
      shouldFetchNextPage({ next: null, count: 401 }, { fetchedCount: 400, pageItemCount: 1, total: 401 }),
    ).toBe(false)
  })

  // Пагинацией управляют СЫРЫЕ записи страницы, а не пережившие фильтр
  // `slug || id`. Иначе страница, целиком отсеянная фильтром, останавливала бы
  // обход, и гейт рапортовал бы «Verified all N» по усечённому каталогу —
  // тот же fail-open, из-за которого #1688 уехал молча.
  it('keeps paginating when a whole page is dropped by the slug/id filter', () => {
    expect(
      shouldFetchNextPage(
        { next: 'https://metravel.by/api/travels/?page=3', count: 408 },
        { fetchedCount: 200, pageItemCount: 100, total: 408 },
      ),
    ).toBe(true)
  })

  it('falls back to the total when the payload carries no pagination cursor', () => {
    expect(
      shouldFetchNextPage({ count: 408 }, { fetchedCount: 100, pageItemCount: 100, total: 408 }),
    ).toBe(true)
    expect(
      shouldFetchNextPage({ count: 100 }, { fetchedCount: 100, pageItemCount: 100, total: 100 }),
    ).toBe(false)
  })

  // Без курсора счёт по выжившим после фильтра держал бы `collected < total` и
  // просил бы страницу за последней: она отдаёт HTTP 404, и сборка падала бы
  // чужой ошибкой. Сырой счётчик добирает ровно до `total` и останавливается.
  it('stops at the catalogue total even when the filter dropped records', () => {
    expect(
      shouldFetchNextPage({ count: 408 }, { fetchedCount: 408, pageItemCount: 8, total: 408 }),
    ).toBe(false)
  })
})

describe('verify-static-travel-seo page variants', () => {
  const VALID = [
    '<title>Маршрут по Моравии | Metravel</title>',
    '<meta name="description" content="Оломоуц, пещеры и замок Боузов за три дня."/>',
    '<meta property="og:title" content="Маршрут по Моравии"/>',
    '<meta property="og:image" content="https://metravel.by/a.jpg"/>',
    '<meta name="twitter:image" content="https://metravel.by/a.jpg"/>',
    '<link rel="canonical" href="https://metravel.by/travels/my-slug"/>',
    '<meta property="og:url" content="https://metravel.by/travels/my-slug"/>',
    '<h1 class="ssg-travel-h1">Маршрут по Моравии</h1>',
    '<script type="application/ld+json">{"@type":"Article"}</script>',
  ].join('')

  const fakeFs = (files: Record<string, string>) => ({
    existsSync: (p: string) => Object.prototype.hasOwnProperty.call(files, p),
    readFileSync: (p: string) => files[p],
  })

  it('requires the flat file that the crawler-facing URL actually serves', () => {
    // Голый /travels/<slug> резолвит Django и уходит в
    // `try_files /travels/<slug>.html =404`: каталожный index.html там не пробуется.
    expect(travelPageVariants('dist/prod', 'my-slug').map((v) => v.filePath)).toEqual([
      path.join('dist/prod', 'travels', 'my-slug.html'),
      path.join('dist/prod', 'travels', 'my-slug', 'index.html'),
    ])
  })

  it('fails when only the directory index exists — the 583/584 production case', () => {
    const files = { [path.join('dist/prod', 'travels', 'my-slug', 'index.html')]: VALID }
    const failures = collectTravelPageFailures([{ slug: 'my-slug' }], 'dist/prod', { fs: fakeFs(files) })

    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('missing flat file')
    expect(failures[0]).toContain(path.join('travels', 'my-slug.html'))
  })

  it('fails when only the flat file exists', () => {
    const files = { [path.join('dist/prod', 'travels', 'my-slug.html')]: VALID }
    const failures = collectTravelPageFailures([{ slug: 'my-slug' }], 'dist/prod', { fs: fakeFs(files) })

    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('missing directory-index file')
  })

  it('passes when both variants are present and valid', () => {
    const files = {
      [path.join('dist/prod', 'travels', 'my-slug.html')]: VALID,
      [path.join('dist/prod', 'travels', 'my-slug', 'index.html')]: VALID,
    }
    expect(collectTravelPageFailures([{ slug: 'my-slug' }], 'dist/prod', { fs: fakeFs(files) })).toEqual([])
  })

  it('names the offending variant when only the flat document is broken', () => {
    const files = {
      [path.join('dist/prod', 'travels', 'my-slug.html')]: VALID.replace(/<h1[^>]*>.*?<\/h1>/, ''),
      [path.join('dist/prod', 'travels', 'my-slug', 'index.html')]: VALID,
    }
    const failures = collectTravelPageFailures([{ slug: 'my-slug' }], 'dist/prod', { fs: fakeFs(files) })

    expect(failures).toHaveLength(1)
    expect(failures[0]).toContain('my-slug (flat)')
    expect(failures[0]).toContain('missing SSR H1 marker')
  })
})
