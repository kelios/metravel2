#!/usr/bin/env node
/**
 * Скан «поверхностного» ответа — правило авторинга 4f
 * (`.claude/skills/metravel-quest/SKILL.md`): ответ шага не строится на том, как
 * поверхность объекта выглядит СЕГОДНЯ, потому что перекраска и ремонт
 * протухают молча.
 *
 * Доказанный кейс #1431: Троицкая церковь в Мире стояла в базе «синей» по фото
 * 2014 года, к 2023-му стала белой с тёмно-зелёными куполами. 15.08.2026 игрок
 * честно называл то, что видит, получил шесть отказов подряд и бросил квест.
 *
 * До этого скрипта исполняемая редакция критерия жила в `.quest-audit/`, а эта
 * папка в `.gitignore`: разовый аудит #1431 нельзя было ни повторить на другой
 * машине, ни навесить на гейт, и правило 4f ссылалось на файл, который не
 * переживает `git clone`. Здесь тот же критерий, но в трекаемом виде и с
 * baseline, как у сканов #1450/#1467/#1488.
 *
 * Что скан ловит и чего НЕ ловит. Механическая часть — «ответ зависит от вида
 * поверхности». Устарел ли конкретный эталон, скан не знает и знать не может:
 * это решается датированным фото по порогу свежести из 4f. Поэтому находка —
 * это не дефект, а шаг, который обязан иметь вердикт с источником и датой.
 *
 *   node scripts/scan-quest-surface-answer.js                       # весь прод
 *   node scripts/scan-quest-surface-answer.js --quest-id=mir-castle
 *   node scripts/scan-quest-surface-answer.js --source=scripts/mir-castle-quest-data.js
 *   node scripts/scan-quest-surface-answer.js --json
 *
 * Exit code 1, если найден хотя бы один неразобранный шаг.
 */

const path = require('path')

const { fetchQuestBundles, loadLocalBundles, parseSteps } = require('./lib/questBundles')
// Baseline — общий с другими аудит-сканами квестов механизм (#1450, #1488).
const { localQuestDataFiles, loadBaseline, splitByBaseline, writeBaseline } = require('./lib/scanBaseline')
// Шаблон имени локальных данных квеста живёт в одном экземпляре у скана
// достижимости: вторая копия однажды разойдётся, и гейт начнёт проверять не тот
// набор файлов, что baseline (#1450).
const { QUEST_DATA_FILE_PATTERN } = require('./scan-quest-answer-reachability')

const DEFAULT_API = process.env.METRAVEL_API_URL || 'https://metravel.by'

const BASELINE_PATH = 'scripts/quest-surface-answer-baseline.json'
const BASELINE_CONTRACT_VERSION = 1

// ===================== Критерий отбора (правило 4f) =====================
//
// Две независимые ветки, внутри каждой два признака; достаточно любого одного.
// Ветка МАТЕРИАЛ обязательна: цветовой словарь её НЕ ловит. Слово «кирпич» не
// цветовое, а задание «из какого материала сложены стены форта?» не содержит ни
// одного цветового корня — первый прогон #1431 потерял на этом девять шагов
// (114, 195, 205, 278, 388, 679, 798, 1094, 1272), и ещё семь (90, 125, 408,
// 498, 794, 855, 1371) нашлись только код-ревью.

/** Корни цветовых слов: ru / be / uk / pl / en / de / lt / lv. */
const COLOR_ROOTS = [
  // `czerwon`/`czerwien` — латиница, а не дубль кириллических «червон»/«чырвон»:
  // без неё словарь польских ответов не ловился вовсе. В корпусе #1431 таких
  // шагов два (199 Познань, 1340 Sasino), и оба спаслись только формулировкой
  // задания «какого цвета» — то есть дыра ничего не потеряла задним числом, но
  // закрылась бы молча на первом же квесте с ответом без слова «цвет».
  'красн', 'червон', 'чырвон', 'czerwon', 'czerwien', 'czerwień', 'алый', 'алая', 'алое',
  'син', 'блакит', 'голуб', 'лазур', 'niebiesk', 'blekit', 'błękit', 'blue', 'granatow',
  'зелен', 'зялён', 'zielon', 'green', 'grun', 'grün',
  'жёлт', 'желт', 'жовт', 'жоўт', 'zolt', 'żółt', 'yellow', 'gelb',
  'бел', 'бял', 'bial', 'biał', 'white', 'weiss', 'weiß',
  'чёрн', 'черн', 'чорн', 'czarn', 'black', 'schwarz',
  'оранж', 'помаранч', 'pomarancz', 'pomarańcz', 'orange',
  'фиолет', 'бузков', 'fiolet', 'purple', 'violet', 'сирен',
  'розов', 'ружов', 'różow', 'rozow', 'pink',
  'серый', 'серая', 'серое', 'сер ', 'szar', 'grey', 'gray',
  'коричнев', 'бурый', 'brazow', 'brązow', 'brown',
  'бирюз', 'turkus', 'turquoise',
  'золот', 'zlot', 'złot', 'gold',
  'серебр', 'srebr', 'silver',
  'бордов', 'малинов', 'терракот', 'бежев', 'кремов', 'песочн', 'охр',
  'медн', 'патин',
]

const TASK_COLOR_PHRASES = [
  'какого цвета', 'какой цвет', 'назови цвет', 'цвет ', 'цвета ', 'цветом',
  'окрашен', 'покрашен', 'выкрашен', 'раскрашен', 'колер',
]

/**
 * Материал ВИДИМОЙ поверхности: его меняют ремонтом, не перестраивая объект —
 * кладку штукатурят, купол перезолачивают, крышу перекрывают. Это и есть класс,
 * протухающий так же, как цвет.
 */
const MATERIAL_SURFACE_ROOTS = [
  'кирпич', 'цегл', 'цэгл', 'cegl', 'cegł', 'brick', 'ziegel',
  'плинф', 'плінф',
  'черепиц', 'dachow', 'dachów', 'гонт', 'шифер', 'кровельн',
  'позолот', 'золочен', 'штукатур', 'tynk',
  // Облицовка фасада — её меняют ремонтом так же, как красят стену. Без этих
  // корней шаги 176 (Гомель), 673 (София), 1314 (Лодзь) отбирались только по
  // формулировке задания, а словарь их не находил (#1431, раунд 3 ревью).
  'майолик', 'плитк', 'изразц', 'кафел', 'kafl', 'majolik',
]

/**
 * Конструктивный материал: он виден потому, что из него объект построен, и без
 * перестройки не меняется. В scope сверки НЕ входит — фиксируется отдельной
 * меткой, чтобы решение было видно, а не потеряно.
 */
const MATERIAL_STRUCTURAL_ROOTS = [
  'камен', 'камень', 'камня', 'камни', 'камнем', 'валун', 'булыж', 'бутов',
  'kamien', 'kamień', 'stone', 'stein', 'akmen',
  'дерев', 'древес', 'бревн', 'брус', 'drewn', 'wood', 'holz', 'medien',
  'туф', 'гранит', 'granit', 'мрамор', 'marmur', 'marble', 'песчаник',
  'известняк', 'ракушечник', 'сланец', 'базальт', 'доломит',
  'бетон', 'beton', 'concrete', 'железобетон',
  'сталь', 'чугун', 'железо', 'металл', 'metal', 'бронз', 'brąz', 'braz',
  'стекл', 'szkl', 'glass', 'витраж',
  'глин', 'саман', 'солом', 'тростник', 'камыш', 'thatch', 'мозаик',
  // Материал САМОГО ПРОИЗВЕДЕНИЯ: зеркальные осколки Пассажа Розы (шаг 1312),
  // прутья и лоза плетёного льва (шаг 1007), стальные пластины скульптуры.
  // Заменить его = переделать объект, ремонтом он не меняется. Именно эти два
  // шага в #1431 переехали из «исключено с причиной» в «конструктивный
  // материал», сдвинув норматив аудита с 60+49+38 на 60+47+40.
  'зеркал', 'прут', 'лоз', 'пластин',
]

/**
 * Эти корни называют и материал объекта, и обычный предмет из сюжета: «зеркало»
 * в загадке про базилиска — ответ-предмет, а не то, из чего объект сделан.
 * Засчитываем их только когда САМО задание спрашивает про материал (#1431,
 * раунд 4: без этого шаг 116 попадал в скан как «конструктивный материал»).
 */
const AMBIGUOUS_MATERIAL_ROOTS = ['зеркал', 'прут', 'лоз', 'пластин']

const MATERIAL_ROOTS = [...MATERIAL_SURFACE_ROOTS, ...MATERIAL_STRUCTURAL_ROOTS]

/** Короткие слова, где поиск по подстроке дал бы мусор («бут» в «бутылке»). */
const MATERIAL_EXACT = ['бут', 'бута', 'бутом', 'дуб', 'дуба', 'лес', 'леса']

const TASK_MATERIAL_PHRASES = [
  'из какого материала', 'какой материал', 'из чего сложен', 'из чего сложены',
  'из чего построен', 'из чего построена', 'из чего выстроен', 'из чего сделан',
  'из чего собрана', 'из чего собран', 'из чего он построен', 'из чего',
  'из какого камня', 'из какого природного материала', 'из какого обожженного',
  'чем покрыт', 'чем покрыта', 'чем покрыты', 'чем облицован', 'материала сложены',
]

/**
 * Слова, внутри которых цветовой корень оказался случайно. Без стоп-листа
 * «бельведер», «белка», «белорусский», «сердце», «серьга», «лебедь» попадают в
 * выборку как цветовые и раздувают её вдвое (#1431, 8 шагов: 174, 386, 400,
 * 514, 718, 815, 1276, 1370).
 */
const FALSE_COLOR_WORDS = [
  'бельведер', 'белка', 'белку', 'белочк', 'белки', 'белорус', 'беларус',
  'белосток', 'сердц', 'серьг', 'сереж', 'серёж', 'лебед', 'пирамид',
  'серебрян ложк',
  // «Голубь» — тот же класс, что «лебедь»: цветовой корень внутри названия
  // птицы. Пойман свежим свипом 23.08.2026 на шаге 1410 (Риальто, ответ
  // «голубь святого духа») — он числился цветовым. Корни здесь намеренно
  // длиннее «голуб»: короткий вариант убил бы настоящий цвет «голубой».
  'голубь', 'голубя', 'голубк', 'голубей', 'голубем', 'голубин',
]

const norm = (s) => (s || '').toString().toLowerCase().replace(/ё/g, 'е')

const hasRoot = (word, roots) => {
  const s = norm(word).trim()
  if (!s) return false
  return roots.some((r) => s.includes(norm(r).trim()))
}

function isColorWord(word) {
  const s = norm(word).trim()
  if (!s) return false
  if (FALSE_COLOR_WORDS.some((r) => s.includes(norm(r).trim()))) return false
  return COLOR_ROOTS.some((r) => s.includes(norm(r).trim()))
}

const isSurfaceMaterialWord = (word) => hasRoot(word, MATERIAL_SURFACE_ROOTS)
const isAmbiguousMaterialWord = (word) => hasRoot(word, AMBIGUOUS_MATERIAL_ROOTS)

function isMaterialWord(word) {
  const s = norm(word).trim()
  if (!s) return false
  if (MATERIAL_EXACT.some((r) => s === norm(r))) return true
  return MATERIAL_ROOTS.some((r) => s.includes(norm(r).trim()))
}

/** `answer_pattern.value` приходит строкой с прода и объектом из локальных данных. */
function parseValue(answerPattern) {
  if (!answerPattern) return null
  let value = answerPattern.value
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      /* строка как есть */
    }
  }
  return value
}

/** Закрытый словарь принимаемых ответов: только у `exact`/`exact_any`. */
function dictionaryValues(answerPattern) {
  if (!answerPattern) return []
  const value = parseValue(answerPattern)
  if (answerPattern.type === 'exact_any' && Array.isArray(value)) return value.map(String)
  if (answerPattern.type === 'exact' && typeof value === 'string') return [value]
  return []
}

// ===================== Классификация шага =====================

/**
 * Решение по одному шагу.
 *
 * `structural` перебивает scope: если словарь ответа состоит из конструктивного
 * материала, шаг из сверки выходит, даже когда в задании мелькнуло цветовое
 * слово. Так считал аудит #1431, и это осознанно: ответ «валуны» не протухает
 * от того, что рядом в тексте стоит «зелёный».
 */
function classifyStep(step) {
  const answerPattern = step.answer_pattern || {}
  const task = norm(step.task)
  const dictWords = dictionaryValues(answerPattern)
  const dictSize = dictWords.length || 1
  // Половина словаря, а не одно совпадение: в списке из пятнадцати форм одна
  // случайно цветная строка не делает ответ цветовым.
  const half = Math.max(1, Math.ceil(dictSize * 0.5))
  const isExact = answerPattern.type === 'exact'

  // Задание спрашивает материал — нужно знать ДО разбора словаря: от этого
  // зависит, считать ли неоднозначные корни («зеркало», «прутья») материалом.
  const taskAsksMaterial = TASK_MATERIAL_PHRASES.some((p) => task.includes(norm(p)))

  const dictColors = dictWords.filter(isColorWord)
  const dictIsColor = dictColors.length > 0 && (isExact || dictColors.length >= half)

  const dictMaterials = dictWords.filter(
    (v) => isMaterialWord(v) && (taskAsksMaterial || !isAmbiguousMaterialWord(v)),
  )
  const dictIsMaterial = dictMaterials.length > 0 && (isExact || dictMaterials.length >= half)
  const dictSurface = dictWords.filter(isSurfaceMaterialWord)
  const dictIsSurfaceMaterial = dictSurface.length > 0 && (isExact || dictSurface.length >= half)

  const taskAsksColor = TASK_COLOR_PHRASES.some((p) => task.includes(norm(p)))
  const taskColorWords = task.split(/[^\p{L}]+/u).filter((w) => w.length > 3 && isColorWord(w))
  const taskHasColorWord = taskColorWords.length > 0
  // Цвет как фильтр счёта: «сколько ЗЕЛЁНЫХ башенок» протухает так же, как
  // прямой вопрос о цвете, хотя ответ там числовой.
  const countingWithColor = taskHasColorWord && /скольк|посчита|найди|назови/.test(task)

  const matched = dictIsColor || dictIsMaterial || taskAsksColor || taskAsksMaterial || countingWithColor
  if (!matched) return null

  const structural = dictIsMaterial && !dictIsSurfaceMaterial
  const reason = [
    dictIsColor ? 'dict-color' : null,
    dictIsMaterial ? (dictIsSurfaceMaterial ? 'dict-material-surface' : 'dict-material-structural') : null,
    taskAsksColor ? 'task-asks-color' : null,
    taskAsksMaterial ? 'task-asks-material' : null,
    taskHasColorWord ? 'task-color-word' : null,
  ].filter(Boolean).join('+')

  const markers = [
    ...dictColors.map((value) => ({ kind: 'dict-color', value: String(value) })),
    ...(dictIsSurfaceMaterial ? dictSurface.map((value) => ({ kind: 'dict-material-surface', value: String(value) })) : []),
    ...(taskAsksColor ? [{ kind: 'task-asks-color', value: 'формулировка' }] : []),
    ...(taskAsksMaterial ? [{ kind: 'task-asks-material', value: 'формулировка' }] : []),
    ...(countingWithColor ? taskColorWords.map((value) => ({ kind: 'task-color-word', value: String(value) })) : []),
  ]

  return { structural, reason, markers }
}

function scanQuests(bundles) {
  const findings = []
  const structural = []
  let scannedSteps = 0
  for (const bundle of bundles) {
    for (const step of bundle.steps || []) {
      scannedSteps += 1
      const verdict = classifyStep(step)
      if (!verdict) continue
      const row = {
        quest_db_id: bundle.id ?? null,
        quest_id: bundle.quest_id,
        step_db_id: step.id ?? null,
        step_id: step.step_id,
        title: step.title,
        task: step.task,
        answer_type: (step.answer_pattern || {}).type ?? null,
        reason: verdict.reason,
        markers: verdict.markers,
      }
      ;(verdict.structural ? structural : findings).push(row)
    }
  }
  return { findings, structural, scannedSteps }
}

// ===================== Baseline =====================

/**
 * Ключи находки — ПО ОДНОМУ на каждый признак. Не один общий ключ на шаг: если
 * автор поменяет принимаемый цвет с «синий» на «белый», ключ обязан смениться,
 * иначе baseline проглотит ровно то событие, ради которого скан существует, —
 * новый эталон без нового вердикта.
 */
function findingKeys(finding) {
  return finding.markers.map((m) => [finding.quest_id, finding.step_id ?? '', m.kind, m.value].join('|'))
}

/** Перезапись baseline по всем локальным данным квестов — единственный способ его пополнить. */
function updateBaseline(rootDir) {
  const known = {}
  let total = 0
  for (const file of localQuestDataFiles(rootDir, QUEST_DATA_FILE_PATTERN)) {
    const { findings } = scanQuests(loadLocalBundles(file, null))
    const keys = findings.flatMap(findingKeys).sort()
    if (!keys.length) continue
    known[file] = keys
    total += keys.length
  }
  writeBaseline(path.join(rootDir, BASELINE_PATH), {
    contractVersion: BASELINE_CONTRACT_VERSION,
    note: 'Снимок класса «поверхностный ответ» (правило 4f) в ЛОКАЛЬНЫХ данных на момент внедрения '
      + 'гарда — контент, написанный до появления правила. Это НЕ «разобрано сверкой #1431»: сверка '
      + 'шла по проду, а локальные файлы с ним штатно расходятся (правки #1431 применялись PATCH-ем '
      + 'прямо на прод, локальный mir-castle до сих пор несёт снятый оттуда цветовой вопрос). Смысл '
      + 'файла ровно один: check:fast падает только на том, что добавила правка, — новый цветовой или '
      + 'облицовочный ответ обязан получить датированное фото по порогу свежести 4f. Полный свип по '
      + 'проду (тот самый воспроизводимый аудит) — npm run quest:scan-surface-answer, он baseline не '
      + 'применяет и показывает весь класс. Конструктивный материал (камень, сруб, бетон, металл, '
      + 'стекло, а также материал самого произведения — зеркала мозаики, прутья плетёной фигуры) сюда '
      + 'не попадает вовсе: он вне scope правила. Снимается по файлам данных в рабочем дереве, поэтому '
      + 'обновлять его надо на дереве без чужих незавершённых правок. '
      + 'Обновлять: npm run quest:scan-surface-answer:baseline',
    known,
  })
  return { baselinePath: path.join(rootDir, BASELINE_PATH), files: Object.keys(known).length, total }
}

// ===================== Источники данных =====================

async function loadFromApi(apiUrl, questId) {
  const bundles = await fetchQuestBundles(apiUrl, questId)
  return bundles.map((bundle) => ({
    id: bundle.id,
    quest_id: bundle.quest_id,
    steps: parseSteps(bundle),
  }))
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

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.updateBaseline) {
    const result = updateBaseline(process.cwd())
    console.log(`Baseline перезаписан: ${BASELINE_PATH} — ${result.total} признаков в ${result.files} файлах.`)
    return
  }

  const quests = args.source
    ? loadLocalBundles(args.source, args.questId)
    : await loadFromApi(args.apiUrl, args.questId)

  const scanned = scanQuests(quests)
  const source = args.source || args.apiUrl
  // Baseline вычитается по имени файла-источника: гейт `check:fast` смотрит
  // ровно тот файл, который правит автор, и должен падать только на том, что
  // добавила правка. У прод-свипа источник другой, baseline к нему не
  // применяется — полный обход показывает весь класс целиком.
  const { fresh: findings, known: knownFindings } = args.baseline
    ? splitByBaseline(
      scanned.findings,
      loadBaseline(path.resolve(process.cwd(), args.baseline), BASELINE_CONTRACT_VERSION).known?.[source],
      findingKeys,
    )
    : { fresh: scanned.findings, known: [] }

  if (args.json) {
    console.log(JSON.stringify({
      source,
      quests: quests.length,
      scannedSteps: scanned.scannedSteps,
      candidates: scanned.findings.length,
      structural: scanned.structural.length,
      baseline: args.baseline,
      knownFindings: knownFindings.length,
      findings,
      structuralSteps: scanned.structural,
    }, null, 2))
  } else {
    console.log(
      `Скан 4f: ${source} — ${quests.length} квестов, ${scanned.scannedSteps} шагов; `
      + `в scope ${scanned.findings.length}, конструктивный материал ${scanned.structural.length} (вне scope).`,
    )
    for (const f of findings) {
      console.log(`\n  [quest ${f.quest_db_id ?? '?'}] ${f.quest_id} / шаг ${f.step_db_id ?? '?'} ${f.step_id}`)
      console.log(`    признак: ${f.reason} (${f.answer_type ?? 'без словаря'})`)
      console.log(`    ${f.task}`)
    }
    if (knownFindings.length) {
      console.log(`\nУчтено baseline (лежало в файле до правки): ${knownFindings.length}`)
    }
    console.log(findings.length
      ? `\nШагов без вердикта: ${findings.length}. Каждый требует датированного фото по порогу свежести 4f.`
      : '\nНеразобранных шагов нет.')
  }

  if (findings.length) process.exitCode = 1
}

module.exports = {
  BASELINE_PATH,
  BASELINE_CONTRACT_VERSION,
  COLOR_ROOTS,
  MATERIAL_SURFACE_ROOTS,
  MATERIAL_STRUCTURAL_ROOTS,
  classifyStep,
  dictionaryValues,
  findingKeys,
  isColorWord,
  isMaterialWord,
  isSurfaceMaterialWord,
  parseArgs,
  scanQuests,
  updateBaseline,
}

if (require.main === module) {
  main().catch((e) => {
    console.error('Fatal:', e.message || e)
    process.exit(1)
  })
}
