// #2134 (Apple 1.2(d)): мгновенное скрытие контента заблокированного автора.
//
// Блокировка — не мутация двух ключей, а слой кэша. Реестр ниже перечисляет все
// запросы, где лежит контент с автором, и как из каждого вырезать его объекты.
// Записи без `strip` — refetch-only: деталь или производная выдача, которую
// фильтрует бэк (#2130, #2164). Отзывы квестов и списки статей с #2163/#2169
// несут id автора (`authorId` отзыва, `author_id` статьи) и режутся сразу.
//
// Guard (`installBlockedAuthorGuard`) — канонический клиентский фильтр: он
// повторно режет каждый успешный ответ из реестра по текущему набору
// заблокированных. Поэтому контент не возвращается ни после refetch, ни после
// перезагрузки: набор берётся из `myBlockedUsers(owner)`, который
// `BlockedAuthorsRuntime` загружает при старте сессии. Пока набор не загружен,
// ленты не прячутся; у гостя набор всегда пуст.
//
// Полноту реестра держит `__tests__/api/blockSensitiveQueries.test.ts`: каждый
// корень `queryKeys`/`commentKeys` и каждый ad-hoc ключ в исходниках обязан быть
// либо в реестре, либо в `BLOCK_EXEMPT_ROOTS` с причиной.

import type { Query, QueryClient, QueryKey } from '@tanstack/react-query'

import { commentKeys } from '@/hooks/comments/commentKeys'
import { queryKeys } from '@/api/queryKeys'
import { shouldPersistQuery } from '@/utils/queryPersist'
import {
  chatSenderIds,
  organizerIds,
  stripCollection,
  stripComments,
  toAuthorId,
  travelAuthorIds,
  type BlockedIds,
} from '@/api/blockSensitiveShapes'

export { toAuthorId, travelAuthorIds } from '@/api/blockSensitiveShapes'

export type SensitiveEntry = {
  key: QueryKey
  /** Без `strip` — refetch-only. */
  strip?: (data: unknown, blocked: BlockedIds) => unknown
}

const travels = (data: unknown, blocked: BlockedIds) => stripCollection(data, travelAuthorIds, blocked)

export const BLOCK_SENSITIVE_ENTRIES: readonly SensitiveEntry[] = [
  // Ленты путешествий (каталог — infinite, популярное/месяца — карта по id).
  { key: queryKeys.travels(), strip: travels },
  { key: queryKeys.randomTravels(), strip: travels },
  { key: queryKeys.travelsPopular(), strip: travels },
  { key: queryKeys.travelsOfMonth(), strip: travels },
  // Секции главной: ключ — проп `queryKey` у HomeInspirationSection.
  { key: ['home-new-travels'], strip: travels },
  { key: queryKeys.homePopularTravels(), strip: travels },
  { key: ['home-travels-of-month'], strip: travels },
  { key: ['travels-near'], strip: travels },
  { key: ['travels-for-quest'], strip: travels },
  { key: ['travels-near-location'], strip: travels },
  { key: ['user-travels'], strip: travels },
  // Комментарии: списки и дерево; ответ уходит вместе с заблокированным родителем.
  { key: commentKeys.all, strip: stripComments },
  { key: ['trip-chat-messages'], strip: (data, blocked) => stripCollection(data, chatSenderIds, blocked) },
  { key: queryKeys.publicTripsAll(), strip: (data, blocked) => stripCollection(data, organizerIds, blocked) },
  { key: queryKeys.communityTripsAll(), strip: (data, blocked) => stripCollection(data, organizerIds, blocked) },
  // Отзывы квестов: под корнем `quest` только queryKeys.questReviews; автор — `authorId` (#2169).
  { key: ['quest'], strip: travels },
  { key: ['articles'], strip: travels },
  // Refetch-only: в ответе нет id автора или это деталь/производная, которую фильтрует бэк.
  { key: ['article'] },
  { key: queryKeys.travelAll() },
  { key: ['public-trip'] },
  { key: queryKeys.tripChatAll() },
  { key: ['travels-near-map'] },
  { key: queryKeys.travelsForMapAll() },
  { key: queryKeys.travelsForMapRouteAll() },
  { key: queryKeys.mapClustersAll() },
  // #2165: каталог мест и материалы места несут путешествия авторов; бэк режет их по сессии (#2164).
  { key: queryKeys.placesCatalogAll() },
  { key: queryKeys.mapPlaceSourcesAll() },
  { key: ['recommendations'] },
  { key: ['favorites'] },
  { key: ['view-history'] },
  { key: ['my-subscriptions'] },
  { key: ['my-subscribers'] },
  { key: queryKeys.contactRequestsAll() },
  { key: ['trip-applications'] },
  { key: ['trip-notifications'] },
  { key: ['messages'] },
]

/** Контракт карточки #2134: ключи реестра. */
export const BLOCK_SENSITIVE_QUERIES: readonly QueryKey[] = BLOCK_SENSITIVE_ENTRIES.map((entry) => entry.key)

/** Корни кэша без чужого авторского контента — с причиной, почему блок их не касается. */
export const BLOCK_EXEMPT_ROOTS: Readonly<Record<string, string>> = {
  'travel-route-files': 'файлы трека открытого путешествия; сама деталь перезапрашивается',
  'email-subscription-status': 'подписка email своего аккаунта на рассылку; чужого контента нет',
  filters: 'справочник',
  'filter-options': 'справочник',
  'travel-facets': 'агрегаты фильтров без карточек',
  userPointsAll: 'личные точки владельца',
  'my-travels-count': 'свои путешествия',
  'export-my-travels-count': 'свои путешествия',
  'full-book-export': 'серверные задания книги владельца: статус и счётчики, без чужого контента',
  travelUserRating: 'своя оценка',
  questUserReview: 'свой отзыв',
  'roulette-travel-facets': 'агрегаты фильтров без карточек',
  'location-search': 'геокодер',
  'reverse-geocode': 'геокодер',
  'terms-accepted-current': 'своё согласие',
  'user-profile': 'патчится напрямую: is_blocked_by_me',
  'user-country-progress': 'агрегат профиля, экран профиля скрыт при блоке',
  'travel-status': 'свои статусы',
  'author-engagement': 'автор — текущий пользователь',
  'quest-bundle': 'контент квеста редакционный',
  'quest-serving': 'анонимная проекция публикации редакционного квеста: язык, состояние и адреса без авторского контента',
  quests: 'каталог квестов редакционный',
  'quest-city-classification': 'справочник квестов',
  'quests-near-location': 'квесты редакционные',
  'quest-progress': 'своё прохождение',
  articleRating: 'своя оценка',
  placeRating: 'своя оценка места',
  strava: 'свои данные Strava',
  achievements: 'значки; экран профиля скрыт при блоке',
  gamification: 'прогресс; экран профиля скрыт при блоке',
  privacy: 'свои настройки',
  security: 'свой журнал',
  'planned-trips': 'свои поездки',
  'planned-trip': 'деталь своей/участвуемой поездки',
  'trip-route-elevation': 'профиль высот',
  'planned-trip-route-files': 'файлы трека поездки',
  'planned-trip-route-track': 'трек поездки',
  'planned-trip-gear': 'приватный чеклист',
  'route-templates': 'шаблоны маршрутов',
  'trip-suggestions': 'подсказки к своей поездке',
  'user-report-reasons': 'справочник',
  'user-blocked': 'сам набор заблокированных',
  'user-verifications': 'свои верификации',
  'participant-rating': 'оценка участника; профиль скрыт при блоке',
  'telegram-link': 'своя привязка',
  'trip-telegram-group': 'группа поездки; доступ режет бэк',
}

// ---- Набор заблокированных ----------------------------------------------------

type BlockListener = (authorId: number, blocked: boolean) => void

const listeners = new Set<BlockListener>()
// Оптимистичные id до ответа сервера; принадлежат владельцу сессии `pendingOwner`.
const pending = new Set<number>()
let pendingOwner: string | null | undefined
let resolveOwner: (() => string | null) | null = null
let guardClient: QueryClient | null = null
let serverCache: { data: unknown; ids: Set<number> } | null = null

const currentOwner = (): string | null | undefined => (resolveOwner ? resolveOwner() : undefined)

const syncPendingOwner = (owner: string | null | undefined) => {
  if (owner === pendingOwner) return
  pending.clear()
  pendingOwner = owner
}

const serverBlockedIds = (owner: string | null | undefined): Set<number> => {
  if (!guardClient || owner == null) return new Set()
  const data = guardClient.getQueryData(queryKeys.myBlockedUsers(owner))
  if (serverCache && serverCache.data === data) return serverCache.ids
  // id заблокированного — поле `user`; `id` у ProfileSerializer — id профиля (api/user.ts:40).
  const ids = new Set<number>()
  if (Array.isArray(data)) {
    data.forEach((item) => {
      const id = toAuthorId((item as { user?: unknown } | null)?.user)
      if (id !== null) ids.add(id)
    })
  }
  serverCache = { data, ids }
  return ids
}

/** Текущий набор: сервер (`myBlockedUsers`) ∪ оптимистичные. У гостя пуст. */
export function getBlockedAuthorIds(): ReadonlySet<number> {
  const owner = currentOwner()
  syncPendingOwner(owner)
  if (owner === null) return new Set()
  const server = serverBlockedIds(owner)
  if (pending.size === 0) return server
  return new Set([...server, ...pending])
}

/** Скрыт ли объект (путешествие/статья/снимок офлайна) заблокированным автором. */
export const isAuthoredByBlocked = (item: unknown): boolean => {
  const blocked = getBlockedAuthorIds()
  return blocked.size > 0 && travelAuthorIds(item).some((id) => blocked.has(id))
}

export function subscribeAuthorBlock(fn: BlockListener): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

const emit = (authorId: number, blocked: boolean) => {
  listeners.forEach((fn) => fn(authorId, blocked))
}

// ---- Работа с кэшем -------------------------------------------------------------

const ENTRY_BY_ROOT = new Map<unknown, SensitiveEntry>(
  BLOCK_SENSITIVE_ENTRIES.map((entry) => [entry.key[0], entry]),
)

const matchesEntry = (queryKey: QueryKey, entry: SensitiveEntry): boolean =>
  entry.key.every((part, index) => queryKey[index] === part)

const findEntry = (queryKey: QueryKey): SensitiveEntry | undefined => {
  const entry = ENTRY_BY_ROOT.get(queryKey[0])
  return entry && matchesEntry(queryKey, entry) ? entry : undefined
}

const stripQuery = (qc: QueryClient, query: Query, entry: SensitiveEntry, blocked: BlockedIds) => {
  const data = query.state.data
  if (data === undefined || !entry.strip) return
  const next = entry.strip(data, blocked)
  // Пишем только при изменении: иначе каждое событие кэша порождало бы запись.
  if (next !== data) qc.setQueryData(query.queryKey, next)
}

const stripAll = (qc: QueryClient, blocked: BlockedIds) => {
  if (blocked.size === 0) return
  BLOCK_SENSITIVE_ENTRIES.forEach((entry) => {
    if (!entry.strip) return
    qc.getQueryCache().findAll({ queryKey: entry.key }).forEach((query) => stripQuery(qc, query, entry, blocked))
  })
}

/** Любой вариант ключа профиля пользователя: id строкой или числом, с суффиксом. */
export const isUserProfileOf = (queryKey: QueryKey, authorId: number | string) =>
  queryKey[0] === 'user-profile' && String(queryKey[1]) === String(authorId)

/** Патч `is_blocked_by_me` во всех вариантах ключа профиля (id строкой и числом, с суффиксом). */
export function patchProfileBlocked(qc: QueryClient, authorId: number, blocked: boolean) {
  qc.setQueriesData<unknown>({ predicate: (query) => isUserProfileOf(query.queryKey, authorId) }, (old: unknown) =>
    old && typeof old === 'object' && !Array.isArray(old)
      ? { ...(old as Record<string, unknown>), is_blocked_by_me: blocked }
      : old,
  )
}

/** Мгновенно убирает объекты автора из всех лент реестра и помечает профиль. */
export function applyAuthorBlock(qc: QueryClient, authorId: number): void {
  syncPendingOwner(currentOwner())
  pending.add(authorId)
  stripAll(qc, new Set([authorId]))
  patchProfileBlocked(qc, authorId, true)
  emit(authorId, true)
}

/**
 * Снимает оптимистичный блок без записи в кэш. `notify: false` — разблокировка до
 * ответа сервера: подписчики (сообщения) перечитывают данные только после него.
 */
export function releaseAuthorBlock(authorId: number, notify = true): void {
  pending.delete(authorId)
  if (notify) emit(authorId, false)
}

/** Разблокировка подтверждена сервером: подписчики перечитывают свои данные. */
export function notifyAuthorUnblocked(authorId: number): void {
  emit(authorId, false)
}

export type BlockSnapshot = Array<[QueryKey, unknown]>

/** Снимок реестра и профиля автора для отката по образцу `commentMutations`. */
export function snapshotBlockSensitiveQueries(qc: QueryClient, authorId: number): BlockSnapshot {
  const snapshot: BlockSnapshot = []
  BLOCK_SENSITIVE_ENTRIES.forEach((entry) => {
    if (entry.strip) snapshot.push(...qc.getQueriesData({ queryKey: entry.key }))
  })
  snapshot.push(...qc.getQueriesData({ predicate: (query) => isUserProfileOf(query.queryKey, authorId) }))
  return snapshot
}

export function restoreBlockSnapshot(qc: QueryClient, snapshot: BlockSnapshot) {
  snapshot.forEach(([key, data]) => qc.setQueryData(key, data))
}

export async function cancelBlockSensitiveQueries(qc: QueryClient) {
  await Promise.all(
    BLOCK_SENSITIVE_ENTRIES.filter((entry) => entry.strip).map((entry) => qc.cancelQueries({ queryKey: entry.key })),
  )
}

// Офлайн-домены (`utils/queryPersist.ts`) не сносятся: их снимок нужен без сети.
const isDroppable = (query: Query) => query.getObserversCount() === 0 && !shouldPersistQuery(query)

/**
 * Перезапрос реестра: на экране (`active`) — сразу. Копии без наблюдателей,
 * которые устарели (refetch-only после блока — вырезать в них нечего; всё после
 * разблокировки — в вырезанных лентах нет автора), сносятся, а не перечитываются:
 * `refetchType: 'all'` дал бы залп запросов по каждому закэшированному bbox карты,
 * детали и странице каталога, а с `refetchOnMount: false` (кластеры карты) простая
 * инвалидация вернула бы старый ответ при возврате. Скрытые, но наблюдаемые
 * запросы (`enabled: false`) остаются помеченными и перечитываются при включении.
 * `rollback` — блок не прошёл: сервер ничего не менял, снимок уже восстановлен,
 * перечитывается только экран (полёты, отменённые в onMutate).
 */
export function invalidateBlockSensitiveQueries(qc: QueryClient, mode: 'block' | 'unblock' | 'rollback') {
  BLOCK_SENSITIVE_ENTRIES.forEach((entry) => {
    const dropStale = mode === 'unblock' || (mode === 'block' && !entry.strip)
    if (dropStale) qc.removeQueries({ queryKey: entry.key, predicate: isDroppable })
    void qc.invalidateQueries({ queryKey: entry.key, refetchType: 'active' })
  })
}

// ---- Guard --------------------------------------------------------------------

const isBlockedListKey = (queryKey: QueryKey) => queryKey[0] === 'user-blocked' && queryKey[1] === 'me'

/**
 * Подписка на кэш: каждый успешный ответ из реестра повторно режется по текущему
 * набору; обновление `myBlockedUsers` режет весь реестр. `getOwner` — владелец
 * сессии (как `useQueryOwner`): набор и оптимистичные id чужой сессии не
 * применяются, а при смене владельца сбрасываются.
 */
export function installBlockedAuthorGuard(
  qc: QueryClient,
  options: { getOwner: () => string | null },
): () => void {
  guardClient = qc
  resolveOwner = options.getOwner
  serverCache = null
  const unsubscribe = qc.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success') return
    const { queryKey } = event.query
    if (isBlockedListKey(queryKey)) {
      stripAll(qc, getBlockedAuthorIds())
      return
    }
    const entry = findEntry(queryKey)
    if (!entry?.strip) return
    const blocked = getBlockedAuthorIds()
    if (blocked.size > 0) stripQuery(qc, event.query, entry, blocked)
  })
  stripAll(qc, getBlockedAuthorIds())
  return () => {
    unsubscribe()
    if (guardClient === qc) {
      guardClient = null
      resolveOwner = null
      serverCache = null
    }
  }
}

export function resetBlockedAuthorStateForTests() {
  pending.clear()
  pendingOwner = undefined
  listeners.clear()
  resolveOwner = null
  guardClient = null
  serverCache = null
}
