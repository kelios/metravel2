// components/trips/planning/tripGearRules.ts
// Чистые правила чеклиста снаряжения (#1839): цикл статуса, группировка по
// категориям, прогресс и подписи. Живут отдельно от компонента, потому что
// проверяются юнитами без рендера и переиспользуются шапкой блока и строкой.

import {
  TRIP_GEAR_CATEGORIES,
  TRIP_GEAR_STATUSES,
  type TripGearCategory,
  type TripGearItem,
  type TripGearStatus,
} from '@/api/plannedTripsGear'
import { translate as i18nT } from '@/i18n'

export const GEAR_STATUS_LABEL: Record<TripGearStatus, string> = {
  get buy() { return i18nT('trips:components.trips.planning.TripGearChecklist.status.buy') },
  get owned() { return i18nT('trips:components.trips.planning.TripGearChecklist.status.owned') },
  get packed() { return i18nT('trips:components.trips.planning.TripGearChecklist.status.packed') },
}

export const GEAR_CATEGORY_LABEL: Record<TripGearCategory, string> = {
  get documents() { return i18nT('trips:components.trips.planning.TripGearChecklist.category.documents') },
  get clothing() { return i18nT('trips:components.trips.planning.TripGearChecklist.category.clothing') },
  get footwear() { return i18nT('trips:components.trips.planning.TripGearChecklist.category.footwear') },
  get electronics() { return i18nT('trips:components.trips.planning.TripGearChecklist.category.electronics') },
  get hygiene() { return i18nT('trips:components.trips.planning.TripGearChecklist.category.hygiene') },
  get food() { return i18nT('trips:components.trips.planning.TripGearChecklist.category.food') },
  get first_aid() { return i18nT('trips:components.trips.planning.TripGearChecklist.category.first_aid') },
  get other() { return i18nT('trips:components.trips.planning.TripGearChecklist.category.other') },
}

/**
 * Тап по чипу двигает статус по кругу `купить → есть → взято → купить`.
 * Порядок — тот же массив, что объявляет контракт бэка, поэтому новый статус
 * в контракте сломает компиляцию, а не молча выпадет из цикла.
 */
export const nextGearStatus = (status: TripGearStatus): TripGearStatus =>
  TRIP_GEAR_STATUSES[(TRIP_GEAR_STATUSES.indexOf(status) + 1) % TRIP_GEAR_STATUSES.length]

export interface GearGroup {
  category: TripGearCategory
  items: TripGearItem[]
}

/**
 * Категории идут фиксированным порядком макета, а вещи внутри — порядком бэка
 * (`sort_order`, затем `id`). Пустые категории не показываются: заголовок без
 * строк читался бы как «здесь что-то потерялось».
 */
export const groupGearByCategory = (items: TripGearItem[]): GearGroup[] =>
  TRIP_GEAR_CATEGORIES.map((category) => ({
    category,
    items: items.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0)

export interface GearProgress {
  packed: number
  total: number
  complete: boolean
}

/** «Готово» — это `packed`: «есть» лежит дома, а не в рюкзаке. */
export const gearProgress = (items: TripGearItem[]): GearProgress => {
  const packed = items.filter((item) => item.status === 'packed').length
  return { packed, total: items.length, complete: items.length > 0 && packed === items.length }
}
