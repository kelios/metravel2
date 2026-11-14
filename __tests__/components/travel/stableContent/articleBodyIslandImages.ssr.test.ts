/** @jest-environment node */
// #3408: остров тела статьи строится на сервере без `window` — разметка не
// зависит от вьюпорта и уже несёт адреса с `w` и обе лестницы.
import { buildArticleBodyIslandImageSources } from '@/components/travel/stableContent/articleBodyImageUrls'
import { toInertHtml } from '@/utils/inertHtml'

const PHOTO = 'https://metravel.by/travel-description-image/7351/description/photo.png.webp'
const ladder = (widths: number[]) => widths.map((w) => `${PHOTO}?w=${w} ${w}w`).join(', ')

const withoutWindow = <T,>(run: () => T): T => {
  // Окружение тестов RN кладёт `window` и в node — снимаем его, как на сервере.
  const global = globalThis as { window?: unknown }
  const saved = global.window
  delete global.window
  try {
    return run()
  } finally {
    global.window = saved
  }
}

it('renders first-party body photos with sized addresses and both ladders without a window', () => {
  const html = withoutWindow(() => {
    expect(typeof window).toBe('undefined')
    return toInertHtml(`<p><img src="${PHOTO}" alt="Кадр"></p>`, {
      deferImages: { sources: (src) => buildArticleBodyIslandImageSources(src, null) },
    })
  })
  expect(html).toContain(`data-deferred-src="${PHOTO}?w=800"`)
  expect(html).toContain(`data-deferred-srcset="${ladder([480, 800, 960, 1600])}"`)
  expect(html).toContain(`data-deferred-srcset-mobile="${ladder([480, 800])}"`)
  expect(html).toContain(`<noscript><img src="${PHOTO}?w=800" srcset="${ladder([480, 800, 960, 1600])}"`)
  expect(html).not.toMatch(new RegExp(`${PHOTO.replace(/[.?/]/g, '\\$&')}(?!\\?w=)`))
})
