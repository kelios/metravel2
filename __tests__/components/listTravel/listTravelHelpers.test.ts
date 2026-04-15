import {
  normalizeApiResponse,
  deduplicateTravels,
  calculateColumns,
} from '@/components/listTravel/utils/listTravelHelpers'
import type { Travel } from '@/types/types'

const baseTravel: Travel = {
  id: 0,
  slug: 'base-travel',
  name: 'Base travel',
  travel_image_thumb_url: 'thumb.jpg',
  travel_image_thumb_small_url: 'thumb-small.jpg',
  url: 'https://example.com',
  youtube_link: '',
  userName: 'tester',
  description: '',
  recommendation: '',
  plus: '',
  minus: '',
  cityName: 'City',
  countryName: 'Country',
  countUnicIpView: '0',
  gallery: [],
  travelAddress: [],
  userIds: '',
  year: '2024',
  monthName: 'January',
  number_days: 1,
  companions: [],
  coordsMeTravel: [],
  countryCode: 'BY',
}

let travelCounter = 0
const resetTravelCounter = () => {
  travelCounter = 0
}

const createTravel = (overrides: Record<string, any> = {}) => {
  travelCounter += 1
  return {
    ...baseTravel,
    id: overrides.id ?? travelCounter,
    slug: overrides.slug ?? `test-slug-${travelCounter}`,
    name: overrides.name ?? `Test travel ${travelCounter}`,
    gallery: overrides.gallery ?? [],
    travelAddress: overrides.travelAddress ?? [],
    companions: overrides.companions ?? [],
    coordsMeTravel: overrides.coordsMeTravel ?? [],
    ...overrides,
  } as Travel & typeof overrides
}

describe('listTravelHelpers', () => {
  beforeEach(() => {
    resetTravelCounter()
  })

  describe('normalizeApiResponse', () => {
    it('returns empty defaults when data is nullish', () => {
      expect(normalizeApiResponse(undefined)).toEqual({ items: [], total: 0 })
      expect(normalizeApiResponse(null)).toEqual({ items: [], total: 0 })
    })

    it('normalizes array responses and infers total', () => {
      const travels = [createTravel({ id: 11 }), createTravel({ id: 12 })]
      expect(normalizeApiResponse(travels)).toEqual({ items: travels, total: travels.length })
    })

    it('normalizes object responses with data array and explicit total', () => {
      const data = [createTravel({ id: 21 })]
      const response = normalizeApiResponse({ data, total: 10 })
      expect(response).toEqual({ items: data, total: 10 })
    })

    it('normalizes object responses with items array and explicit total', () => {
      const items = [createTravel({ id: 22 })]
      const response = normalizeApiResponse({ items, total: 12 })
      expect(response).toEqual({ items, total: 12 })
    })

    it('wraps single data object and falls back to total of 1', () => {
      const single = createTravel({ id: 31 })
      const response = normalizeApiResponse({ data: single })
      expect(response).toEqual({ items: [single], total: 1 })
    })

    it('respects total when provided without data array', () => {
      const response = normalizeApiResponse({ total: 5 })
      expect(response).toEqual({ items: [], total: 5 })
    })
  })

  describe('deduplicateTravels', () => {
    it('removes duplicates by id/slug/_id fallback', () => {
      const idPrimary = createTravel({ id: 100, name: 'First id' })
      const idDuplicate = { ...idPrimary, name: 'Duplicate same id' }

      const slugPrimary = createTravel({ name: 'Slug primary' })
      ;(slugPrimary as any).id = undefined
      slugPrimary.slug = 'shared-slug'
      const slugDuplicate = { ...slugPrimary, name: 'Duplicate slug' }

      const mongoPrimary = createTravel({ name: 'Mongo primary' })
      ;(mongoPrimary as any).id = undefined
      mongoPrimary.slug = undefined as unknown as string
      ;(mongoPrimary as any)._id = 'mongo-id'
      const mongoDuplicate = { ...mongoPrimary, name: 'Duplicate mongo' }

      const uniqueTravel = createTravel({ id: 200, name: 'Unique' })

      const travels = [
        idPrimary,
        idDuplicate,
        slugPrimary,
        slugDuplicate,
        mongoPrimary,
        mongoDuplicate,
        uniqueTravel,
      ] as Travel[]

      const result = deduplicateTravels(travels)
      expect(result.map(item => item.name)).toEqual(['First id', 'Slug primary', 'Mongo primary', 'Unique'])
    })
  })


  describe('calculateColumns', () => {
    it('forces 1 column below SM breakpoint (480px)', () => {
      expect(calculateColumns(320)).toBe(1)
      expect(calculateColumns(479)).toBe(1)
    })

    it('allows multiple columns between SM and MOBILE breakpoints (content area with sidebar)', () => {
      // At 700px (typical effectiveWidth at 1024px with 320px sidebar), 2 cards fit
      expect(calculateColumns(700)).toBeGreaterThanOrEqual(2)
    })

    it('limits to max 2 columns on portrait tablet widths', () => {
      const columns = calculateColumns(900, 'portrait')
      expect(columns).toBeLessThanOrEqual(2)
      expect(columns).toBeGreaterThanOrEqual(1)
    })

    it('returns at least as many columns in landscape as in portrait for same width (tablet range)', () => {
      const width = 900
      const portrait = calculateColumns(width, 'portrait')
      const landscape = calculateColumns(width, 'landscape')
      expect(landscape).toBeGreaterThanOrEqual(portrait)
    })
  })

})
