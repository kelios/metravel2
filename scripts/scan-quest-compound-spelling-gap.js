#!/usr/bin/env node
/**
 * Скан пропусков составных форм вокруг второго написания (#1536).
 *
 * Родственник `scan-quest-answer-reachability.js` (#1450) по механике и его
 * зеркальное дополнение по смыслу. Тот скан спрашивает «можно ли набрать то,
 * что в словаре лежит», и ловит мёртвые варианты. Этот спрашивает «лежит ли в
 * словаре то, что игрок физически напишет», и ловит дырку, которую первый
 * увидеть не в состоянии: все варианты живы, но формы, которую игрок списывает
 * с объекта, среди них просто нет.
 *
 * Условие срабатывания механическое и потому узкое — словарь сам себя выдаёт:
 *   1) в словаре есть орфографическая пара односложных форм: две записи, которые
 *      различаются только `ъ`/`ь` на конце или буквой из набора `і`/`ѣ`/`ѳ`/`ѵ`
 *      («сад»/«садъ», «михаил»/«міхаіл», «цепь»/«цеп», «сидит»/«сидить»);
 *   2) в том же словаре есть хоть одна составная форма;
 *   3) какая-то из этих форм кончается на одно из написаний пары («городской
 *      сад»), а зеркальной вокруг второго написания нет («городской садъ»).
 * Значит автор сознательно принимал оба написания короткого ответа, а фразу
 * собрал по памяти вокруг привычного — и игрок, списавший надпись целиком в том
 * виде, что стоит на камне, получает «Неверный ответ».
 *
 * Почему нужен именно скан, а не правило авторинга: пункты 1–3 проверяются
 * механически по самому словарю, без знания языка и объекта. Разбор
 * прохождения `28a968cc` (`brest-teens-erased-city`, шаг 1018) дал первый
 * экземпляр — «ГОРОДСКОЙ САДЪ» с арки Брестского горсада, 10 отклонённых
 * попыток. Скан по всей прод-базе нашёл ещё 10 шагов того же класса, из них
 * ни один не был бы виден без живого игрока.
 *
 * Чего скан НЕ ловит и не должен: перевод фразы целиком («святы Міхаіл» вместо
 * «святой міхаіл»), падежи и синонимы. Это соседние классы, у них нет
 * механического признака внутри словаря. См. QUEST-ANSWER-UNREACHABLE-001 в
 * docs/PROBLEM_MEMORY.md.
 *
 * Отдельно про сужение до ПОСЛЕДНЕГО слова фразы: «мизинец левой руки» скан
 * зеркалить не станет, хотя дырка там та же. Причина в цене ошибки — обход
 * любой позиции ловит и «меч в руке» → «мечь в руке», и всякое совпадение
 * служебного слова, а гейт с нулевым порогом обязан молчать на здоровом
 * контенте. Класс «прилагательное + существительное» кладёт спорное слово в
 * конец, и на прод-базе это покрыло все 11 найденных экземпляров.
 *
 * Нормализация — общая с рантаймом (`scripts/lib/questAnswerNormalize`), та же,
 * по которой `buildAnswerChecker` засчитывает ввод игрока. `ъ`/`ь`/`і` она не
 * трогает и не должна: это разные буквы, и покрытие написаний целиком на
 * словаре. Свёртка написаний живёт только здесь, в `orthoStem`, и применяется
 * исключительно для поиска ПАРЫ — сравнение ответа игрока со словарём остаётся
 * строгим.
 *
 *   node scripts/scan-quest-compound-spelling-gap.js                    # весь прод
 *   node scripts/scan-quest-compound-spelling-gap.js --quest-id=minsk-cmok
 *   node scripts/scan-quest-compound-spelling-gap.js --source=scripts/minsk-cmok-quest-data.js
 *   node scripts/scan-quest-compound-spelling-gap.js --json
 *   node scripts/scan-quest-compound-spelling-gap.js --update-baseline
 *
 * Exit code 1, если найден хотя бы один пропуск, не записанный в baseline.
 *
 * `--baseline=<файл>` вычитает осознанные исключения. Он нужен для омографов:
 * свёртка склеивает «цепь» и «цеп», но «цеп» — самостоятельное слово
 * (молотильное орудие), и зеркальная «якорная цеп» была бы несуществующей
 * фразой. Без этого выхода у автора остаётся только два плохих: выдумать фразу
 * или выкинуть из словаря послабление, которым игрок пользуется. Сейчас файл
 * пуст — находок прод-базы не осталось, порог нулевой.
 */

// Разбор словаря и сам сканируемый тип берём у скана достижимости, а не копией:
// разъехавшись, две копии начали бы считать дефектом разные множества шагов.
const path = require('path')

const {
  parseDictionary,
  SCANNED_TYPE,
  QUEST_DATA_FILE_PATTERN,
} = require('./scan-quest-answer-reachability')
const { fetchQuestBundles, loadLocalBundles, parseSteps } = require('./lib/questBundles')
const { normalizeAnswer } = require('./lib/questAnswerNormalize')
// Baseline — общий механизм аудит-сканов квестов (#1450, #1488): загрузка,
// вычитание и запись живут в `scripts/lib/scanBaseline`, здесь только свои путь,
// версия контракта и функция ключей.
const {
  localQuestDataFiles,
  loadBaseline: loadBaselineFile,
  splitByBaseline: splitFindingsByBaseline,
  writeBaseline,
} = require('./lib/scanBaseline')

const DEFAULT_API = process.env.METRAVEL_API_URL || 'https://metravel.by'

const BASELINE_PATH = 'scripts/quest-compound-spelling-gap-baseline.json'
const BASELINE_CONTRACT_VERSION = 1

/**
 * Свёртка написаний одного и того же слова. Набор намеренно закрытый: сюда
 * входят только различия, которые НЕ меняют слова, — дореформенные и
 * межъязыковые начертания одной буквы (`і`↔`и`, `ѣ`→`е`, `ѳ`→`ф`, `ѵ`→`и`) и
 * конечные `ъ`/`ь`. Гласные (`свіслач`/`свислочь`) сюда не попадают: `о`↔`а`
 * различает уже разные слова, и свёртка по ним начала бы склеивать чужие пары.
 */
function orthoStem(word) {
  return word
    .replace(/і/g, 'и')
    .replace(/ѣ/g, 'е')
    .replace(/ѳ/g, 'ф')
    .replace(/ѵ/g, 'и')
    .replace(/[ъь]+$/, '')
}

/** Пары односложных форм словаря, различающихся только написанием. */
function spellingSiblings(singles) {
  const sorted = [...singles].sort()
  const pairs = []
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (orthoStem(sorted[i]) === orthoStem(sorted[j])) pairs.push([sorted[i], sorted[j]])
    }
  }
  return pairs
}

/**
 * Пропуски одного словаря. `variants` — сырые записи словаря; сравнение идёт по
 * нормализованным формам, потому что именно их видит рантайм.
 *
 * Возвращает `{ qualifies, mirrorable, gaps }`.
 *
 * `qualifies` — пункты 1 и 2 условия: есть пара написаний и есть хоть какая-то
 * составная форма. Счётчик намеренно широкий: ровно так считал разовый скан
 * `.quest-audit/scan-compound-spelling-gap.py`, и «подходит / дефект / контроль»
 * из тикета #1536 (21/9/12) воспроизводимы только с ним. Но широкий счётчик
 * завышает контроль: словарь без единой фразы вокруг спорного слова дефектным
 * стать не мог, и записывать его в «проверено и чисто» нечестно.
 *
 * Поэтому рядом идёт `mirrorable` — пункт 3: у словаря есть фраза, кончающаяся
 * на одно из написаний пары, то есть он реально был под риском. Именно это число
 * показывает, что правило описывает норму авторинга, а не выдумано под девять
 * шагов; отчёт печатает оба.
 */
function scanDictionary(variants) {
  const forms = new Set()
  for (const variant of variants || []) {
    const normalized = normalizeAnswer(variant)
    if (normalized) forms.add(normalized)
  }

  const singles = [...forms].filter((form) => !form.includes(' '))
  const compounds = [...forms].filter((form) => form.includes(' '))
  const siblings = spellingSiblings(singles)
  if (!siblings.length || !compounds.length) return { qualifies: false, mirrorable: false, gaps: [] }

  const gaps = []
  const seen = new Set()
  let mirrorable = false
  for (const compound of compounds) {
    const parts = compound.split(' ')
    const last = parts[parts.length - 1]
    const prefix = parts.slice(0, -1).join(' ')
    for (const pair of siblings) {
      // Зеркало последнего слова: если фраза кончается на одно написание пары,
      // такая же фраза на второе написание обязана быть в словаре.
      const mirror = last === pair[0] ? pair[1] : last === pair[1] ? pair[0] : null
      if (!mirror) continue
      mirrorable = true
      const missing = `${prefix} ${mirror}`
      if (forms.has(missing) || seen.has(missing)) continue
      seen.add(missing)
      gaps.push({ compound, missing, spelling: mirror, sibling: last })
    }
  }
  return { qualifies: true, mirrorable, gaps }
}

/** Находки одного шага в том же виде, что у соседних сканов квестов. */
function scanStep(step, dictionary = parseDictionary(step.answer_pattern)) {
  if (!dictionary || !dictionary.length) return { qualifies: false, mirrorable: false, findings: [] }
  const { qualifies, mirrorable, gaps } = scanDictionary(dictionary)
  return {
    qualifies,
    mirrorable,
    findings: gaps.map((gap) => ({
      kind: 'compound_spelling_gap',
      value: gap.missing,
      detail: `словарь принимает «${gap.sibling}» и «${gap.spelling}», но фразу собрал только вокруг «${gap.sibling}»`,
      compound: gap.compound,
    })),
  }
}

function scanQuests(quests) {
  const findings = []
  let scannedSteps = 0
  let scannedVariants = 0
  let pool = 0
  let atRisk = 0
  let defective = 0
  let clean = 0

  for (const quest of quests) {
    for (const step of quest.steps || []) {
      if (step.is_intro) continue
      if (step.answer_pattern?.type !== SCANNED_TYPE) continue
      const variants = parseDictionary(step.answer_pattern)
      scannedSteps++
      scannedVariants += variants ? variants.length : 0

      const { qualifies, mirrorable, findings: stepFindings } = scanStep(step, variants)
      if (!qualifies) continue
      pool++
      if (mirrorable) atRisk++
      if (!stepFindings.length) {
        clean++
        continue
      }
      defective++
      for (const finding of stepFindings) {
        findings.push({
          quest_db_id: quest.id ?? null,
          quest_id: quest.quest_id,
          step_db_id: step.id ?? null,
          step_id: step.step_id,
          dictionary: JSON.stringify(variants),
          ...finding,
        })
      }
    }
  }
  return { findings, scannedSteps, scannedVariants, pool, atRisk, defective, clean }
}

// ===================== Источники данных =====================

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
    json: argv.includes('--json'),
  }
}

// ===================== Baseline =====================

/** Ключ находки: baseline хранит не текст словаря, а опознавательные признаки. */
function findingKey(finding) {
  return [finding.quest_id, finding.step_id, finding.value].join('|')
}

function loadBaseline(baselinePath) {
  return loadBaselineFile(baselinePath, BASELINE_CONTRACT_VERSION)
}

/** Делит находки на новые (за них гейт и падает) и записанные в baseline. */
function splitByBaseline(findings, knownKeys) {
  return splitFindingsByBaseline(findings, knownKeys, (finding) => [findingKey(finding)])
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
    note: 'Осознанные исключения: словарь содержит омографичную пару («цепь»/«цеп», «угол»/«уголь»), '
      + 'и зеркальная фраза была бы несуществующей — размножать её нельзя, а сужать множество '
      + 'принимаемых ответов не хочется. Сейчас файл пуст: находок прод-базы не осталось. '
      + 'Обновлять: npm run quest:scan-compound-spelling-gap:baseline',
    known,
  })
  return { baselinePath, files: Object.keys(known).length, total }
}

function reportText(source, quests, scanned, knownFindings = []) {
  console.log(
    `Скан составных написаний exact_any: ${source} — ${quests} квестов, `
    + `${scanned.scannedSteps} шагов, ${scanned.scannedVariants} вариантов`,
  )

  const byStep = new Map()
  for (const finding of scanned.findings) {
    const key = `${finding.quest_id}|${finding.step_id}`
    if (!byStep.has(key)) byStep.set(key, [])
    byStep.get(key).push(finding)
  }

  for (const rows of byStep.values()) {
    const head = rows[0]
    console.log(`\n  [quest ${head.quest_db_id ?? '?'}] ${head.quest_id} / шаг ${head.step_db_id ?? '?'} ${head.step_id}`)
    console.log(`    словарь: ${head.dictionary}`)
    for (const row of rows) {
      console.log(`    не хватает «${row.value}» — есть «${row.compound}», ${row.detail}`)
    }
  }

  if (knownFindings.length) {
    console.log(`\nУчтено baseline (записано как осознанное исключение): ${knownFindings.length}`)
  }

  console.log(`\nподходит под условие: ${scanned.pool}`)
  console.log(`дефект есть: ${scanned.defective} | контроль чист: ${scanned.clean}`)
  // Строгий контроль: сколько из пула реально были под риском — у них есть фраза
  // вокруг одного из написаний. Широкий `pool` держится ради воспроизводимости
  // чисел разового скана, но норму авторинга показывает именно это число.
  console.log(`из них фраза стоит вокруг одного из написаний: ${scanned.atRisk}`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.updateBaseline) {
    const result = updateBaseline(process.cwd())
    console.log(`Baseline перезаписан: ${BASELINE_PATH} — ${result.total} исключений в ${result.files} файлах.`)
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
    console.log(JSON.stringify({ source, quests: quests.length, ...scanned, findings, knownFindings }, null, 2))
  } else {
    reportText(source, quests.length, { ...scanned, findings }, knownFindings)
  }

  // Падаем на том, что принесла правка. Записанное в baseline — осознанное
  // исключение владельца контента, а не забытая находка.
  if (findings.length) process.exitCode = 1
}

module.exports = {
  orthoStem,
  spellingSiblings,
  scanDictionary,
  scanStep,
  scanQuests,
  parseArgs,
  findingKey,
  splitByBaseline,
  updateBaseline,
  BASELINE_PATH,
}

if (require.main === module) {
  main().catch((e) => {
    console.error('Fatal:', e.message || e)
    process.exit(1)
  })
}
