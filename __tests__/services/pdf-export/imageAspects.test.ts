/**
 * @jest-environment node
 */
// #2232: пропорции картинок книги — из медиа-манифеста API; браузерный замер
// только для кадров без записи. Чистые функции, без `Image` и `document`.
import {
  buildDescriptionImageAspects,
  buildGalleryAspectsById,
  lookupDescriptionImageAspect,
  resolveImageAspect,
  splitImageAspectTargets,
} from '@/services/pdf-export/utils/imageAspects'
import type { TravelMedia } from '@/types/types'

import { loadRealTravelFixtures } from '../../fixtures/pdfBook/corpus'

describe('пропорции картинок книги из медиа-манифеста', () => {
  it('пропорция записи: aspect_ratio, иначе width / height, иначе нет', () => {
    expect(resolveImageAspect({ aspect_ratio: 0.75, width: 768, height: 1024 })).toBe(0.75)
    expect(resolveImageAspect({ aspect_ratio: null, width: 1024, height: 576 })).toBeCloseTo(1.7778, 4)
    expect(resolveImageAspect({ aspect_ratio: 0, width: null, height: null })).toBeNull()
    expect(resolveImageAspect({ aspect_ratio: Number.NaN, width: 0, height: 100 })).toBeNull()
    expect(resolveImageAspect({ aspect_ratio: -1 })).toBeNull()
    expect(resolveImageAspect(null)).toBeNull()
  })

  it('галерея — по id записи; запись без пропорции не попадает в карту', () => {
    const media: TravelMedia = {
      gallery: [
        { id: 1, aspect_ratio: 1.5 },
        { id: 2, aspect_ratio: null, width: null, height: null },
        { id: 3, width: 600, height: 900 },
      ],
    }

    expect(Object.fromEntries(buildGalleryAspectsById(media))).toEqual({ '1': 1.5, '3': 600 / 900 })
    expect(buildGalleryAspectsById(null).size).toBe(0)
  })

  it('описание — по ключу файла: `src` манифеста с query совпадает с `src` разметки без него', () => {
    const media: TravelMedia = {
      article_body: {
        gallery: [
          { id: 0, aspect_ratio: 0.75, src: 'https://metravel.by/travel-description-image/a1.webp?pv=2&w=800' },
          { id: 1, aspect_ratio: null, src: 'https://metravel.by/gallery/3788/conversions/b2-detail_hd.jpg?w=1280' },
        ],
      },
    }
    const aspects = buildDescriptionImageAspects(media)

    expect(lookupDescriptionImageAspect(aspects, 'https://metravel.by/travel-description-image/a1.webp')).toBe(0.75)
    expect(
      lookupDescriptionImageAspect(aspects, 'https://metravel.by/travel-description-image/a1.webp?w=1600&amp;q=85')
    ).toBe(0.75)
    expect(lookupDescriptionImageAspect(aspects, 'https://metravel.by/gallery/3788/conversions/b2-detail_hd.jpg')).toBeNull()
    expect(lookupDescriptionImageAspect(undefined, 'https://metravel.by/travel-description-image/a1.webp')).toBeNull()
  })

  it('в браузерный замер идут только кадры без пропорции из данных', () => {
    const { known, toMeasure } = splitImageAspectTargets([
      { key: 'a', url: 'https://x/a.webp', aspect: 1.25 },
      { key: 'b', url: 'https://x/b.webp', aspect: null },
      { key: 'c', url: 'https://x/c.webp', aspect: 0 },
      { key: 'd', url: 'https://x/d.webp' },
      { key: 'b', url: 'https://x/b.webp', aspect: 0.8 },
    ])

    expect(Object.fromEntries(known)).toEqual({ a: 1.25, b: 0.8 })
    expect(Object.fromEntries(toMeasure)).toEqual({ c: 'https://x/c.webp', d: 'https://x/d.webp' })
  })

  // Снимок манифеста корпуса (06.10.2026): каждая картинка галереи и описания
  // находит пропорцию — книга корпуса не грузит ни одной картинки ради замера.
  it.each(loadRealTravelFixtures().map((fixture) => [fixture.id, fixture] as const))(
    'корпус, путешествие %d: пропорции есть у всех фото галереи и картинок описания',
    (_id, fixture) => {
      const galleryAspects = buildGalleryAspectsById(fixture.media)
      const descriptionAspects = buildDescriptionImageAspects(fixture.media)
      const descriptionSources = [...fixture.description.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gi)].map((match) => match[1])

      expect(fixture.gallery.filter((item) => !galleryAspects.has(String(item.id)))).toEqual([])
      expect(descriptionSources.filter((src) => lookupDescriptionImageAspect(descriptionAspects, src) === null)).toEqual([])
    }
  )
})
