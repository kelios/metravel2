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

module.exports = { CONTENT_UPDATED_AT_FIELD, readTravelContentUpdatedAt }
