import { Platform } from 'react-native'

/**
 * Прогрев первой страницы каталога `/search` до гидратации (#1372).
 *
 * До этого весь контент `/search` был заперт за гидратацией: список монтируется
 * только после того, как `useResponsiveWidth` измерит ширину на клиенте, а
 * первый запрос к `/api/travels/` уходит уже из `useListTravelData`. Замер прода
 * 2026-08-10 (mobile 390, CPU 4×, 1,6 Мбит / 150 мс): `app-hydrated` на 5 242 мс,
 * первый запрос к API — 6 009 мс, первые обложки — 6 539 мс.
 *
 * Механизм тот же класс, что `injectHomeHeroPreload` для картинки главной:
 * инлайновый скрипт в статическом HTML (`app/+html.tsx`) стартует ровно тот же
 * запрос, что потом построит React Query, и кладёт **необработанный `Response`**
 * в `window[TRAVEL_LIST_PRELOAD_GLOBAL]`. `fetchTravels` забирает его вместо
 * собственного `fetch`, поэтому вся постобработка (unwrap, нормализация,
 * public-stale кэш) остаётся ровно одна.
 *
 * Контракт: сопоставление идёт по **точной строке URL**. Если она разойдётся с
 * тем, что строит `fetchTravels`, прогрев просто не применится — будет обычный
 * запрос, а не второй лишний. Идентичность закреплена тестом
 * `__tests__/utils/travelListPreload.test.ts`.
 */

/** Имя глобали, куда инлайновый скрипт кладёт прогретый запрос. */
export const TRAVEL_LIST_PRELOAD_GLOBAL = '__metravelTravelListPreload'

/**
 * Где-условие каталога по умолчанию. Порядок ключей значим: `JSON.stringify`
 * сохраняет порядок вставки, а `fetchTravels` собирает его через
 * `applyPublishModeration`, который пишет сначала `publish`, затем `moderation`.
 */
const TRAVEL_LIST_PRELOAD_WHERE = { publish: 1, moderation: 1 }

/**
 * Прогрев осмыслен только для первого запроса страницы. Через минуту тело уже
 * устарело бы, а совпадение URL к этому моменту означало бы не «тот же самый
 * запрос», а случайно похожий — такой ответ отдавать нельзя.
 */
const TRAVEL_LIST_PRELOAD_TTL_MS = 60_000

/**
 * Окно прогрева должно совпадать с `LONG_TIMEOUT` у `fetchWithTimeout`:
 * потребитель ждёт именно этот промис, и более короткий обрыв заставил бы его
 * начать ВТОРОЙ полный запрос поверх уже потраченного времени.
 */
export const TRAVEL_LIST_PRELOAD_TIMEOUT_MS = 30_000

/**
 * Query-параметры `/search`, которые меняют запрос каталога. При любом из них
 * прогрев по дефолтному URL был бы лишним запросом, а не прогревом.
 *
 * Источник истины — ключи, которые читает `useListTravelInitialFilter`
 * (плюс `user_id`); соответствие закреплено тестом. Всё остальное
 * (`utm_*`, `fbclid`, `gclid`, `yclid`) на запрос не влияет и прогрев не гасит.
 */
export const TRAVEL_LIST_FILTER_PARAM_KEYS = [
  'user_id',
  'search',
  'q',
  'sort',
  'categories',
  'companions',
  'complexity',
  'month',
  'over_nights_stay',
  'over__nights__stay',
  'categoryTravelAddress',
  'category_travel_address',
  'category__travel__address',
]

export type TravelListPreloadEntry = {
  url: string
  startedAt: number
  response: Promise<Response>
}

/**
 * Query-string первой страницы каталога `/search` без фильтров и поиска.
 *
 * Должен побайтово совпадать с `buildWhereQueryParams({ page: 0, perPage,
 * query: '', where: { publish: 1, moderation: 1 } })` — обе стороны используют
 * `URLSearchParams` с одинаковым порядком вставки ключей.
 */
export function buildTravelListPreloadQuery(perPage: number): string {
  return new URLSearchParams({
    where: JSON.stringify(TRAVEL_LIST_PRELOAD_WHERE),
    page: '1',
    perPage: String(perPage),
    query: '',
  }).toString()
}

/** Полный URL прогреваемого запроса для базы API `apiBaseUrl` (…/api). */
export function buildTravelListPreloadUrl(apiBaseUrl: string, perPage: number): string {
  const base = String(apiBaseUrl || '').trim().replace(/\/+$/, '')
  if (!base) return ''
  return `${base}/travels/?${buildTravelListPreloadQuery(perPage)}`
}

const readGlobal = (): unknown => {
  const scope = window as unknown as Record<string, unknown>
  return scope[TRAVEL_LIST_PRELOAD_GLOBAL]
}

const clearGlobal = () => {
  const scope = window as unknown as Record<string, unknown>
  delete scope[TRAVEL_LIST_PRELOAD_GLOBAL]
}

/**
 * Забрать прогретый ответ для `url`, если он есть и это ровно тот же запрос.
 *
 * Одноразовый: после выдачи глобаль снимается, чтобы следующая страница или
 * другой фильтр не получили тело первой страницы. На native глобали нет никогда
 * (скрипт живёт только в web-HTML), поэтому дублирующего запроса там не будет.
 */
export function takeTravelListPreload(url: string): Promise<Response> | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null

  const entry = readGlobal() as TravelListPreloadEntry | undefined
  if (!entry || typeof entry !== 'object') return null

  const isUsable =
    entry.url === url &&
    typeof (entry.response as Promise<Response> | undefined)?.then === 'function' &&
    Number.isFinite(entry.startedAt) &&
    Date.now() - entry.startedAt < TRAVEL_LIST_PRELOAD_TTL_MS

  if (!isUsable) {
    // Протухший прогрев снимаем: держать его до конца сессии незачем.
    if (Number.isFinite(entry.startedAt) && Date.now() - entry.startedAt >= TRAVEL_LIST_PRELOAD_TTL_MS) {
      clearGlobal()
    }
    return null
  }

  clearGlobal()
  return entry.response
}
