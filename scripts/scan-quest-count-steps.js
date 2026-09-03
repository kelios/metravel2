#!/usr/bin/env node
/**
 * Скан счётного шага без границы счёта — правило авторинга 4b
 * (`.claude/skills/metravel-quest/SKILL.md`): у счётного задания эталон это ОДНО
 * число, а мягкий `range` ±1 допустим только при n≥3 и только когда граница
 * счёта названа в тексте ЗАДАНИЯ.
 *
 * Доказанный кейс #1718: `minsk-teens-oktyabrskaya / 9-amigos` спрашивал
 * «сколько жёлтых персонажей на стене» при `range {min:2,max:4}`. Границы счёта
 * задание не задавало вовсе (фигуры Speto, мелкие фигуры, соседние стены), и
 * игрок, честно насчитавший у стены 6, перебрал 5, 7, 8 и прошёл шаг числом 3 —
 * то есть задание засчитало ответ, которого игрок не видел. Диапазон из трёх
 * мелких целых перебирается за секунды: кулдауна на неверный ответ в движке нет.
 *
 * Что скан ловит и чего НЕ ловит. Механическая часть — «широкий диапазон при
 * счёте, и в задании не сказано, что именно считать». Верен ли сам эталон, скан
 * не знает и знать не может: это решается двумя независимыми источниками на
 * число (правило 4b). Поэтому находка — это не дефект, а шаг, который обязан
 * иметь вердикт: либо сузить эталон до одного числа, либо назвать границу
 * счёта в задании, либо записать обоснование в allow-файл.
 *
 * Граница счёта ищется в `task`, а не в `hint`, и это не придирка: подсказка
 * открывается только после ДВУХ неверных попыток, то есть к моменту, когда
 * игрок уже дважды не угадал, что именно считать. Ровно так и было устроено
 * большинство шагов свипа #1718 — граница лежала в подсказке и работала слишком
 * поздно.
 *
 *   node scripts/scan-quest-count-steps.js                          # весь прод
 *   node scripts/scan-quest-count-steps.js --quest-id=minsk-teens-oktyabrskaya
 *   node scripts/scan-quest-count-steps.js --source=scripts/paris-quest-data.js
 *   node scripts/scan-quest-count-steps.js --no-allow-file          # без вычитания
 *   node scripts/scan-quest-count-steps.js --json
 *
 * Exit code 1, если найден хотя бы один неразобранный шаг.
 */

const path = require('path')

const { fetchQuestBundles, loadLocalBundles, parseSteps } = require('./lib/questBundles')
// Baseline — общий с другими аудит-сканами квестов механизм (#1450, #1488).
const { loadBaseline, splitByBaseline } = require('./lib/scanBaseline')

const DEFAULT_API = process.env.METRAVEL_API_URL || 'https://metravel.by'

/**
 * Allow-файл ключуется парой `quest_id|step_id`, а НЕ именем файла-источника,
 * как baseline скана утечки. Причина в природе вердикта: «этот счёт оставлен,
 * потому что число двумя источниками не сверялось» — это свойство шага, а не
 * файла, и оно обязано читаться одинаково при прогоне по проду
 * (`--quest-id=`) и по локальным данным (`--source=`). Ключ по источнику
 * склеил бы все прод-находки под одним ключом `https://metravel.by`.
 *
 * Значение ключа — сам текст обоснования: вердикт живёт рядом с шагом, а не в
 * отдельном документе, который разъедется с файлом при следующей волне.
 */
const ALLOW_PATH = 'scripts/quest-count-steps-allow.json'
const ALLOW_CONTRACT_VERSION = 1

// ===================== Критерий отбора =====================

/**
 * Счётное задание. `скольк` — основная форма («сколько их?»), но задание часто
 * формулируют императивом без вопросительного слова («Обойди и сосчитай
 * колонны»), и такой шаг ничем не отличается по риску.
 */
const COUNT_TASK_RE = /скольк|сосчита|посчита|пересчита|сочти/iu

/** Типы ответа, которые принимают диапазон чисел. */
const COUNT_TYPES = new Set(['range', 'any_number'])

/**
 * Ширина принимаемого диапазона. Порог «span ≥ 2» — это ровно три и более
 * подряд идущих целых: `2..4`, `3..5`, `4..6`. Мягкий `range` ±1 вокруг
 * верного числа даёт как раз span 2, поэтому сам по себе span 2 не дефект —
 * дефектом его делает отсутствие границы счёта в задании. `5..6` и `2..3`
 * (span 1) ниже порога: там перебор упирается в два варианта, и правило 4b их
 * не трогает.
 *
 * `any_number` принимает ЛЮБОЕ число, то есть эталона у шага нет вовсе;
 * ширина бесконечна.
 */
function answerSpan(answerPattern) {
  if (!answerPattern || !COUNT_TYPES.has(answerPattern.type)) return null
  if (answerPattern.type === 'any_number') return Infinity
  try {
    const { min, max } = JSON.parse(answerPattern.value)
    if (!Number.isFinite(Number(min)) || !Number.isFinite(Number(max))) return null
    return Number(max) - Number(min)
  } catch {
    return null
  }
}

/**
 * Маркеры границы счёта. Это не «красивые слова», а формулы, которыми в этой
 * базе реально отсекают лишнее: что считать, что не считать и где кончается
 * объект счёта.
 *
 * Список подобран по 42 счётным шагам свипа #1718 и намеренно узкий: маркер
 * должен ОТСЕКАТЬ, а не просто уточнять. Поэтому здесь нет «обойди кругом» и
 * «отойди подальше» — это указание, откуда смотреть, и оно не отвечает на
 * вопрос «что идёт в счёт».
 */
const BOUNDARY_MARKERS = [
  'только',
  'лишь',
  'не счита', // не считай / не считаем / не считая
  'в счёт не',
  'в счет не',
  'не в счёт',
  'не в счет',
  'не бери',
  'не берём',
  'не берем',
  'не учитыва',
  'исключая',
  'кроме',
  'без ',
  'в полный рост',
  'считая ', // «считая первый», «считая верхний ярус»
  'вместе с',
  'за один',
  'снаружи',
  'целые',
  'целых',
  // Размерные прилагательные («большие», «крупные») НЕ маркер: во включающей
  // фразе «все купола — большие и маленькие» они ничего не исключают, а скан
  // молчал (гейт #1718, шаг 691). Граница счёта — только форма исключения.
]

/**
 * Названа ли в тексте задания граница счёта.
 *
 * Неразрывный пробел приводится к обычному: в текстах квестов он попадается
 * внутри «в счёт не идут» после вычитки в редакторе, и маркер с обычным
 * пробелом промахнулся бы мимо такого текста молча.
 */
function hasCountBoundary(task) {
  const text = String(task ?? '').toLowerCase().replace(/\u00a0/g, ' ')
  return BOUNDARY_MARKERS.some((marker) => text.includes(marker))
}

/** Вердикт по одному шагу: `null`, если шаг не счётный или границы достаточно. */
function inspectStep(step) {
  if (step.is_intro) return null
  const task = String(step.task ?? '')
  if (!COUNT_TASK_RE.test(task)) return null
  const span = answerSpan(step.answer_pattern)
  if (span === null || span < 2) return null
  if (hasCountBoundary(task)) return null
  return {
    answer_type: step.answer_pattern?.type ?? null,
    answer_value: step.answer_pattern?.value ?? null,
    span: span === Infinity ? 'any_number' : span,
  }
}

function scanQuests(quests) {
  const findings = []
  let scannedSteps = 0
  for (const quest of quests) {
    for (const step of quest.steps || []) {
      if (step.is_intro) continue
      scannedSteps++
      const verdict = inspectStep(step)
      if (!verdict) continue
      findings.push({
        quest_db_id: quest.id ?? null,
        quest_id: quest.quest_id,
        step_db_id: step.id ?? null,
        step_id: step.step_id,
        ...verdict,
        task: String(step.task ?? ''),
      })
    }
  }
  return { findings, scannedSteps }
}

// ===================== Allow-файл =====================

function findingKeys(finding) {
  return [`${finding.quest_id}|${finding.step_id}`]
}

function loadAllowKeys(allowPath) {
  const baseline = loadBaseline(path.resolve(process.cwd(), allowPath), ALLOW_CONTRACT_VERSION)
  const known = baseline.known || {}
  return Array.isArray(known) ? known : Object.keys(known)
}

// ===================== Источники данных =====================

function toScanBundle(bundle) {
  return { id: bundle.id, quest_id: bundle.quest_id, steps: parseSteps(bundle) }
}

async function loadFromApi(apiUrl, questId) {
  const bundles = await fetchQuestBundles(apiUrl, questId)
  return bundles.map(toScanBundle)
}

// ===================== CLI =====================

function parseArgs(argv) {
  const get = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
  return {
    apiUrl: get('api-url') || DEFAULT_API,
    questId: get('quest-id') || null,
    source: get('source') || null,
    // Allow-файл вычитается ПО УМОЛЧАНИЮ, в отличие от baseline скана утечки:
    // там умолчание без baseline осмысленно (контур шага вычищен до нуля), а
    // здесь разобранный остаток свипа #1718 — это норма каталога, и прогон без
    // вычитания красный by design. `--no-allow-file` показывает всё.
    allowFile: argv.includes('--no-allow-file') ? null : (get('allow-file') || ALLOW_PATH),
    json: argv.includes('--json'),
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const quests = args.source
    ? loadLocalBundles(args.source, args.questId)
    : await loadFromApi(args.apiUrl, args.questId)

  const scanned = scanQuests(quests)
  const source = args.source || args.apiUrl
  const { fresh: findings, known: knownFindings } = args.allowFile
    ? splitByBaseline(scanned.findings, loadAllowKeys(args.allowFile), findingKeys)
    : { fresh: scanned.findings, known: [] }

  if (args.json) {
    console.log(JSON.stringify(
      {
        source,
        quests: quests.length,
        scannedSteps: scanned.scannedSteps,
        allowFile: args.allowFile,
        knownFindings: knownFindings.length,
        findings,
      },
      null,
      2,
    ))
  } else {
    console.log(`Скан 4b: ${source} — ${quests.length} квестов, ${scanned.scannedSteps} шагов`)
    for (const f of findings) {
      console.log(`\n  [quest ${f.quest_db_id ?? '?'}] ${f.quest_id} / шаг ${f.step_db_id ?? '?'} ${f.step_id}`)
      console.log(`    ${f.answer_type} ${f.answer_value ?? ''} — ширина ${f.span}, граница счёта в задании не названа`)
      console.log(`    ${f.task}`)
    }
    if (knownFindings.length) {
      console.log(`\nУчтено allow-файлом (оставлено с обоснованием): ${knownFindings.length}`)
    }
    console.log(findings.length ? `\nСчётных шагов без границы: ${findings.length}` : '\nСчётных шагов без границы нет.')
  }

  if (findings.length) process.exitCode = 1
}

module.exports = {
  ALLOW_PATH,
  ALLOW_CONTRACT_VERSION,
  BOUNDARY_MARKERS,
  COUNT_TASK_RE,
  answerSpan,
  hasCountBoundary,
  inspectStep,
  scanQuests,
  findingKeys,
  loadAllowKeys,
  toScanBundle,
  parseArgs,
}

if (require.main === module) {
  main().catch((e) => {
    console.error('Fatal:', e.message || e)
    process.exit(1)
  })
}
