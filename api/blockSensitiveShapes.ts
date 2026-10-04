// #2134: формы кэша React Query, из которых блокировка автора вырезает его объекты.
//
// Каждый хелпер возвращает ТОТ ЖЕ объект, если вырезать нечего: guard кэша
// (`api/blockSensitiveQueries.ts`) пишет в кэш только при изменении, поэтому
// лишних записей, ре-рендеров и циклов «запись → событие → запись» нет.

import type { TravelComment, TravelCommentTree, TravelCommentTreeNode } from '@/types/comments'

export type BlockedIds = ReadonlySet<number>
export type AuthorIdsOf = (item: unknown) => number[]

type AnyRecord = Record<string, unknown>

const asRecord = (value: unknown): AnyRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : null

/** Положительный целый id из числа или строки; остальное — null. */
export const toAuthorId = (value: unknown): number | null => {
  const n = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== '' ? Number(value.trim()) : NaN
  return Number.isInteger(n) && n > 0 ? n : null
}

const pushId = (ids: number[], value: unknown) => {
  const id = toAuthorId(value)
  if (id !== null && !ids.includes(id)) ids.push(id)
}

/**
 * Авторы путешествия: `userIds` (бэк отдаёт CSV-строку «1,2», число или массив —
 * `api/travelsNormalize.ts:360`), `user` (объект с id или число) и плоские
 * `userId`/`author_id`. Соавторский маршрут скрывается при блоке любого автора.
 */
export const travelAuthorIds: AuthorIdsOf = (item) => {
  const rec = asRecord(item)
  if (!rec) return []
  const ids: number[] = []
  const rawIds = rec.userIds ?? rec.user_ids
  const parts = Array.isArray(rawIds)
    ? rawIds
    : typeof rawIds === 'string' ? rawIds.split(',') : [rawIds]
  parts.forEach((part) => pushId(ids, part))
  const user = rec.user
  pushId(ids, asRecord(user)?.id ?? user)
  for (const key of ['userId', 'user_id', 'authorId', 'author_id']) pushId(ids, rec[key])
  pushId(ids, asRecord(rec.author)?.id)
  return ids
}

/** Комментарий: числовой `user` (`types/comments.ts:13`). Треды и прочее не трогаем. */
export const commentAuthorIds: AuthorIdsOf = (item) => {
  const rec = asRecord(item)
  if (!rec || typeof rec.text !== 'string') return []
  const id = toAuthorId(rec.user)
  return id === null ? [] : [id]
}

/** Сообщение чата поездки: `senderId` (`api/tripChat.ts:32`). */
export const chatSenderIds: AuthorIdsOf = (item) => {
  const id = toAuthorId(asRecord(item)?.senderId)
  return id === null ? [] : [id]
}

/** Публичная и community-поездка: `organizer.id` (`api/publicTrips.ts:56`, `api/plannedTripsTypes.ts:163`). */
export const organizerIds: AuthorIdsOf = (item) => {
  const id = toAuthorId(asRecord(asRecord(item)?.organizer)?.id)
  return id === null ? [] : [id]
}

const isBlockedBy = (authorIdsOf: AuthorIdsOf, blocked: BlockedIds) =>
  (item: unknown): boolean => authorIdsOf(item).some((id) => blocked.has(id))

const filterArray = (items: unknown[], blocked: (item: unknown) => boolean): unknown[] => {
  const next = items.filter((item) => !blocked(item))
  return next.length === items.length ? items : next
}

const decrementCounter = (value: unknown, removed: number): unknown => {
  if (typeof value === 'number') return Math.max(0, value - removed)
  const parsed = typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(parsed) ? Math.max(0, parsed - removed) : value
}

const ENVELOPE_LIST_KEYS = ['data', 'items', 'results'] as const

const stripEnvelope = (rec: AnyRecord, blocked: (item: unknown) => boolean): AnyRecord | null => {
  const listKey = ENVELOPE_LIST_KEYS.find((key) => Array.isArray(rec[key]))
  if (!listKey) return null
  const list = rec[listKey] as unknown[]
  const next = filterArray(list, blocked)
  if (next === list) return rec
  const removed = list.length - next.length
  const out: AnyRecord = { ...rec, [listKey]: next }
  if ('total' in rec) out.total = decrementCounter(rec.total, removed)
  if ('count' in rec) out.count = decrementCounter(rec.count, removed)
  return out
}

// Карта «id → карточка» (`TravelsMap`, `api/map.ts:493,520`): значения — записи с id.
const isIdMap = (rec: AnyRecord): boolean => {
  const values = Object.values(rec)
  return values.length > 0 && values.every((value) => asRecord(value)?.id !== undefined)
}

/**
 * Универсальная коллекция: массив, конверт `{data|items|results, total|count}`,
 * бесконечный список `{pages, pageParams}` или карта по id. Неизвестная форма
 * возвращается как есть.
 */
export const stripCollection = (data: unknown, authorIdsOf: AuthorIdsOf, blockedIds: BlockedIds): unknown => {
  if (blockedIds.size === 0 || data == null) return data
  const blocked = isBlockedBy(authorIdsOf, blockedIds)
  if (Array.isArray(data)) return filterArray(data, blocked)
  const rec = asRecord(data)
  if (!rec) return data
  if (Array.isArray(rec.pages)) {
    let changed = false
    const pages = rec.pages.map((page) => {
      const next = stripCollection(page, authorIdsOf, blockedIds)
      if (next !== page) changed = true
      return next
    })
    return changed ? { ...rec, pages } : rec
  }
  const envelope = stripEnvelope(rec, blocked)
  if (envelope) return envelope
  if (!isIdMap(rec)) return rec
  const entries = Object.entries(rec)
  const kept = entries.filter(([, value]) => !blocked(value))
  return kept.length === entries.length ? rec : Object.fromEntries(kept)
}

const collectSubtreeIds = (node: TravelCommentTreeNode, into: Set<number>) => {
  into.add(node.id)
  ;(node.replies ?? []).forEach((reply) => collectSubtreeIds(reply, into))
}

const stripNodes = (
  nodes: TravelCommentTreeNode[],
  blocked: (item: unknown) => boolean,
  removedIds: Set<number>,
): TravelCommentTreeNode[] => {
  let changed = false
  const next: TravelCommentTreeNode[] = []
  for (const node of nodes) {
    // Ответ уходит вместе с заблокированным родителем: без него ветка теряет смысл.
    if (blocked(node)) {
      collectSubtreeIds(node, removedIds)
      changed = true
      continue
    }
    const replies = Array.isArray(node.replies) ? node.replies : []
    const nextReplies = stripNodes(replies, blocked, removedIds)
    if (nextReplies === replies) {
      next.push(node)
      continue
    }
    changed = true
    const removedDirect = replies.length - nextReplies.length
    next.push({
      ...node,
      replies: nextReplies,
      replies_count: Math.max(0, (node.replies_count ?? replies.length) - removedDirect),
    })
  }
  return changed ? next : nodes
}

const isCommentTree = (rec: AnyRecord): boolean => Array.isArray(rec.top_level)

/** Дерево комментариев (`commentKeys.travelTree`): узлы автора вместе с ответами, `flat` и счётчики. */
export const stripCommentTree = (data: unknown, blockedIds: BlockedIds): unknown => {
  const rec = asRecord(data)
  if (!rec || !isCommentTree(rec) || blockedIds.size === 0) return data
  const tree = rec as unknown as TravelCommentTree
  const blocked = isBlockedBy(commentAuthorIds, blockedIds)
  const removedIds = new Set<number>()
  const topLevel = stripNodes(tree.top_level, blocked, removedIds)
  const flat = Array.isArray(tree.flat)
    ? tree.flat.filter((comment: TravelComment) => !removedIds.has(comment.id) && !blocked(comment))
    : tree.flat
  const flatRemoved = Array.isArray(tree.flat) ? tree.flat.length - flat.length : 0
  if (topLevel === tree.top_level && flatRemoved === 0) return data
  const removedCount = Math.max(removedIds.size, flatRemoved)
  return {
    ...tree,
    top_level: topLevel,
    flat,
    total_count: Math.max(0, (tree.total_count ?? 0) - removedCount),
  }
}

/** Всё под `['comments']`: списки комментариев и дерево; треды и детали не трогаются. */
export const stripComments = (data: unknown, blockedIds: BlockedIds): unknown => {
  const rec = asRecord(data)
  if (rec && isCommentTree(rec)) return stripCommentTree(data, blockedIds)
  return Array.isArray(data) ? stripCollection(data, commentAuthorIds, blockedIds) : data
}
