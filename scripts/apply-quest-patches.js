#!/usr/bin/env node
/**
 * Применяет патчи квест-контента (.quest-audit/patches-*.json) на прод.
 * Формат патча ШАГА:   {quest_id, step_db_id, step_id, changes:{task?,hint?,answer_pattern?,lat?,lng?,maps_url?,story?}}
 * Формат патча КВЕСТА: {quest_id, quest_db_id, changes:{title}}
 * Куда идёт PATCH, решает ключ: `step_db_id` → /api/quest-steps/<id>/,
 * `quest_db_id` → /api/quests/<id>/. Заголовок квеста живёт не в шаге, и без
 * второго маршрута его правили бы мимо этого инструмента, то есть без
 * валидации и без единого лога правок (#1540).
 *
 * node scripts/apply-quest-patches.js --dry-run .quest-audit/patches-*.json
 * node scripts/apply-quest-patches.js .quest-audit/patches-by-west.json
 * Токен: --token=, env METRAVEL_TOKEN или ~/.metravel_token
 */

const fs = require('fs')
const os = require('os')
const path = require('path')

const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const apiUrlArg = args.find((a) => a.startsWith('--api-url='))
const tokenArg = args.find((a) => a.startsWith('--token='))
const API = apiUrlArg ? apiUrlArg.split('=')[1] : 'https://metravel.by'
const files = args.filter((a) => !a.startsWith('--'))

if (!files.length) {
  console.error('Укажи патч-файлы: node scripts/apply-quest-patches.js [--dry-run] <files...>')
  process.exit(1)
}

function resolveToken() {
  if (tokenArg) return tokenArg.split('=').slice(1).join('=')
  if (process.env.METRAVEL_TOKEN) return process.env.METRAVEL_TOKEN
  try {
    const p = path.join(os.homedir(), '.metravel_token')
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim()
  } catch {
    /* ignore */
  }
  return null
}
const TOKEN = resolveToken()
if (!TOKEN && !isDryRun) {
  console.error('Нужен токен: --token=, env METRAVEL_TOKEN или ~/.metravel_token')
  process.exit(1)
}

// `location` правится вместе с `task`: подпись места видна игроку на карточке
// шага (`components/quests/questWizardStepCard.tsx`) и потому способна выдать
// ответ не хуже подсказки — «Скульптура музыканта с собакой» при вопросе про
// животное рядом с музыкантом (#1453).
// `title` — по той же причине: заголовок шага виден игроку на карточке, и
// механическая опечатка в нём (подменённая буква чужого алфавита, #1464)
// правится тем же путём, что и остальной видимый текст.
const ALLOWED = new Set(['task', 'hint', 'answer_pattern', 'lat', 'lng', 'maps_url', 'story', 'location', 'title', 'order', 'input_type'])
// Поля уровня КВЕСТА. Список узкий сознательно: обложка, город, статус и
// координаты квеста принадлежат migrate-/upload-скриптам, а этому инструменту
// нужен ровно редакционный текст. `title` попал сюда потому, что заголовок
// игрок читает раньше всего остального текста квеста — в каталоге, в шапке
// визарда и в мета-описании страницы, — и правило 4a на него распространяется
// так же, как на подсказку (#1540).
const QUEST_ALLOWED = new Set(['title'])
const TYPES = new Set(['any', 'exact', 'exact_any', 'range', 'any_text', 'any_number', 'approx'])
// Клавиатуру шага выбирает фронт по типу ответа, но колонка input_type в БД
// остаётся источником правды для админки и механического аудита (класс B —
// рассогласование input_type и типа паттерна), поэтому её тоже надо уметь чинить.
const INPUT_TYPES = new Set(['text', 'number'])

/** Патч уровня квеста: только разрешённые поля и непустой текст. */
function validateQuest(p, file) {
  const payload = {}
  for (const [k, v] of Object.entries(p.changes || {})) {
    if (!QUEST_ALLOWED.has(k)) throw new Error(`${file} ${p.quest_id}: запрещённое поле квеста ${k}`)
    if (typeof v !== 'string' || !v.trim()) throw new Error(`${file} ${p.quest_id}: пустое ${k}`)
    payload[k] = v
  }
  if (!Object.keys(payload).length) throw new Error(`${file} ${p.quest_id}: пустые changes`)
  return payload
}

function validateStep(p, file) {
  const payload = {}
  for (const [k, v] of Object.entries(p.changes || {})) {
    if (!ALLOWED.has(k)) throw new Error(`${file} ${p.step_id}: запрещённое поле ${k}`)
    payload[k] = v
  }
  if (!Object.keys(payload).length) throw new Error(`${file} ${p.step_id}: пустые changes`)
  if (payload.answer_pattern !== undefined) {
    const ap = JSON.parse(payload.answer_pattern)
    if (!TYPES.has(ap.type)) throw new Error(`${file} ${p.step_id}: неизвестный type ${ap.type}`)
    if (['exact_any', 'range', 'any_text', 'approx'].includes(ap.type)) JSON.parse(ap.value)
  }
  if (payload.input_type !== undefined && !INPUT_TYPES.has(payload.input_type)) {
    throw new Error(`${file} ${p.step_id}: неизвестный input_type ${payload.input_type}`)
  }
  for (const k of ['lat', 'lng']) {
    if (payload[k] !== undefined && !Number.isFinite(Number(payload[k])))
      throw new Error(`${file} ${p.step_id}: кривое ${k}=${payload[k]}`)
  }
  return payload
}

/** Куда и чем патчить: шаг или сам квест. */
function validate(p, file) {
  if (p.step_db_id) {
    return {
      endpoint: `/api/quest-steps/${p.step_db_id}/`,
      payload: validateStep(p, file),
      label: `${p.quest_id}/${p.step_id} (шаг ${p.step_db_id})`,
    }
  }
  if (p.quest_db_id) {
    return {
      endpoint: `/api/quests/${p.quest_db_id}/`,
      payload: validateQuest(p, file),
      label: `${p.quest_id} (квест ${p.quest_db_id})`,
    }
  }
  throw new Error(`${file} ${p.quest_id}: нет ни step_db_id, ни quest_db_id`)
}

async function apiPatch(endpoint, payload) {
  if (isDryRun) {
    console.log(`  [DRY] PATCH ${endpoint}`, Object.keys(payload).join(','))
    return {}
  }
  const r = await fetch(`${API}${endpoint}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Token ${TOKEN}` },
    body: JSON.stringify(payload),
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`PATCH ${endpoint}: HTTP ${r.status} ${t.slice(0, 300)}`)
  }
  return r.json()
}

async function main() {
  let ok = 0
  let failed = 0
  for (const file of files) {
    const patches = JSON.parse(fs.readFileSync(file, 'utf8'))
    console.log(`\n=== ${file}: ${patches.length} патчей`)
    for (const p of patches) {
      try {
        const { endpoint, payload, label } = validate(p, file)
        await apiPatch(endpoint, payload)
        console.log(`  OK ${label}: ${Object.keys(payload).join(', ')}`)
        ok++
      } catch (e) {
        console.error(`  FAIL ${p.quest_id}/${p.step_id ?? 'quest'}: ${e.message}`)
        failed++
      }
    }
  }
  console.log(`\nИтого: OK ${ok}, FAIL ${failed} (${isDryRun ? 'DRY RUN' : 'LIVE'})`)
  if (failed) process.exitCode = 1
}

main().catch((e) => {
  console.error('Fatal:', e.message || e)
  process.exit(1)
})
