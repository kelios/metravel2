#!/usr/bin/env node
/**
 * Скан достижимости вариантов ответа в закрытых словарях `exact_any` (#1450).
 *
 * `buildAnswerChecker` (`utils/questAdapters.ts`) сравнивает ввод игрока со
 * словарём СТРОГО на равенство после `normalize()` — без стемминга и без
 * морфологии. Значит вариант, записанный так, что после нормализации он не
 * равен ничему, что игрок способен набрать, не сработает никогда, и узнать об
 * этом можно было только от живого игрока на маршруте (#1446) или ручной
 * сверкой словаря глазами (аудит прода 06.08.2026: 161 недостижимый вариант в
 * 93 шагах, из них 63 — единственная форма ответа на шаге).
 *
 * Что скан ловит (blocker — шаг или вариант механически недостижим):
 *   - `dictionary_unusable` — `value` не разбирается в непустой массив, чекер
 *     всегда возвращает false: шаг непроходим;
 *   - `empty_after_normalize` — вариант схлопывается в пустую строку (`"-"`),
 *     рантайм его молча выбрасывает, автор считает, что вариант принимается;
 *   - `mixed_script` — внутри одного слова кириллица и латиница
 *     («гадзiннiк» с латинской `i`): такую форму игрок не наберёт;
 *   - `step_unreachable` — у шага не осталось ни одной формы, которую игрок
 *     может ввести. Это громче всего: шаг непроходим в принципе.
 *
 * Что скан ловит как warning (шаг проходим, но запись неполна или избыточна):
 *   - `duplicate_raw` / `duplicate_normalized` — вариант повторяет другой
 *     вариант того же словаря дословно или после нормализации («орёл»/«орел»,
 *     «меч, щит»/«меч щит»). Игроку не мешает, но прячет опечатку: автор мог
 *     метить во вторую языковую форму, а записал копию первой;
 *   - `case_form_gap` — вопрос «какого … цвета?» требует родительного падежа,
 *     а словарь держит только именительный. Шаг проходим (игрок угадает падеж
 *     со второй-третьей попытки), но именно так бросают квест: разбор
 *     прохождения 305 `yelnya-bog-bells` — шаг 791, `коричневого` и `рыжего`
 *     отклонены, принят только `коричневый` с четвёртой попытки.
 *
 * Чего скан НЕ ловит и не может: словарь достижим, но не покрывает
 * естественную формулировку игрока, и лексический класс «правильный алфавит,
 * форма чужого языка» — «цегла» (uk) вместо «цэгла» (be) в #1446, «сухій» (uk)
 * вместо «сухі» (be) в `luninets-railway/3-suhoj`. Обе формы состоят из букв,
 * допустимых в языке квеста, и отличить их от верных можно только словарём
 * языка. См. QUEST-ANSWER-UNREACHABLE-001 в docs/PROBLEM_MEMORY.md.
 *
 *   node scripts/scan-quest-answer-reachability.js                    # весь прод
 *   node scripts/scan-quest-answer-reachability.js --quest-id=krakow-dragon
 *   node scripts/scan-quest-answer-reachability.js --source=scripts/yelnya-quest-data.js
 *   node scripts/scan-quest-answer-reachability.js --strict            # warning тоже валит прогон
 *   node scripts/scan-quest-answer-reachability.js --json
 *   node scripts/scan-quest-answer-reachability.js --update-baseline    # переписать baseline по всем локальным данным
 *
 * Exit code 1, если найден хотя бы один blocker (с `--strict` — и warning).
 *
 * `--baseline=<файл>` вычитает уже известные находки: гейт `check:fast` обязан
 * падать на том, что принесла правка, а не на контенте, который лежал в файле
 * до неё. Известные находки при этом не забываются — они перечислены в
 * `scripts/quest-answer-reachability-baseline.json` и чинятся отдельной
 * карточкой (#1455).
 */

const path = require('path')

const { fetchQuestBundles, loadLocalBundles, parseSteps } = require('./lib/questBundles')
const { normalizeAnswer } = require('./lib/questAnswerNormalize')
// Определение смешения алфавитов — общее со сканом видимого текста (#1464):
// две копии регулярок разошлись бы, и один скан начал бы отчитываться «чисто»
// о том, что другой считает дефектом.
const { mixedScriptWords, confusableChars } = require('./lib/questScriptMixing')
// Baseline — общий с другими аудит-сканами квестов механизм (#1450, #1488):
// загрузка, вычитание и запись живут в `scripts/lib/scanBaseline`, здесь только
// свои путь, версия контракта и функция ключей.
const {
  localQuestDataFiles,
  loadBaseline: loadBaselineFile,
  splitByBaseline: splitFindingsByBaseline,
  writeBaseline,
} = require('./lib/scanBaseline')

const DEFAULT_API = process.env.METRAVEL_API_URL || 'https://metravel.by'

const BASELINE_PATH = 'scripts/quest-answer-reachability-baseline.json'
const BASELINE_CONTRACT_VERSION = 1
// Локальные данные квестов: и `<city>-quest-data.js`, и `<city>-quests-data.js`.
const QUEST_DATA_FILE_PATTERN = /^[^/]+-quests?-data\.js$/

// Только `exact_any`: у него закрытый словарь из нескольких форм, и лишняя
// форма молча пропадает. `exact` — одна строка, её недостижимость видна на
// первом же прохождении; свободные типы словаря не имеют вовсе.
const SCANNED_TYPE = 'exact_any'

const BLOCKER_KINDS = new Set(['dictionary_unusable', 'empty_after_normalize', 'mixed_script', 'step_unreachable'])

// Вопрос, который сам ставит ответ в родительный падеж. Форма узкая намеренно:
// «из какого материала» тоже начинается с «какого», но естественный ответ там —
// существительное («кирпич»), и требовать «кирпичного» бессмысленно. На базе
// прода шаблон даёт 21 шаг, из них 15 родительный падеж уже держат — контроль на
// здоровой позиции, по которому видно, что правило описывает норму, а не выдумку.
const GENITIVE_QUESTION = /како(го|й) (она |он |оно |они )?цвета/
// Именительный падеж прилагательного (в т.ч. множественное число).
const NOMINATIVE_ADJECTIVE = /(ый|ий|ой|ая|яя|ое|ее|ые|ие)$/
const GENITIVE_ADJECTIVE = /(ого|его)$/

/** Разбор словаря шага. `null` — словаря нет вовсе (чекер всегда false). */
function parseDictionary(answerPattern) {
  if (!answerPattern || answerPattern.type !== SCANNED_TYPE) return null
  const raw = answerPattern.value
  // Локальные `*-quest-data.js` иногда держат уже готовый массив, API — строку.
  if (Array.isArray(raw)) return raw.map((v) => String(v))
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : null
  } catch {
    return null
  }
}

/**
 * Пропуск падежной формы: вопрос требует родительного падежа, а словарь весь в
 * именительном. Именительный ищем по последнему слову («тёмно-коричневый»),
 * родительный — по любому: в «жёлтого цвета» падеж несёт первое слово, и такой
 * словарь пропуска не имеет.
 */
function hasCaseFormGap(step, normalizedVariants) {
  if (!GENITIVE_QUESTION.test(normalizeAnswer(step.task))) return false
  const words = normalizedVariants.flatMap((variant) => variant.split(' '))
  return normalizedVariants.some((variant) => NOMINATIVE_ADJECTIVE.test(variant.split(' ').pop()))
    && !words.some((word) => GENITIVE_ADJECTIVE.test(word))
}

/**
 * Находки одного шага. Возвращает список находок по вариантам плюс, если у шага
 * не осталось ни одной вводимой формы, отдельную находку уровня шага.
 */
function scanStep(step, dictionary = parseDictionary(step.answer_pattern)) {
  const variants = dictionary
  if (variants === null) {
    return step.answer_pattern?.type === SCANNED_TYPE
      ? [{ kind: 'dictionary_unusable', value: String(step.answer_pattern.value ?? ''), detail: 'словарь не разбирается в массив строк' }]
      : []
  }
  if (variants.length === 0) {
    return [{ kind: 'dictionary_unusable', value: '[]', detail: 'словарь пуст' }]
  }

  const findings = []
  const seenRaw = new Set()
  const firstByNormalized = new Map()
  let typeable = 0

  for (const variant of variants) {
    const normalized = normalizeAnswer(variant)

    if (!normalized) {
      findings.push({ kind: 'empty_after_normalize', value: variant, detail: 'после нормализации пусто — рантайм выбрасывает вариант' })
      continue
    }

    const mixed = mixedScriptWords(variant)
    if (mixed.length) {
      findings.push({
        kind: 'mixed_script',
        value: variant,
        detail: `в слове «${mixed[0]}» смешаны алфавиты (подменыши: ${confusableChars(mixed[0])})`,
      })
      continue
    }

    if (seenRaw.has(variant)) {
      findings.push({ kind: 'duplicate_raw', value: variant, detail: 'дословный повтор другого варианта словаря' })
      continue
    }
    if (firstByNormalized.has(normalized)) {
      findings.push({
        kind: 'duplicate_normalized',
        value: variant,
        detail: `после нормализации совпадает с «${firstByNormalized.get(normalized)}»`,
      })
      seenRaw.add(variant)
      continue
    }

    seenRaw.add(variant)
    firstByNormalized.set(normalized, variant)
    typeable++
  }

  if (hasCaseFormGap(step, [...firstByNormalized.keys()])) {
    findings.push({
      kind: 'case_form_gap',
      value: JSON.stringify(variants),
      detail: 'вопрос требует родительного падежа («какого цвета»), в словаре только именительный',
    })
  }

  if (typeable === 0) {
    findings.push({
      kind: 'step_unreachable',
      value: JSON.stringify(variants),
      detail: 'ни одной формы, которую игрок может ввести — шаг непроходим',
    })
  }
  return findings
}

function scanQuests(quests) {
  const findings = []
  let scannedSteps = 0
  let scannedVariants = 0

  for (const quest of quests) {
    for (const step of quest.steps || []) {
      if (step.is_intro) continue
      if (step.answer_pattern?.type !== SCANNED_TYPE) continue
      const variants = parseDictionary(step.answer_pattern)
      scannedSteps++
      scannedVariants += variants ? variants.length : 0

      for (const finding of scanStep(step, variants)) {
        findings.push({
          severity: BLOCKER_KINDS.has(finding.kind) ? 'blocker' : 'warning',
          quest_db_id: quest.id ?? null,
          quest_id: quest.quest_id,
          step_db_id: step.id ?? null,
          step_id: step.step_id,
          dictionary: String(step.answer_pattern?.value ?? ''),
          ...finding,
        })
      }
    }
  }
  return { findings, scannedSteps, scannedVariants }
}

// ===================== Baseline =====================

/** Ключ находки: сам файл в baseline не хранит текст, только опознавательные признаки. */
function findingKey(finding) {
  return [finding.kind, finding.quest_id, finding.step_id, finding.value].join('|')
}

function loadBaseline(baselinePath) {
  return loadBaselineFile(baselinePath, BASELINE_CONTRACT_VERSION)
}

/** Делит находки на новые (за них гейт и падает) и уже записанные в baseline. */
function splitByBaseline(findings, knownKeys) {
  return splitFindingsByBaseline(findings, knownKeys, (finding) => [findingKey(finding)])
}

// ===================== Источники данных =====================
//
// Обход каталога и ретраи — в `scripts/lib/questBundles`, в одном экземпляре на
// все аудит-скрипты квестов (#1447).

async function loadFromApi(apiUrl, questId) {
  const bundles = await fetchQuestBundles(apiUrl, questId)
  return bundles.map((bundle) => ({ id: bundle.id, quest_id: bundle.quest_id, steps: parseSteps(bundle) }))
}

// ===================== CLI =====================

function parseArgs(argv) {
  const get = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
  return {
    apiUrl: get('api-url') || DEFAULT_API,
    questId: get('quest-id') || null,
    source: get('source') || null,
    baseline: get('baseline') || null,
    updateBaseline: argv.includes('--update-baseline'),
    strict: argv.includes('--strict'),
    json: argv.includes('--json'),
  }
}

/** Перезапись baseline по всем локальным данным квестов — единственный способ его пополнить. */
function updateBaseline(rootDir) {
  const known = {}
  let total = 0
  for (const file of localQuestDataFiles(rootDir, QUEST_DATA_FILE_PATTERN)) {
    const { findings } = scanQuests(loadLocalBundles(file, null))
    if (!findings.length) continue
    known[file] = findings.map(findingKey).sort()
    total += findings.length
  }
  const baselinePath = path.join(rootDir, BASELINE_PATH)
  writeBaseline(baselinePath, {
    contractVersion: BASELINE_CONTRACT_VERSION,
    note: 'Известные находки в локальных данных квестов. Гейт check:fast падает только на том, '
      + 'что добавила правка; перечисленное здесь чинится отдельной карточкой. '
      + 'Обновлять: npm run quest:scan-answer-reachability:baseline',
    known,
  })
  return { baselinePath, files: Object.keys(known).length, total }
}

function reportText(source, quests, scannedSteps, scannedVariants, findings, knownFindings = []) {
  console.log(`Скан достижимости exact_any: ${source} — ${quests} квестов, ${scannedSteps} шагов, ${scannedVariants} вариантов`)

  for (const severity of ['blocker', 'warning']) {
    const rows = findings.filter((f) => f.severity === severity)
    if (!rows.length) continue
    console.log(`\n${severity === 'blocker' ? 'НЕДОСТИЖИМО' : 'Избыточно'} (${rows.length}):`)
    for (const f of rows) {
      console.log(`\n  [quest ${f.quest_db_id ?? '?'}] ${f.quest_id} / шаг ${f.step_db_id ?? '?'} ${f.step_id}`)
      console.log(`    ${f.kind}: «${f.value}» — ${f.detail}`)
      console.log(`    словарь: ${f.dictionary}`)
    }
  }

  if (knownFindings.length) {
    console.log(`\nУчтено baseline (лежало в файле до правки, чинится отдельно): ${knownFindings.length}`)
  }

  const blockers = findings.filter((f) => f.severity === 'blocker').length
  console.log(blockers ? `\nНедостижимых вариантов: ${blockers}` : '\nНедостижимых вариантов нет.')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.updateBaseline) {
    const result = updateBaseline(process.cwd())
    console.log(`Baseline перезаписан: ${BASELINE_PATH} — ${result.total} находок в ${result.files} файлах.`)
    return
  }

  const quests = args.source
    ? loadLocalBundles(args.source, args.questId)
    : await loadFromApi(args.apiUrl, args.questId)

  const scanned = scanQuests(quests)
  const source = args.source || args.apiUrl
  const { fresh: findings, known: knownFindings } = args.baseline
    ? splitByBaseline(scanned.findings, loadBaseline(path.resolve(process.cwd(), args.baseline)).known?.[source])
    : { fresh: scanned.findings, known: [] }

  if (args.json) {
    console.log(JSON.stringify({
      source,
      quests: quests.length,
      scannedSteps: scanned.scannedSteps,
      scannedVariants: scanned.scannedVariants,
      strict: args.strict,
      baseline: args.baseline,
      knownFindings,
      findings,
    }, null, 2))
  } else {
    reportText(source, quests.length, scanned.scannedSteps, scanned.scannedVariants, findings, knownFindings)
  }

  const failing = findings.filter((f) => args.strict || f.severity === 'blocker')
  if (failing.length) process.exitCode = 1
}

module.exports = {
  parseDictionary,
  mixedScriptWords,
  hasCaseFormGap,
  scanStep,
  scanQuests,
  parseArgs,
  findingKey,
  splitByBaseline,
  updateBaseline,
  BLOCKER_KINDS,
  SCANNED_TYPE,
  BASELINE_PATH,
  QUEST_DATA_FILE_PATTERN,
}

if (require.main === module) {
  main().catch((e) => {
    console.error('Fatal:', e.message || e)
    process.exit(1)
  })
}
