'use strict'

/**
 * #2908: сверка «GA4 видит публикации» с каталогом API.
 *
 * `travel_publish` — момент, когда автор отправил маршрут на модерацию, и он
 * доходит до GA4 только при согласии на аналитику. `published_at` в API —
 * одобрение модератором. Поэтому сверка грубая: тревога только когда за окно
 * есть заметное число публикаций НЕ владельца, а событий нет совсем.
 *
 * Массовые операции (проставление `published_at` пачкой, 04.08.2026 — 66 строк
 * в одну дату) действиями авторов не являются и в счёт не идут.
 */

// Владелец и разбор авторов — тот же, что в `stats:summary`, чтобы отчёты не расходились.
const { authorIds } = require('./metrics-summary')

const OWNER_USER_ID = '1'
const DEFAULT_WINDOW_DAYS = 30
const BULK_DAY_THRESHOLD = 10
const MIN_PUBLICATIONS_FOR_ALERT = 3

/**
 * @param {Array<object>} travels — строки `/api/travels/` (publish=1, moderation=1)
 * @param {{ startDate: string, endDate: string }} window — YYYY-MM-DD включительно
 */
function countAuthorPublications(travels, { startDate, endDate }) {
  const byDay = new Map()
  for (const travel of travels) {
    const day = typeof travel?.published_at === 'string' ? travel.published_at.slice(0, 10) : ''
    if (!day || day < startDate || day > endDate) continue
    const ids = authorIds(travel)
    if (!ids.length || ids.includes(OWNER_USER_ID)) continue
    byDay.set(day, (byDay.get(day) || 0) + 1)
  }
  let count = 0
  const bulkDays = []
  for (const [day, n] of [...byDay.entries()].sort()) {
    if (n >= BULK_DAY_THRESHOLD) bulkDays.push({ day, count: n })
    else count += n
  }
  return { count, bulkDays }
}

/**
 * @returns {string|null} текст тревоги или null
 */
function buildPublishFunnelAlert({ gaPublishEvents, gaPublishAttempts, apiPublications, windowDays }) {
  if (!Number.isFinite(apiPublications) || apiPublications < MIN_PUBLICATIONS_FOR_ALERT) return null
  if (gaPublishEvents > 0 || gaPublishAttempts > 0) return null
  return `GA4 travel_publish = 0 and route_create_publish_attempt = 0 for ${windowDays} days, ` +
    `while the API has ${apiPublications} approved non-owner publications — ` +
    'check the publish emitters and consent share (docs/features/analytics-events.md)'
}

module.exports = {
  DEFAULT_WINDOW_DAYS,
  BULK_DAY_THRESHOLD,
  MIN_PUBLICATIONS_FOR_ALERT,
  countAuthorPublications,
  buildPublishFunnelAlert,
}
