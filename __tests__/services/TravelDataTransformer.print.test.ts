// Регрессия BE #307: PDF-трансформер предпочитает print-grade изображения (≥2500px),
// с fallback на обычные, когда print-вариант не пришёл.

import { TravelDataTransformer } from '@/services/pdf-export/TravelDataTransformer'
import type { Travel } from '@/types/types'

const transformer = new TravelDataTransformer()

const baseTravel = (overrides: Partial<Travel>): Travel =>
  ({
    id: 1,
    slug: 'demo',
    name: 'Demo',
    travel_image_thumb_url: 'https://metravel.by/thumb.webp',
    travel_image_thumb_small_url: 'https://metravel.by/thumb-s.webp',
    url: 'https://metravel.by/travels/demo',
    youtube_link: '',
    userName: 'Author',
    description: '',
    recommendation: '',
    plus: '',
    minus: '',
    cityName: '',
    countryName: '',
    countUnicIpView: '0',
    gallery: [],
    travelAddress: [],
    userIds: '1',
    year: '2024',
    monthName: '',
    number_days: 1,
    companions: [],
    countryCode: 'BY',
    ...overrides,
  }) as Travel

describe('TravelDataTransformer print-grade preference (BE #307)', () => {
  it('обложка берёт travel_image_print_url, когда он есть', () => {
    const [result] = transformer.transform([
      baseTravel({ travel_image_print_url: 'https://metravel.by/cover-print.webp' }),
    ])
    expect(result.travel_image_url).toBe('https://metravel.by/cover-print.webp')
  })

  it('обложка падает на thumb, когда print отсутствует', () => {
    const [result] = transformer.transform([baseTravel({})])
    // travel_image_url не задаётся, рендер cover использует thumb как fallback
    expect(result.travel_image_url).toBeUndefined()
    expect(result.travel_image_thumb_url).toBe('https://metravel.by/thumb.webp')
  })

  it('галерея берёт print_url, когда он есть', () => {
    const [result] = transformer.transform([
      baseTravel({
        gallery: [
          {
            id: 10,
            url: 'https://metravel.by/photo.webp',
            print_url: 'https://metravel.by/photo-print.webp',
          } as Travel['gallery'][number],
        ],
      }),
    ])
    expect(result.gallery?.[0]?.url).toBe('https://metravel.by/photo-print.webp')
  })

  it('галерея падает на url, когда print_url отсутствует', () => {
    const [result] = transformer.transform([
      baseTravel({
        gallery: [
          { id: 11, url: 'https://metravel.by/photo2.webp' } as Travel['gallery'][number],
        ],
      }),
    ])
    expect(result.gallery?.[0]?.url).toBe('https://metravel.by/photo2.webp')
  })
})
