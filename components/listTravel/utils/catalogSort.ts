import { Platform } from 'react-native'

/**
 * #2903: сортировка публичного каталога «Ближе ко мне / По релевантности / Новые».
 *
 * Порядок считает только сервер (`GET /api/travels/?sort=distance&lat=&lng=`,
 * бэкенд #2929; без точки — от Минска): клиентская пересортировка страницы
 * ломала бы пагинацию. «По релевантности» — это отсутствие `sort`: сервер сам
 * ранжирует текстовый запрос, а без текста отдаёт порядок по умолчанию.
 */
export const DISTANCE_SORT_ID = 'distance'
export const RELEVANCE_SORT_ID = 'relevance'
export const NEWEST_SORT_ID = 'newest'

/** Варианты переключателя публичного каталога, в порядке показа. */
export const CATALOG_PROXIMITY_SORT_IDS = [DISTANCE_SORT_ID, RELEVANCE_SORT_ID] as const

export type DistanceSortOrigin = { lat: number; lng: number }

/** Клиентский id «По релевантности» в фильтр не пишется: это сброс `sort`. */
export const normalizeCatalogSortValue = (value: unknown): string => {
  const id = typeof value === 'string' ? value.trim() : ''
  return id === RELEVANCE_SORT_ID ? '' : id
}

/**
 * Точность точки — 2 знака (~1 км): этого хватает для порядка «ближе/дальше»,
 * точная позиция человека на сервер не уходит, а ключ кэша не дрожит.
 */
const roundCoord = (value: number) => Math.round(value * 100) / 100

const isUsableOrigin = (origin: DistanceSortOrigin | null | undefined): origin is DistanceSortOrigin =>
  !!origin &&
  Number.isFinite(origin.lat) &&
  Number.isFinite(origin.lng) &&
  Math.abs(origin.lat) <= 90 &&
  Math.abs(origin.lng) <= 180

/** Параметры списка для `sort=distance` дополняются точкой отсчёта; иначе — без изменений. */
export function withDistanceSortOrigin<T extends Record<string, unknown>>(
  params: T,
  origin: DistanceSortOrigin | null | undefined,
): T {
  if (params.sort !== DISTANCE_SORT_ID && !('lat' in params) && !('lng' in params)) return params
  const next: Record<string, unknown> = { ...params }
  delete next.lat
  delete next.lng
  if (params.sort !== DISTANCE_SORT_ID || !isUsableOrigin(origin)) return next as T
  next.lat = roundCoord(origin.lat)
  next.lng = roundCoord(origin.lng)
  return next as T
}

// «Запоминается в сессии»: web — sessionStorage вкладки, native — память процесса.
const SESSION_KEY = 'metravel:catalog-sort'
let memorySort: string | null = null

const readSessionStorage = (): Storage | null => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null
  try {
    return window.sessionStorage ?? null
  } catch {
    return null
  }
}

/** Явный выбор человека; `''` — «По релевантности». `null` — выбора в этой сессии не было. */
export function readRememberedCatalogSort(): string | null {
  const storage = readSessionStorage()
  if (storage) {
    try {
      const stored = storage.getItem(SESSION_KEY)
      if (stored !== null) return stored
    } catch {
      // хранилище недоступно — остаётся память процесса
    }
  }
  return memorySort
}

export function rememberCatalogSort(value: unknown): void {
  const normalized = normalizeCatalogSortValue(value)
  memorySort = normalized
  const storage = readSessionStorage()
  if (!storage) return
  try {
    storage.setItem(SESSION_KEY, normalized)
  } catch {
    // память процесса уже обновлена
  }
}

/** Только для тестов. */
export function resetRememberedCatalogSortForTests(): void {
  memorySort = null
  const storage = readSessionStorage()
  try {
    storage?.removeItem(SESSION_KEY)
  } catch {
    // noop
  }
}

/**
 * Сортировка, которую каталог применяет при входе без `sort` в адресе:
 * явный выбор этой сессии, но не для текстового запроса — у него по умолчанию
 * релевантность (чипы «выходного дня» приносят `sort=distance` в адресе сами).
 */
export function resolveInitialCatalogSort(params: { urlSort: string; search: string }): string | null {
  if (params.urlSort.trim() || params.search.trim()) return null
  const remembered = readRememberedCatalogSort()
  return remembered ? remembered : null
}

/**
 * Какой вариант отметить активным. Пустой `sort` в каталоге с «По релевантности»
 * — это именно она; в остальных списках остаётся прежний вариант по умолчанию.
 */
export function resolveActiveSortId(
  value: unknown,
  optionIds: readonly string[],
  fallback: string,
): string {
  const id = typeof value === 'string' ? value.trim() : ''
  if (id) return id
  return optionIds.includes(RELEVANCE_SORT_ID) ? RELEVANCE_SORT_ID : fallback
}
