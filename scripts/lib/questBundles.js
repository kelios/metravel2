/**
 * scripts/lib/questBundles.js
 * Единая загрузка бандлов квестов для аудит-скриптов (`quest-geocheck`,
 * `scan-quest-hint-leak`, …).
 *
 * До выделения каждый инструмент нёс свою копию «список квестов → бандл по
 * quest_id → массив шагов», и копии успели разойтись: одна обходила страницы
 * списка, другая читала только первую и на клампе `page_size` молча
 * отчиталась бы по неполной базе. Для инструмента, который существует ради
 * ответа «нарушений нет», неполный обход — это ложное зелёное, поэтому обход
 * страниц живёт здесь в одном экземпляре.
 *
 * Сеть идёт через `scripts/lib/fetchJson` — свип по всем квестам это ~140
 * последовательных прод-запросов, и один транзиентный 502/429 не должен
 * ронять весь прогон (#1394: у прод-nginx есть rate limit на `/api`).
 */

const path = require('path')

const { fetchJson } = require('./fetchJson')

const DEFAULT_USER_AGENT = 'metravel-quest-audit/1.0 (+https://metravel.by)'

/** Шаги бандла как есть: API отдаёт их массивом или JSON-строкой. Фильтрацию `is_intro` делает вызывающий. */
function parseSteps(bundle) {
  const raw = Array.isArray(bundle.steps) ? bundle.steps : JSON.parse(bundle.steps || '[]')
  return raw
}

/**
 * Строки каталога `/api/quests/` целиком. Список пагинируется (`{ data | results, next_page_url | next }`),
 * поэтому идём по страницам, а не берём первую: `page_size` на этом API кламится.
 */
async function fetchQuestCatalog(base, userAgent = DEFAULT_USER_AGENT) {
  const root = base.replace(/\/+$/, '')
  const rows = []
  const seen = new Set()
  let url = `${root}/api/quests/`
  while (url && !seen.has(url)) {
    seen.add(url)
    const page = await fetchJson(url, { userAgent })
    rows.push(...(Array.isArray(page) ? page : page.data || page.results || []))
    const next = Array.isArray(page) ? null : page.next_page_url || page.next || null
    url = next ? (next.startsWith('http') ? next : `${root}${next}`) : null
  }
  return rows
}

/** Все `quest_id` каталога — поверх `fetchQuestCatalog`. */
async function fetchAllQuestIds(base, userAgent = DEFAULT_USER_AGENT) {
  const rows = await fetchQuestCatalog(base, userAgent)
  return rows.filter((quest) => quest?.quest_id).map((quest) => quest.quest_id)
}

/** Бандлы квестов с API: один `questId` или весь каталог. */
async function fetchQuestBundles(apiUrl, questId, userAgent = DEFAULT_USER_AGENT) {
  const base = apiUrl.replace(/\/+$/, '')
  const ids = questId ? [questId] : await fetchAllQuestIds(base, userAgent)
  const bundles = []
  for (const id of ids) {
    bundles.push(await fetchJson(`${base}/api/quests/by-quest-id/${encodeURIComponent(id)}/`, { userAgent }))
  }
  return bundles
}

/**
 * Бандлы из локального `scripts/<city>-quest-data.js` — та же проверка ДО заливки.
 * Форма совпадает с тем, что отдаёт `fetchQuestBundles`; `is_intro` не фильтруется.
 *
 * `intro` и `finale` проносятся отдельными ключами, ровно как их отдаёт
 * `GET /api/quests/by-quest-id/{id}/`: интро НЕ лежит внутри `steps` ни в API, ни
 * в локальном файле. Скан, который обходит только `steps`, интро не видит и
 * молча отчитывается «чисто» — на этом поймана первая редакция
 * `scan-quest-mixed-script-text.js` (#1464).
 */
function loadLocalBundles(sourceFile, questId) {
  const data = require(path.resolve(process.cwd(), sourceFile))
  const quests = Array.isArray(data) ? data : [data]
  const picked = questId ? quests.filter((q) => q?.quest_id === questId) : quests
  if (questId && picked.length === 0) {
    throw new Error(`quest_id "${questId}" not found in ${sourceFile}`)
  }
  return picked.map((quest) => ({
    id: quest.id ?? null,
    quest_id: quest.quest_id,
    title: quest.title,
    city: quest.city,
    intro: quest.intro ?? null,
    finale: quest.finale ?? null,
    steps: quest.steps || [],
  }))
}

module.exports = {
  DEFAULT_USER_AGENT,
  fetchAllQuestIds,
  fetchQuestBundles,
  fetchQuestCatalog,
  loadLocalBundles,
  parseSteps,
}
