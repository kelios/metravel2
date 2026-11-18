/* global module */
// #3237: дата, когда статью действительно правили по содержанию («Обновлено» и
// `dateModified`). ЕДИНСТВЕННОЕ место, где читается это поле.
//
// Контракт бэка #3240: GET /api/travels/<id>/ и by-slug отдают
// `content_updated_at` — ISO-8601 UTC или null. `updated_at` сюда НЕ подставлять:
// его двигают массовые служебные правки (у 133 из 434 статей одна дата 23.09.2026).
const CONTENT_UPDATED_AT_FIELD = 'content_updated_at'

const toIso = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

/** ISO-дата содержательной правки статьи; поля нет, null или невалидно — `null`. */
function readTravelContentUpdatedAt(travel) {
  if (!travel || typeof travel !== 'object') return null
  return toIso(travel[CONTENT_UPDATED_AT_FIELD])
}

/**
 * #3365: точная дата публикации. Оценочную (`published_at_estimated`) не читаем —
 * её когда-то скопировали из технического `updated_at` (#3344).
 */
function readExactPublishedAt(travel) {
  if (!travel || typeof travel !== 'object') return null
  if (travel.published_at_estimated === true) return null
  return toIso(travel.published_at)
}

function readCreatedAt(travel) {
  if (!travel || typeof travel !== 'object') return null
  const value = travel.created_at
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }
  return toIso(value)
}

/** Поздняя из валидных ISO-дат. При равенстве остаётся первая. */
function latestIso(...values) {
  let best = null
  let bestTime = -Infinity
  for (const value of values) {
    if (!value) continue
    const time = Date.parse(value)
    if (!Number.isFinite(time) || time <= bestTime) continue
    best = value
    bestTime = time
  }
  return best
}

/**
 * Даты Article JSON-LD, та же цепочка, что `lastmod` sitemap (#3344):
 * `datePublished` — только точный `published_at`;
 * `dateModified` — `latest(content_updated_at, точный published_at) or created_at`.
 */
function readTravelArticleDates(travel) {
  const datePublished = readExactPublishedAt(travel)
  const dateModified = latestIso(readTravelContentUpdatedAt(travel), datePublished) || readCreatedAt(travel)
  return { datePublished, dateModified }
}

module.exports = {
  CONTENT_UPDATED_AT_FIELD,
  readTravelContentUpdatedAt,
  readExactPublishedAt,
  readTravelArticleDates,
}
