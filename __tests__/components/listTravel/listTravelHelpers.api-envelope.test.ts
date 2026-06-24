/**
 * listTravelHelpers.api-envelope.test.ts
 *
 * BUG-CLASS-6: Нормализация обёрток API-ответов
 *
 * Регресс-тесты для normalizeApiResponse, покрывающие форматы,
 * которые пропускались предыдущим набором (прежде всего { results: [...] }).
 * Ловит схлопывание списков в пусто при смене формата ответа бэкенда.
 *
 * Дополняет: __tests__/components/listTravel/listTravelHelpers.test.ts
 */

import { normalizeApiResponse, deduplicateTravels } from '@/components/listTravel/utils/listTravelHelpers'
import type { Travel } from '@/types/types'

const baseTravel: Travel = {
  id: 0,
  slug: 'envelope-test',
  name: 'Envelope test travel',
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

const makeTravel = (id: number): Travel => ({ ...baseTravel, id, slug: `travel-${id}`, name: `Travel ${id}` })

describe('normalizeApiResponse — BUG-CLASS-6 API envelope regression', () => {
  /**
   * DRF paginated response: { count, next, previous, results: [...] }
   * This is the default Django REST Framework list format.
   * Without explicit handling it collapses to empty — the exact bug from AND-USB-28.
   */
  it('unwraps { results: [...] } DRF pagination envelope', () => {
    const items = [makeTravel(1), makeTravel(2), makeTravel(3)]
    const response = normalizeApiResponse({ count: 3, next: null, previous: null, results: items })
    expect(response.items).toHaveLength(3)
    expect(response.items).toEqual(items)
    expect(response.total).toBe(3)
  })

  it('unwraps { results: [...], count: N } and uses count as total', () => {
    const items = [makeTravel(10), makeTravel(11)]
    const response = normalizeApiResponse({ results: items, count: 100 })
    expect(response.items).toEqual(items)
    expect(response.total).toBe(100)
  })

  it('unwraps { results: [...] } when count is absent (falls back to length)', () => {
    const items = [makeTravel(20)]
    const response = normalizeApiResponse({ results: items })
    expect(response.items).toEqual(items)
    expect(response.total).toBeGreaterThanOrEqual(1)
  })

  it('returns empty items and 0 total for { results: [] } (genuine empty page)', () => {
    const response = normalizeApiResponse({ count: 0, results: [] })
    expect(response.items).toHaveLength(0)
    expect(response.total).toBe(0)
  })

  /**
   * DRF bare array (some custom viewsets skip pagination)
   */
  it('handles bare array (unpaginated endpoint)', () => {
    const items = [makeTravel(30), makeTravel(31)]
    const response = normalizeApiResponse(items)
    expect(response.items).toEqual(items)
    expect(response.total).toBe(2)
  })

  /**
   * { data: [...] } envelope — already handled, regression guard
   */
  it('handles { data: [...] } envelope (regression guard)', () => {
    const items = [makeTravel(40)]
    const response = normalizeApiResponse({ data: items, total: 10 })
    expect(response.items).toEqual(items)
    expect(response.total).toBe(10)
  })

  /**
   * { items: [...] } envelope — already handled, regression guard
   */
  it('handles { items: [...] } envelope (regression guard)', () => {
    const items = [makeTravel(50), makeTravel(51)]
    const response = normalizeApiResponse({ items, total: 50, count: 50 })
    expect(response.items).toEqual(items)
    expect(response.total).toBe(50)
  })

  /**
   * Nullish / garbage inputs must never throw
   */
  it('returns empty defaults for null, undefined, and non-object inputs', () => {
    expect(normalizeApiResponse(null)).toEqual({ items: [], total: 0 })
    expect(normalizeApiResponse(undefined)).toEqual({ items: [], total: 0 })
    expect(normalizeApiResponse(42)).toEqual({ items: [], total: 0 })
    expect(normalizeApiResponse('string')).toEqual({ items: [], total: 0 })
  })

  /**
   * Edge: { results: null } must not throw — treat as empty
   */
  it('treats { results: null } as empty, not a crash', () => {
    const response = normalizeApiResponse({ results: null, count: 0 })
    expect(response.items).toHaveLength(0)
    expect(response.total).toBe(0)
  })
})

describe('deduplicateTravels — BUG-CLASS-6 regression', () => {
  /**
   * Confirm that the dedup layer does not silently discard all items
   * when the id field is numeric 0 (falsy).
   */
  it('does not discard items whose id is numeric zero when slug is present', () => {
    const t0 = makeTravel(0) // id=0 is falsy — must NOT be dropped if slug is set
    t0.slug = 'slug-zero'
    const t1 = makeTravel(1)

    const result = deduplicateTravels([t0, t1])
    // Both items have distinct slugs; neither should be dropped
    expect(result).toHaveLength(2)
  })
})
