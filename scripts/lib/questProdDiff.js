/**
 * scripts/lib/questProdDiff.js
 * Сравнение локального data-файла квеста с тем, что стоит на проде (#1554).
 *
 * Одна копия правил на два инструмента: `scan-quest-prod-drift.js` только
 * докладывает о расхождении, `sync-quest-data-from-prod.js` его устраняет. Разъедься
 * их представления о том, что считать расхождением, — и скан начнёт отчитываться
 * «чисто» о файле, который синхронизатор считает разошедшимся, либо наоборот:
 * гейт будет вечно красным на полях, которые никто не собирается переносить.
 */

const DEFAULT_API = process.env.METRAVEL_API_URL || 'https://metravel.by'

/**
 * Поля шага, которые считаются контентом и обязаны совпадать.
 *
 * Список ведётся не «по важности поля», а по тому, что реально уезжает на прод:
 * это ровно набор из `stepPayload` в `scripts/sync-quest-to-prod.js:60-71`.
 * `poi_info` здесь именно поэтому — заливка шлёт его, когда он есть в файле
 * (`sync-quest-to-prod.js:69-70`), значит устаревший `poi_info` так же способен
 * откатить прод, как устаревший текст задания.
 *
 * `maps_url` СОЗНАТЕЛЬНО не здесь: бэкенд генерирует его сам из координат
 * (`https://maps.google.com/?q=<lat>,<lng>`), в локальных файлах его нет вовсе
 * либо он записан под другим именем (`mapsUrl`). Без этого исключения дрейф
 * показывали все 156 файло-квестов подряд — то есть отчёт состоял бы из шума и
 * прятал 68 настоящих расхождений.
 */
const comparableFields = Object.freeze(['title', 'location', 'story', 'task', 'hint', 'answer_pattern', 'lat', 'lng', 'poi_info'])

/** Сравнимая форма значения: разное представление одного и того же не должно считаться дрейфом. */
function normalizeField(field, value) {
  if (value == null || value === '') return null
  if (field === 'answer_pattern') {
    const ap = typeof value === 'string' ? safeParse(value) : value
    if (!ap) return String(value)
    // Оба уровня разбираются: локально `value` бывает готовым массивом, с API — строкой.
    const inner = typeof ap.value === 'string' ? safeParse(ap.value) ?? ap.value : ap.value
    return JSON.stringify({ type: ap.type, value: inner })
  }
  // Объект сравниваем по содержимому, а не по порядку ключей: локальный литерал
  // и JSON с API перечисляют их в разном порядке, и это не расхождение.
  if (field === 'poi_info') {
    const obj = typeof value === 'string' ? safeParse(value) : value
    if (!obj || typeof obj !== 'object') return String(value)
    const entries = Object.entries(obj).filter(([, v]) => v != null && v !== '').sort(([a], [b]) => (a < b ? -1 : 1))
    return entries.length ? JSON.stringify(entries) : null
  }
  // Координаты: локально число, с API строка `"53.903400"`. Шесть знаков — точность БД.
  if (field === 'lat' || field === 'lng') {
    const n = Number(value)
    return Number.isFinite(n) ? n.toFixed(6) : String(value)
  }
  return String(value)
}

function safeParse(s) { try { return JSON.parse(s) } catch { return null } }

/**
 * Поля шага, которые разошлись.
 *
 * `poi_info` сравнивается ТОЛЬКО когда он есть в локальном файле, и это не
 * послабление, а точное повторение заливки: `sync-quest-to-prod.js:69-70`
 * кладёт поле в payload лишь при `poiInfo !== undefined`, то есть отсутствие
 * `poi_info` в файле прод не трогает. Без этого условия сверка показывала 92
 * «расхождения» в 38 квестах, из которых ни одно не могло откатить прод, —
 * ровно тот шум, из-за которого пришлось исключать `maps_url`.
 */
function diffStep(local, prod) {
  return comparableFields.filter((field) => {
    if (field === 'poi_info' && local[field] === undefined && local.poiInfo === undefined) return false
    return normalizeField(field, local[field]) !== normalizeField(field, prod[field])
  })
}

/**
 * Расхождения уровня квеста — интро и финал.
 *
 * Сравнивается не «одинаковые ключи», а то, что реально способно уехать на прод.
 * Для финала это ровно один текст, и локально он записан то как `text`, то как
 * `story` — историческая развилка форм (`{title, story}` в старых файлах,
 * `{text}` в новых). Заливка эту развилку уже знает:
 * `scripts/sync-quest-to-prod.js:114` берёт `q.finale.text || q.finale.story`.
 * Сверка обязана читать поле так же, иначе выходит худший вариант: первая
 * редакция сравнивала только одноимённые ключи, поэтому у четырёх квестов с
 * формой `{title, story}` текст финала не сравнивался ВООБЩЕ — а заливка его при
 * этом переносила.
 *
 * Локальные ключи, которых нет в модели прода (`title` у финала), расхождением
 * не считаются: заливка их не отправляет, откатить прод они не могут. Служебные
 * поля прода (`id`, `order`, `is_intro`, `input_type`, `country_code`,
 * `geo_verify`, `maps_url`, `video_url`, `poster_url`, `poster_media`) — тем
 * более: их бэкенд проставляет сам. Сравнение по всем ключам подряд давало
 * «расхождение формы» на всех 152 квестах, то есть отчёт из одного шума.
 */
const QUEST_LEVEL_CONTENT_KEYS = new Set(['title', 'location', 'story', 'task', 'hint', 'answer_pattern'])

/** Текст финала так, как его видит заливка. */
function finaleText(section) {
  if (!section) return null
  return section.text || section.story || null
}

function diffQuestLevel(quest, bundle) {
  const rows = []

  const localFinale = finaleText(quest.finale)
  const prodFinale = finaleText(parseSection(bundle.finale))
  if (localFinale && prodFinale && normalizeField('text', localFinale) !== normalizeField('text', prodFinale)) {
    rows.push({ scope: 'finale', field: 'text', local: localFinale, prod: prodFinale })
  }

  const localIntro = quest.intro
  const prodIntro = parseSection(bundle.intro)
  if (localIntro && prodIntro) {
    // Обход ОБЪЕДИНЕНИЯ ключей, а не только локальных. Поле, которое есть на
    // проде и отсутствует в файле, — не «нечего сравнивать», а самый опасный
    // случай: `sync-quest-to-prod.js:88` шлёт `hint: q.intro.hint || null`, то
    // есть отсутствующая локально подсказка ЗАТИРАЕТ подсказку на проде. Ровно
    // эту ошибку пришлось чинить выше для финала; здесь она повторялась.
    for (const field of new Set([...Object.keys(localIntro), ...Object.keys(prodIntro)])) {
      if (!QUEST_LEVEL_CONTENT_KEYS.has(field)) continue
      if (typeof localIntro[field] === 'object' || typeof prodIntro[field] === 'object') continue
      if (normalizeField(field, localIntro[field]) !== normalizeField(field, prodIntro[field])) {
        rows.push({ scope: 'intro', field, local: localIntro[field], prod: prodIntro[field] })
      }
    }
  }
  return rows
}

function parseSection(value) {
  if (!value) return null
  if (typeof value === 'string') return safeParse(value)
  return value
}

/**
 * Полное сравнение одного локального квеста с прод-бандлом.
 *
 * Ни `onlyProd`, ни `onlyLocal` дефектом не являются, и это проверено по коду
 * заливки, а не предположено: `sync-quest-to-prod.js:107` шаг, которого нет на
 * проде, ПРОПУСКАЕТ («структура не совпадает»), а шаг, которого нет в файле,
 * она и не перебирает. Создают шаги только `migrate-*-quest.js`. Обе величины
 * поэтому идут в отчёт как расхождение структуры, а гейт валят расхождения
 * ПОЛЕЙ — то, что заливка действительно перенесёт.
 */
function diffQuest(quest, bundle, prodSteps) {
  const prodById = new Map(prodSteps.map((s) => [s.step_id, s]))
  const localIds = new Set((quest.steps || []).map((s) => s.step_id))
  const changed = []
  for (const step of quest.steps || []) {
    const prod = prodById.get(step.step_id)
    if (!prod) continue
    const fields = diffStep(step, prod)
    if (fields.length) changed.push({ step_id: step.step_id, prod_db_id: prod.id ?? null, fields })
  }
  return {
    quest_id: quest.quest_id,
    local_steps: (quest.steps || []).length,
    prod_steps: prodSteps.length,
    onlyLocal: (quest.steps || []).map((s) => s.step_id).filter((id) => !prodById.has(id)),
    onlyProd: [...prodById.keys()].filter((id) => !localIds.has(id)),
    changed,
    questLevel: diffQuestLevel(quest, bundle),
  }
}

module.exports = {
  DEFAULT_API,
  comparableFields,
  normalizeField,
  diffStep,
  diffQuest,
  diffQuestLevel,
  finaleText,
  QUEST_LEVEL_CONTENT_KEYS,
}
