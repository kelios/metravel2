/* global module */
// #3237: адрес профиля автора статьи — один для ссылки на странице и для
// `author.url` в JSON-LD. Источник — `user.id` / `userIds` из ответа API статьи;
// нет положительного целого id — ссылки нет (ничего не выдумываем).
const SITE_URL = 'https://metravel.by'

function resolveTravelAuthorId(travel) {
  const raw = travel?.userIds
  const first = Array.isArray(raw)
    ? raw[0]
    : typeof raw === 'string'
      ? raw.split(',').map((value) => value.trim()).find(Boolean)
      : raw
  const candidate = first ?? travel?.userId ?? travel?.user?.id ?? null
  const id = Number(candidate)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/** `/user/<id>` автора статьи либо `null`. */
function travelAuthorProfilePath(travel) {
  const id = resolveTravelAuthorId(travel)
  return id === null ? null : `/user/${id}`
}

/** Абсолютный адрес профиля для разметки либо `null`. */
function travelAuthorProfileUrl(travel) {
  const path = travelAuthorProfilePath(travel)
  return path === null ? null : `${SITE_URL}${path}`
}

module.exports = { resolveTravelAuthorId, travelAuthorProfilePath, travelAuthorProfileUrl }
