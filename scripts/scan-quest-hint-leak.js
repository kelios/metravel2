#!/usr/bin/env node
/**
 * Скан утечки ответа в подсказку шага квеста — правило авторинга 4a
 * (`.claude/skills/metravel-quest/SKILL.md`): `hint` говорит КУДА смотреть, но
 * не содержит сам ответ и не называет точное число ответа.
 *
 * Правило живёт с #1190, но три прохода подряд (#1190, #1445, #1447) его
 * проверяли глазами — и каждый раз что-то проходило мимо. Этот скрипт закрывает
 * ровно механическую часть: буквальное совпадение принимаемого ответа с текстом
 * подсказки. Семантический класс (подсказка пересказывает ответ определением,
 * без совпадения слова — кейсы #1445) скан НЕ ловит, см. запись
 * QUEST-HINT-LEAK-001 в docs/PROBLEM_MEMORY.md.
 *
 *   node scripts/scan-quest-hint-leak.js                      # весь прод
 *   node scripts/scan-quest-hint-leak.js --quest-id=vienna-imperial-secrets
 *   node scripts/scan-quest-hint-leak.js --source=scripts/vienna-quest-data.js
 *   node scripts/scan-quest-hint-leak.js --fields=hint,story,title
 *   node scripts/scan-quest-hint-leak.js --json
 *
 * Exit code 1, если найдена хотя бы одна утечка.
 */

const path = require('path')

const DEFAULT_API = process.env.METRAVEL_API_URL || 'https://metravel.by'
const USER_AGENT = 'metravel-hint-leak-scan/1.0'

// Поля шага, в которых ищем ответ. По умолчанию только `hint`: это тот контур,
// который правило 4a требует держать чистым безусловно. `title`/`story` шумят
// закономерно — шаг «Кривая башня» с вопросом «как называется башня» попадает в
// совпадение, оставаясь корректным, — поэтому включаются только флагом и в
// gate не входят.
const DEFAULT_FIELDS = ['hint']
const KNOWN_FIELDS = new Set(['hint', 'story', 'title', 'task'])

// Словарные типы: у них есть закрытый список принимаемых строк.
const DICT_TYPES = new Set(['exact_any', 'exact'])
// Числовые типы: утечка — это точное число (или любое число из диапазона)
// в тексте подсказки, запрет «их от 3 до 5» из того же правила 4a.
const NUMERIC_RANGE_TYPE = 'range'

// Короткие строки дают ложные срабатывания подстрокой («ум» внутри «думай»).
// На всей базе (912 шагов с непустым hint) порог 3 даёт ноль ложных
// срабатываний по `hint` и находит все три известных кейса #1447.
const MIN_VALUE_LENGTH = 3

/** Нормализация как в `utils/questAdapters.normalize` — сравниваем ровно так же, как сервер засчитывает ответ. */
function normalize(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?'„""–—-]/g, '')
    .replace(/ё/g, 'е')
    .trim()
}

/** Строки-ответы шага. Свободные типы (`any`, `any_text`, `any_number`) словаря не имеют. */
function dictionaryValues(answerPattern) {
  if (!answerPattern || !DICT_TYPES.has(answerPattern.type)) return []
  const raw = answerPattern.value
  if (answerPattern.type === 'exact') return [String(raw ?? '')]
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : []
  } catch {
    return []
  }
}

/** Числа-ответы шага: точное `exact` числом и весь диапазон `range` целиком. */
function numericValues(answerPattern) {
  if (!answerPattern) return []
  if (answerPattern.type === 'exact') {
    const text = String(answerPattern.value ?? '').trim()
    return /^\d+$/.test(text) ? [Number(text)] : []
  }
  if (answerPattern.type !== NUMERIC_RANGE_TYPE) return []
  try {
    const { min, max } = JSON.parse(answerPattern.value)
    if (!Number.isFinite(Number(min)) || !Number.isFinite(Number(max))) return []
    const out = []
    for (let n = Number(min); n <= Number(max); n++) out.push(n)
    return out
  } catch {
    return []
  }
}

/**
 * Утечки одного шага по одному полю.
 * Совпадение ищем подстрокой, а не по границе слова: ответ «вал» утекает через
 * «перед валом», и словоформа — та же утечка, что и точное слово.
 */
function findLeaks(step, field) {
  const text = normalize(step[field])
  if (!text) return []

  const leaks = dictionaryValues(step.answer_pattern)
    .filter((value) => {
      const needle = normalize(value)
      return needle.length >= MIN_VALUE_LENGTH && text.includes(needle)
    })
    .map((value) => ({ kind: 'dictionary', value }))

  const rawText = String(step[field] ?? '')
  for (const n of numericValues(step.answer_pattern)) {
    if (new RegExp(`(?<!\\d)${n}(?!\\d)`).test(rawText)) leaks.push({ kind: 'numeric', value: String(n) })
  }
  return leaks
}

function scanQuests(quests, fields) {
  const findings = []
  let scannedSteps = 0
  for (const quest of quests) {
    for (const step of quest.steps || []) {
      if (step.is_intro) continue
      scannedSteps++
      for (const field of fields) {
        const leaks = findLeaks(step, field)
        if (!leaks.length) continue
        findings.push({
          quest_db_id: quest.id ?? null,
          quest_id: quest.quest_id,
          step_db_id: step.id ?? null,
          step_id: step.step_id,
          field,
          answer_type: step.answer_pattern?.type ?? null,
          leaks,
          text: String(step[field] ?? ''),
        })
      }
    }
  }
  return { findings, scannedSteps }
}

// ===================== Источники данных =====================

// Скан обходит все 139 квестов по одному запросу на квест, поэтому попадает в
// окно прод-деплоя (swap статики + рестарт даёт короткий 502). Без ретрая
// падает весь прогон из-за одного шага — и «утечек нет» никто не увидит.
async function fetchJson(url, attempt = 1) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  const text = await response.text()
  if (!response.ok) {
    if (response.status >= 500 && attempt < 4) {
      await new Promise((r) => setTimeout(r, attempt * 2000))
      return fetchJson(url, attempt + 1)
    }
    throw new Error(`${response.status} ${url}: ${text.slice(0, 200)}`)
  }
  return JSON.parse(text)
}

function parseSteps(bundle) {
  const raw = Array.isArray(bundle.steps) ? bundle.steps : JSON.parse(bundle.steps || '[]')
  return raw
}

async function loadFromApi(apiUrl, questId) {
  const base = apiUrl.replace(/\/+$/, '')
  const ids = questId
    ? [questId]
    : (await fetchJson(`${base}/api/quests/?page_size=500`)).results.map((q) => q.quest_id)

  const quests = []
  for (const id of ids) {
    const bundle = await fetchJson(`${base}/api/quests/by-quest-id/${encodeURIComponent(id)}/`)
    quests.push({ id: bundle.id, quest_id: bundle.quest_id, steps: parseSteps(bundle) })
  }
  return quests
}

/**
 * Локальный `scripts/<city>-quest-data.js` — та же проверка ДО заливки.
 * В локальных данных `answer_pattern` уже объект, а не строка, поэтому форма
 * совпадает с API и приводить ничего не нужно.
 */
function loadFromSource(sourceFile, questId) {
  const data = require(path.resolve(process.cwd(), sourceFile))
  const quests = Array.isArray(data) ? data : [data]
  const picked = questId ? quests.filter((q) => q?.quest_id === questId) : quests
  if (questId && !picked.length) throw new Error(`quest_id "${questId}" не найден в ${sourceFile}`)
  return picked.map((quest) => ({ id: null, quest_id: quest.quest_id, steps: quest.steps || [] }))
}

// ===================== CLI =====================

function parseArgs(argv) {
  const get = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
  const fields = (get('fields') || DEFAULT_FIELDS.join(',')).split(',').map((f) => f.trim()).filter(Boolean)
  for (const field of fields) {
    if (!KNOWN_FIELDS.has(field)) throw new Error(`неизвестное поле --fields=${field}`)
  }
  return {
    apiUrl: get('api-url') || DEFAULT_API,
    questId: get('quest-id') || null,
    source: get('source') || null,
    fields,
    json: argv.includes('--json'),
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const quests = args.source
    ? loadFromSource(args.source, args.questId)
    : await loadFromApi(args.apiUrl, args.questId)

  const { findings, scannedSteps } = scanQuests(quests, args.fields)
  const source = args.source || args.apiUrl

  if (args.json) {
    console.log(JSON.stringify({ source, quests: quests.length, scannedSteps, fields: args.fields, findings }, null, 2))
  } else {
    console.log(`Скан 4a: ${source} — ${quests.length} квестов, ${scannedSteps} шагов, поля: ${args.fields.join(', ')}`)
    for (const f of findings) {
      const values = f.leaks.map((l) => `${l.value}${l.kind === 'numeric' ? ' (число)' : ''}`).join(', ')
      console.log(`\n  [quest ${f.quest_db_id ?? '?'}] ${f.quest_id} / шаг ${f.step_db_id ?? '?'} ${f.step_id}`)
      console.log(`    поле ${f.field} (${f.answer_type}) содержит ответ: ${values}`)
      console.log(`    ${f.text}`)
    }
    console.log(findings.length ? `\nУтечек: ${findings.length}` : '\nУтечек нет.')
  }

  if (findings.length) process.exitCode = 1
}

module.exports = { normalize, dictionaryValues, numericValues, findLeaks, scanQuests }

if (require.main === module) {
  main().catch((e) => {
    console.error('Fatal:', e.message || e)
    process.exit(1)
  })
}
