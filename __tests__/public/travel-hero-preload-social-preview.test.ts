/**
 * #1873: обложку соцпревью на travel-странице объявляют ТРИ независимых писателя —
 * SSG (`scripts/generate-seo-pages.js`), этот preload-скрипт и Helmet, — и правило
 * адреса у них разъезжалось. SSG уводил кадр на кэшируемый `/media-resize/legacy/…?w=`
 * (#1872), а скрипт тут же перебивал его «голым» ownership-адресом: мастер с
 * `no-store`, 0.4–1 МБ на каждый обход краулера (регресс #1221 в рантайме).
 *
 * Скрипт шипится сырым файлом из `public/` и импортов не имеет — правило в нём
 * КОПИЯ. Здесь она сверяется с TS-источником `normalizeOgImageUrl` (`utils/seo.ts`)
 * посимвольно, тем же приёмом, что `scripts/lib/readerMediaUrl.js` (#1854/#1868):
 * разойдись копия хоть на одном классе адресов — тест краснеет.
 */
import fs from 'fs'
import path from 'path'
import vm from 'vm'

import {
  DERIVATIVE_WIDTHS_BY_ROUTE,
  socialPreviewWidthForRoute,
} from '@/constants/imageContract'
import { normalizeOgImageUrl } from '@/utils/seo'

const SITE = 'https://metravel.by'

type MetaElement = { attrs: Record<string, string>; textContent?: string }

/** Голова страницы, собранная из вызовов скрипта: селектор писателя → его content. */
type ScriptHead = {
  meta: (selectorAttr: string, selectorValue: string) => string | undefined
  jsonLd: (id: string) => Record<string, unknown> | undefined
}

function runPreloadScript(travelPayload: Record<string, unknown>): ScriptHead {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'public/travel-hero-preload-v2.js'),
    'utf8',
  )

  const created: MetaElement[] = []

  class AbortControllerMock {
    signal = { aborted: false }
    abort() {
      this.signal.aborted = true
    }
  }

  const context: Record<string, unknown> = {
    window: {
      location: {
        hostname: 'metravel.by',
        origin: SITE,
        pathname: '/travels/hala-krupowa',
      },
      __METRAVEL_API_URL__: SITE,
      AbortController: AbortControllerMock,
      innerWidth: 1280,
      devicePixelRatio: 1,
      matchMedia: () => ({ matches: false }),
      setTimeout,
      clearTimeout,
    },
    document: {
      head: { appendChild: () => undefined },
      body: { appendChild: () => undefined },
      documentElement: { clientWidth: 1280 },
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      createElement: () => {
        const element: MetaElement = {
          attrs: {},
          setAttribute(this: MetaElement, key: string, value: string) {
            this.attrs[key] = value
          },
        } as unknown as MetaElement
        created.push(element)
        return element
      },
      addEventListener: () => undefined,
    },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(travelPayload) }),
    URL,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    AbortController: AbortControllerMock,
    console: { error: () => undefined, warn: () => undefined, log: () => undefined },
  }

  vm.runInNewContext(source, context)

  return {
    meta: (selectorAttr, selectorValue) =>
      created.find((element) => element.attrs[selectorAttr] === selectorValue)?.attrs.content,
    jsonLd: (id) => {
      const script = created.find(
        (element) => (element as unknown as { id?: string }).id === id,
      ) as unknown as { textContent?: string } | undefined
      return script?.textContent ? JSON.parse(script.textContent) : undefined
    },
  }
}

/** Один прогон скрипта на вход: обложка приходит первым кадром галереи. */
async function socialPreviewFromScript(galleryUrl: string): Promise<ScriptHead> {
  const head = runPreloadScript({
    name: 'Хала Крупова',
    description: 'Поход',
    gallery: [{ url: galleryUrl }],
  })
  // Патч меты живёт в цепочке `.then` над fetch — ждём её стока.
  await new Promise((resolve) => setTimeout(resolve, 0))
  return head
}

/**
 * По одному входу на ветку правила: обе ветки переписывания, оба способа его не
 * получить и оба класса «не наш адрес». Набор ломается, если копия сузится хоть
 * на одном классе, — ровно так разъехались три копии до общего модуля (#1854).
 */
const SOCIAL_PREVIEW_INPUTS: readonly string[] = [
  // Conversion-ключ за каждым family-роутом, который знает переписывание фронта.
  `${SITE}/gallery/3860/conversions/HcQK2WZBkjkvHnupzbuIPA9ulGbifqOiIvgmkOlG-detail_hd.jpg`,
  `${SITE}/travel-image/682/conversions/10f0a8f2.webp`,
  `${SITE}/travel-description-image/12/conversions/x.WEBP`,
  `${SITE}/address-image/15601/conversions/ee55dead.webp`,
  // Ключ не перекодируется ни одной из сторон — иначе адреса разъехались бы на пробеле.
  `${SITE}/travel-image/682/conversions/a%20b.webp`,
  // `uploads/**` за family-роутом: собственный legacy-роут, ступени у класса нет.
  `${SITE}/gallery/uploads/1614096729IMG_6960.JPG`,
  // Плоский корень — большинство обложек каталога: ступень есть, legacy-роута нет.
  `${SITE}/gallery/613eb392.jpg.webp`,
  `${SITE}/gallery/3994/gallery/plain.jpg`,
  // Роут, которого переписывание фронта не знает: ступень есть, адрес прежний.
  `${SITE}/quest-cover/9/conversions/x.webp`,
  // Классы, которых legacy-роут не обслуживает.
  `${SITE}/gallery/682/responsive-images/x.webp`,
  `${SITE}/gallery/682/conversions/deep/conversions/x.webp`,
  `${SITE}/gallery/1/conversions/notes.pdf`,
  // Не наш адрес: чужой хост, прямая ссылка в бакет, обёртка weserv.
  'https://example.com/gallery/1/conversions/y.jpg',
  'https://metravelprod.s3.eu-north-1.amazonaws.com/uploads/1614096729IMG_6960.JPG',
  `https://images.weserv.nl/?url=${SITE}/gallery/3860/conversions/x-detail_hd.jpg`,
  // Формы адреса, которые приходят от API наравне с абсолютной.
  '/gallery/3860/conversions/x-detail_hd.jpg',
  `http://metravel.by/gallery/abc.webp`,
  // Статика вне семейств: ни ступени, ни роута.
  `${SITE}/og-default.png`,
]

describe('preload-скрипт даёт тот же адрес соцпревью, что и utils/seo.ts (#1873)', () => {
  const previousSiteUrl = process.env.EXPO_PUBLIC_SITE_URL

  beforeAll(() => {
    process.env.EXPO_PUBLIC_SITE_URL = SITE
  })

  afterAll(() => {
    process.env.EXPO_PUBLIC_SITE_URL = previousSiteUrl
  })

  it.each(SOCIAL_PREVIEW_INPUTS)('совпадает с normalizeOgImageUrl: %s', async (input) => {
    const head = await socialPreviewFromScript(input)
    expect(head.meta('property', 'og:image')).toBe(normalizeOgImageUrl(input))
  })

  it('все три писателя головы объявляют ОДИН адрес', async () => {
    // Done gate #1873: og:image, twitter:image и JSON-LD `image` расходиться не
    // имеют права — иначе краулер увидит второй адрес того же файла.
    const input = `${SITE}/gallery/3860/conversions/x-detail_hd.jpg`
    const head = await socialPreviewFromScript(input)
    const expected = `${SITE}/media-resize/legacy/3860/conversions/x-detail_hd.jpg?w=1280`

    expect(normalizeOgImageUrl(input)).toBe(expected)
    expect({
      og: head.meta('property', 'og:image'),
      twitter: head.meta('name', 'twitter:image'),
      jsonLd: (head.jsonLd('travel-article-jsonld')?.image as string[] | undefined)?.[0],
    }).toEqual({ og: expected, twitter: expected, jsonLd: expected })
  })

  it('адрес без `?w=` не появляется ни на одном писателе меты', async () => {
    // Механизм дефекта, а не его пересказ: до правки скрипт клал сюда голый
    // ownership-адрес — мастер с `no-store` по 0.4–1 МБ на обход краулера.
    const head = await socialPreviewFromScript(
      `${SITE}/gallery/3860/conversions/x-detail_hd.jpg`,
    )
    for (const value of [head.meta('property', 'og:image'), head.meta('name', 'twitter:image')]) {
      expect(value).toContain('w=1280')
      expect(value).not.toMatch(/\/gallery\/3860\/conversions\//)
    }
  })

  it('набор входов покрывает обе ветки переписывания и ветку «не трогаем»', async () => {
    // Без этого `it.each` выше был бы зелёным и на наборе, где переписывать нечего.
    const previews = SOCIAL_PREVIEW_INPUTS.map((input) => normalizeOgImageUrl(input) as string)
    expect(previews.some((url) => url.includes('/media-resize/legacy/'))).toBe(true)
    expect(previews.some((url) => /\/media-resize\/uploads\//.test(url))).toBe(true)
    expect(previews.some((url) => !url.includes('/media-resize/'))).toBe(true)
  })

  it.each([...DERIVATIVE_WIDTHS_BY_ROUTE.keys()])(
    'ступень семейства %s взята из контракта, а не из устаревшей копии',
    async (route) => {
      // Набор выше водит по классам ПЕРЕПИСЫВАНИЯ и до половины семейств не
      // доходит: обложкой travel бывают не все. Ступень при этом копия ведёт для
      // каждого — разойдись она на `trip-cover`, дефект всплыл бы прод-замером.
      const head = await socialPreviewFromScript(`${SITE}/${route}/1/cover.webp`)
      expect(head.meta('property', 'og:image')).toBe(
        `${SITE}/${route}/1/cover.webp?w=${socialPreviewWidthForRoute(route)}`,
      )
    },
  )

  it('в копии перечислены ровно те же семейства, что в контракте', () => {
    // Поведенческая проверка выше ходит по ключам контракта и лишнюю строку в
    // копии не увидит: семейство, которого в контракте нет, получило бы ширину
    // там, где TS её не ставит.
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'public/travel-hero-preload-v2.js'),
      'utf8',
    )
    const block = /var SOCIAL_PREVIEW_WIDTH_BY_ROUTE = \{([\s\S]*?)\};/.exec(source)
    if (!block) throw new Error('SOCIAL_PREVIEW_WIDTH_BY_ROUTE не найден в preload-скрипте')

    const mirrored = Array.from(block[1].matchAll(/'([a-z-]+)':\s*(\d+)/g))
    expect(mirrored.map((match) => match[1]).sort()).toEqual(
      [...DERIVATIVE_WIDTHS_BY_ROUTE.keys()].sort(),
    )
    for (const match of mirrored) {
      expect({ route: match[1], width: Number(match[2]) }).toEqual({
        route: match[1],
        width: socialPreviewWidthForRoute(match[1]),
      })
    }
  })

  it('пустая галерея оставляет дефолтную обложку, а не выдуманный адрес', async () => {
    const head = runPreloadScript({ name: 'Хала Крупова', gallery: [] })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(head.meta('property', 'og:image')).toBe(`${SITE}/og-default.png`)
  })
})
