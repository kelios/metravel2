/**
 * #2776 (MAP-NEARBY-CARD-TITLE-HIERARCHY): «Места рядом» шли в порядке `id`
 * бэкенда — первой стояла «Парковка у дороги Н8331», расстояния не было.
 */
import {
  formatDistanceFromOrigin,
  isServicePlace,
  orderNearbyPlaces,
  resolveListDistanceOrigin,
  sortNearbyPlaces,
} from '@/components/MapPage/TravelListPanel/nearbyOrder'

const MINSK = { latitude: 53.9006, longitude: 27.559 }

// Координаты и категории — из прод-ответа `/api/travels/search_travels_for_map/`
// (`/map?radius=60`, 26.10.2026): порядок ответа = порядок `id`.
const parking = { id: 355, lat: 53.9832626, lng: 26.9879837, categoryIds: [91], address: 'Парковка у дороги Н8331' }
const ivenets = { id: 1201, lat: 53.888, lng: 26.743, categoryIds: [150], address: 'Костёл в Ивенце' }
const yarshevichi = { id: 1202, lat: 53.81, lng: 27.13, categoryIds: [142], address: 'Церковь в Яршевичах' }
const city = { id: 1203, lat: 53.905, lng: 27.56, categoryIds: [89], address: 'Памятник в Минске' }
const key = (item: { id: number }) => String(item.id)

describe('nearby list origin (#2776)', () => {
  it('prefers the user position and falls back to the search centre', () => {
    expect(resolveListDistanceOrigin({ latitude: 54, longitude: 28 }, MINSK)).toEqual({
      latitude: 54, longitude: 28, kind: 'user',
    })
    expect(resolveListDistanceOrigin(null, MINSK)).toEqual({ ...MINSK, kind: 'searchCenter' })
    expect(resolveListDistanceOrigin(null, null)).toBeNull()
  })

  it('names the origin inside one localized phrase', () => {
    expect(formatDistanceFromOrigin('12 км', 'user')).toBe('12 км от вас')
    expect(formatDistanceFromOrigin('12 км', 'searchCenter')).toBe('12 км от центра поиска')
  })
})

describe('nearby list order (#2776)', () => {
  it('puts destinations by distance first and service points after them', () => {
    const origin = resolveListDistanceOrigin(null, MINSK)
    const ordered = sortNearbyPlaces([parking, ivenets, yarshevichi, city], origin)
    expect(ordered.map((item) => item.id)).toEqual([1203, 1202, 1201, 355])
  })

  it('treats a point as service only when all of its categories are service ones', () => {
    expect(isServicePlace(parking)).toBe(true)
    expect(isServicePlace({ categoryIds: [91, 84] })).toBe(false)
    expect(isServicePlace({ categoryIds: [] })).toBe(false)
  })

  it('keeps already shown cards in place when the next page arrives', () => {
    const origin = resolveListDistanceOrigin(null, MINSK)
    const first = orderNearbyPlaces([parking, ivenets], origin, key, null)
    expect(first.ordered.map((item) => item.id)).toEqual([1201, 355])

    // Вторая страница принесла места ближе: они встают после показанных, а не
    // над ними — иначе список прыгнул бы под пальцем при догрузке.
    const second = orderNearbyPlaces([parking, ivenets, yarshevichi, city], origin, key, first)
    expect(second.ordered.map((item) => item.id)).toEqual([1201, 355, 1203, 1202])
  })

  it('re-sorts from scratch for a new result set or a new origin', () => {
    const origin = resolveListDistanceOrigin(null, MINSK)
    const first = orderNearbyPlaces([parking, ivenets], origin, key, null)
    const fresh = orderNearbyPlaces([city, parking], origin, key, first)
    expect(fresh.ordered.map((item) => item.id)).toEqual([1203, 355])

    const moved = resolveListDistanceOrigin({ latitude: 53.888, longitude: 26.743 }, MINSK)
    const relocated = orderNearbyPlaces([parking, ivenets, city], moved, key, first)
    expect(relocated.ordered.map((item) => item.id)).toEqual([1201, 1203, 355])
  })
})
