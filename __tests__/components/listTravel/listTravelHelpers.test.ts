import {
  normalizeApiResponse,
  deduplicateTravels,
  calculateCategoriesWithCount,
  calculateIsEmpty,
} from '@/components/listTravel/utils/listTravelHelpers'
import type { Travel } from '@/src/types/types'

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

  describe('calculateCategoriesWithCount', () => {
    const categories = [
      { id: 'cat-1', name: 'Beach' },
      { id: 'cat-2', name: 'Mountain' },
      { id: 'cat-3', name: 'City' },
      { id: 'cat-4', name: 'Forest' },
    ]

    const travelWithCategories = (categoryName: string) => {
      const travel = createTravel()
      ;(travel as any).categoryName = categoryName
      return travel
    }

    it('returns sorted categories with counts limited to top 10', () => {
      const travels = [
        travelWithCategories('Beach, Mountain'),
        travelWithCategories('Beach, City'),
        travelWithCategories('Beach'),
        travelWithCategories('Forest'),
      ]

      const result = calculateCategoriesWithCount(travels, categories)
      expect(result).toEqual([
        { id: 'cat-1', name: 'Beach', count: 3 },
        { id: 'cat-2', name: 'Mountain', count: 1 },
        { id: 'cat-3', name: 'City', count: 1 },
        { id: 'cat-4', name: 'Forest', count: 1 },
      ])
    })

    it('returns empty list when travels or categories missing', () => {
      expect(calculateCategoriesWithCount([], categories)).toEqual([])
      expect(calculateCategoriesWithCount([travelWithCategories('Beach')], undefined)).toEqual([])
    })
  })

  describe('calculateIsEmpty', () => {
    const baseParams = {
      isQueryEnabled: true,
      status: 'success',
      isFetching: false,
      isLoading: false,
      hasAnyItems: false,
      data: null,
    }

    it('returns false while fetching or loading', () => {
      expect(
        calculateIsEmpty(true, 'success', true, false, false, null)
      ).toBe(false)
      expect(
        calculateIsEmpty(true, 'success', false, true, false, null)
      ).toBe(false)
    })

    it('returns false when items already present', () => {
      expect(
        calculateIsEmpty(true, 'success', false, false, true, null)
      ).toBe(false)
    })

    it('returns false when backend data contains items', () => {
      expect(
        calculateIsEmpty(true, 'success', false, false, false, [createTravel()])
      ).toBe(false)
      expect(
        calculateIsEmpty(true, 'success', false, false, false, { data: [{ id: '1' }] })
      ).toBe(false)
      expect(
        calculateIsEmpty(true, 'success', false, false, false, { total: 1 })
      ).toBe(false)
    })

    it('returns true only when query finished successfully with no data anywhere', () => {
      expect(
        calculateIsEmpty(
          baseParams.isQueryEnabled,
          baseParams.status,
          baseParams.isFetching,
          baseParams.isLoading,
          baseParams.hasAnyItems,
          baseParams.data
        )
      ).toBe(true)
    })
  })
})
