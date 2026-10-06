/**
 * @jest-environment node
 */
// #2232: книга в окружении приложений (Node без `Image` и DOM, как Hermes)
// раскладывает фото по пропорциям из медиа-манифеста API, а не по запасной
// раскладке. Разбор, рендер и данные — реальные (снимок манифеста в фикстуре
// корпуса); подменены только границы: генератор QR и сеть маршрутов.
import { buildDefaultSettingsForTravel } from '@/components/travel/hooks/useSingleTravelExport'
import { BookHtmlExportService } from '@/services/book/BookHtmlExportService'
import { resolveImageAspect } from '@/services/pdf-export/utils/imageAspects'
import type { Travel } from '@/types/types'

import { type RealTravelFixture, loadRealTravelFixtures, toTravel } from '../../fixtures/pdfBook/corpus'
import { installHermesLikeGlobals } from '../../helpers/hermesLikeGlobals'

jest.mock('qrcode', () => ({
  toDataURL: jest.fn((text: string) => Promise.resolve(`data:image/png;base64,QR:${text}`)),
}))

jest.mock('@/api/travelRoutes', () => ({
  listTravelRouteFiles: jest.fn(() => Promise.resolve([])),
  downloadTravelRouteFileBlob: jest.fn(),
}))

installHermesLikeGlobals()

/** Запасная пропорция кадра без замера (`GalleryPageRenderer`). */
const FALLBACK_ASPECT = 4 / 3

const fileOf = (url: string) => url.split('?')[0].split('/').pop() as string

/** Пропорции боксов фото «Фотогалереи»: имя файла → ширина / высота бокса. */
function printedGalleryAspects(html: string): Map<string, number> {
  const boxes = new Map<string, number>()
  const frame = /class="gallery-photo-frame" style="[^"]*?width: ([\d.]+)mm;[\s\S]*?height: ([\d.]+)mm;[\s\S]*?src="([^"]+)"/g
  for (const [, width, height, src] of html.matchAll(frame)) {
    boxes.set(fileOf(src), Number(width) / Number(height))
  }
  return boxes
}

const generate = (travel: Travel) =>
  new BookHtmlExportService().generateTravelsHtml([travel], buildDefaultSettingsForTravel(travel), { isPremium: false })

describe('PDF-книга в приложениях: пропорции фото из медиа-манифеста', () => {
  const fixture = loadRealTravelFixtures().find((item) => item.id === 536) as RealTravelFixture

  it('«Фотогалерея» разложена по пропорциям манифеста, а не запасной', async () => {
    const boxes = printedGalleryAspects(await generate(toTravel(fixture)))

    expect(boxes.size).toBe(fixture.gallery.length)
    for (const entry of fixture.media.gallery) {
      const aspect = Math.min(3.2, Math.max(0.3, resolveImageAspect(entry) as number))
      expect(boxes.get(fileOf(entry.src as string))).toBeCloseTo(aspect, 2)
    }
    expect([...boxes.values()].some((aspect) => Math.abs(aspect - FALLBACK_ASPECT) > 0.01)).toBe(true)
  })

  it('картинки описания без размеров получают размеры по манифесту', async () => {
    const html = await generate(toTravel(fixture))

    for (const entry of fixture.media.article_body.gallery) {
      const height = Math.round(1000 / (resolveImageAspect(entry) as number))
      expect(html).toMatch(new RegExp(`data-width="1000"\\s+data-height="${height}"`))
    }
  })

  it.each([
    ['манифеста нет', undefined],
    ['aspect_ratio равен 0', 0],
    ['aspect_ratio равен null', null],
  ])('%s: книга собирается, фото на запасной раскладке, описание без размеров', async (_case, aspectRatio) => {
    const strip = (entry: RealTravelFixture['media']['gallery'][number]) => ({
      ...entry,
      aspect_ratio: aspectRatio,
      width: null,
      height: null,
    })
    const media =
      aspectRatio === undefined
        ? undefined
        : {
            gallery: fixture.media.gallery.map(strip),
            article_body: { gallery: fixture.media.article_body.gallery.map(strip) },
          }
    const html = await generate(toTravel({ ...fixture, media } as RealTravelFixture))
    const boxes = printedGalleryAspects(html)

    expect(boxes.size).toBe(fixture.gallery.length)
    for (const aspect of boxes.values()) expect(aspect).toBeCloseTo(FALLBACK_ASPECT, 2)
    expect(html).not.toContain('data-width="1000"')
  })
})
