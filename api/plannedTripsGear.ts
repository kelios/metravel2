// api/plannedTripsGear.ts
// Чеклист снаряжения planned trip (#1839, контракт бэкенда #1837).
//
// КОНТРАКТ ЭНДПОИНТА (trips/views.py, action `planned-gear`):
//   GET    /trips/planned/{tripId}/gear/            → TripGearItemDto[] (без пагинации)
//   POST   /trips/planned/{tripId}/gear/            body {title, category?, sort_order?} → один Dto
//   POST   /trips/planned/{tripId}/gear/            body {template:'hiking'}  → Dto[] созданных
//   PATCH  /trips/planned/{tripId}/gear/{itemId}/   body {status|title|category} → Dto
//   DELETE /trips/planned/{tripId}/gear/{itemId}/   → 204
//   GET доступен владельцу и участнику с response=going; запись — только владельцу.
//
// Мок-фолбэка здесь нет намеренно (Task Contract #1839): 404/501 показывают
// пустой список или ошибку, но НЕ подсовывают выдуманные вещи — иначе владелец
// собрался бы в поход по списку, которого нет на сервере.

import { apiClient } from '@/api/client'

/** Порядок статусов совпадает с циклом чипа: купить → есть → взято. */
export const TRIP_GEAR_STATUSES = ['buy', 'owned', 'packed'] as const
export type TripGearStatus = (typeof TRIP_GEAR_STATUSES)[number]

/** Категории `TripGearItem.Category` бэкенда, в порядке показа в чеклисте. */
export const TRIP_GEAR_CATEGORIES = [
  'documents',
  'clothing',
  'footwear',
  'electronics',
  'hygiene',
  'food',
  'first_aid',
  'other',
] as const
export type TripGearCategory = (typeof TRIP_GEAR_CATEGORIES)[number]

export const TRIP_GEAR_TITLE_MAX = 255

export interface TripGearItem {
  id: number
  title: string
  category: TripGearCategory
  status: TripGearStatus
  /** Порядок внутри поездки; бэк сортирует по нему, затем по id. */
  sortOrder: number
}

export interface TripGearItemDto {
  id: number
  title?: string | null
  category?: string | null
  status?: string | null
  sort_order?: number | null
}

export interface AddTripGearInput {
  tripId: number | string
  title: string
  category: TripGearCategory
}

export interface UpdateTripGearInput {
  tripId: number | string
  itemId: number
  status: TripGearStatus
}

export interface DeleteTripGearInput {
  tripId: number | string
  itemId: number
}

const isStatus = (value: unknown): value is TripGearStatus =>
  TRIP_GEAR_STATUSES.includes(value as TripGearStatus)

const isCategory = (value: unknown): value is TripGearCategory =>
  TRIP_GEAR_CATEGORIES.includes(value as TripGearCategory)

// Незнакомые status/category с бэка не роняют экран и не притворяются валидными:
// они деградируют в самое безобидное значение, а не в «взято» и не в пропуск
// строки — потерянная из списка вещь опаснее вещи в «Другое».
export const mapGearItem = (dto: TripGearItemDto): TripGearItem => ({
  id: Number(dto.id),
  title: (dto.title ?? '').trim(),
  category: isCategory(dto.category) ? dto.category : 'other',
  status: isStatus(dto.status) ? dto.status : 'buy',
  sortOrder: Number.isFinite(Number(dto.sort_order)) ? Number(dto.sort_order) : 0,
})

const asList = (response: TripGearItemDto[] | { results?: TripGearItemDto[] } | null | undefined) =>
  (Array.isArray(response) ? response : response?.results ?? []).map(mapGearItem)

export async function fetchTripGear(tripId: number | string): Promise<TripGearItem[]> {
  const res = await apiClient.get<TripGearItemDto[]>(`/trips/planned/${tripId}/gear/`)
  return asList(res)
}

export async function addTripGearItem(input: AddTripGearInput): Promise<TripGearItem> {
  const dto = await apiClient.post<TripGearItemDto>(`/trips/planned/${input.tripId}/gear/`, {
    title: input.title.trim().slice(0, TRIP_GEAR_TITLE_MAX),
    category: input.category,
  })
  return mapGearItem(dto)
}

/**
 * Шаблон хайкинга. Бэк добавляет только недостающие названия (сверка без учёта
 * регистра и пробелов) и возвращает ТОЛЬКО созданные позиции — на повторе
 * приходит пустой массив, и это не ошибка, а «дублировать нечего».
 */
export async function applyTripGearTemplate(tripId: number | string): Promise<TripGearItem[]> {
  const res = await apiClient.post<TripGearItemDto[]>(`/trips/planned/${tripId}/gear/`, {
    template: 'hiking',
  })
  return asList(res)
}

export async function updateTripGearItem(input: UpdateTripGearInput): Promise<TripGearItem> {
  const dto = await apiClient.patch<TripGearItemDto>(
    `/trips/planned/${input.tripId}/gear/${input.itemId}/`,
    { status: input.status },
  )
  return mapGearItem(dto)
}

export async function deleteTripGearItem(input: DeleteTripGearInput): Promise<{ id: number }> {
  await apiClient.delete<null>(`/trips/planned/${input.tripId}/gear/${input.itemId}/`)
  return { id: input.itemId }
}
