// #2133 (Apple 1.2(c)): жалоба на любой пользовательский контент.
//
// Типы контента — ровно `REPORTABLE_CONTENT` бэка
// (`users/services/content_moderation_service.py`, #2129): новый тип UGC
// появляется здесь, и `Record<ContentType, …>` ниже не скомпилируется, пока
// для него не решено, как его называть и можно ли его скрыть. Полноту рендеров
// держит `scripts/guard-ugc-actions.js`.

export const CONTENT_TYPES = [
  'user',
  'travel',
  'travel_comment',
  'message',
  'trip_chat_message',
  'quest_review',
  'photo',
  'quest_review_photo',
  'trip',
  'trip_route_template',
  'trip_report',
] as const

export type ContentType = (typeof CONTENT_TYPES)[number]

/** Ссылка на объект жалобы. `author_id: null` — бэк не отдаёт автора (отзывы квестов до #2163). */
export type ContentRef = {
  content_type: ContentType
  object_id: number
  author_id: number | null
}

export type ContentSafetyPolicy = {
  /** Ключ i18n заголовка листа действий и подписи кнопки «…». */
  titleKey: string
  /**
   * Можно ли скрыть у себя один объект этого типа. Пункт «Скрыть» появляется
   * только у меню внутри `HiddenContentGate` (рендер ленты; `guard-ugc-actions`
   * требует обёртку у list-поверхностей): на детальной странице скрытый объект
   * остался бы на экране, поэтому там пункта нет.
   */
  hideable: boolean
}

export const CONTENT_SAFETY_POLICY: Readonly<Record<ContentType, ContentSafetyPolicy>> = {
  user: { titleKey: 'sharedStatic:contentSafety.title.user', hideable: false },
  travel: { titleKey: 'sharedStatic:contentSafety.title.travel', hideable: true },
  travel_comment: { titleKey: 'sharedStatic:contentSafety.title.comment', hideable: true },
  message: { titleKey: 'sharedStatic:contentSafety.title.message', hideable: true },
  trip_chat_message: { titleKey: 'sharedStatic:contentSafety.title.message', hideable: true },
  quest_review: { titleKey: 'sharedStatic:contentSafety.title.review', hideable: true },
  photo: { titleKey: 'sharedStatic:contentSafety.title.photo', hideable: false },
  quest_review_photo: { titleKey: 'sharedStatic:contentSafety.title.photo', hideable: false },
  trip: { titleKey: 'sharedStatic:contentSafety.title.trip', hideable: false },
  trip_route_template: { titleKey: 'sharedStatic:contentSafety.title.trip', hideable: false },
  trip_report: { titleKey: 'sharedStatic:contentSafety.title.trip', hideable: false },
}

/** Положительный целый id из числа или строки; иначе null. */
export const toContentId = (value: unknown): number | null => {
  const n = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== '' ? Number(value.trim()) : NaN
  return Number.isInteger(n) && n > 0 ? n : null
}

/** Ссылка из сырых id рендера; null — объект ещё не сохранён (оптимистичный) и жаловаться не на что. */
export const makeContentRef = (
  contentType: ContentType,
  objectId: unknown,
  authorId: unknown,
): ContentRef | null => {
  const id = toContentId(objectId)
  if (id === null) return null
  return { content_type: contentType, object_id: id, author_id: toContentId(authorId) }
}

export const contentRefKey = (ref: Pick<ContentRef, 'content_type' | 'object_id'>): string =>
  `${ref.content_type}:${ref.object_id}`
