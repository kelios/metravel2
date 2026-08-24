#!/usr/bin/env node
/**
 * Скан утечки ответа в текст, который игрок читает ДО попытки — правило
 * авторинга 4a (`.claude/skills/metravel-quest/SKILL.md`): `hint` говорит КУДА
 * смотреть, но не содержит сам ответ и не называет точное число ответа.
 *
 * Правило живёт с #1190, но три прохода подряд (#1190, #1445, #1447) его
 * проверяли глазами — и каждый раз что-то проходило мимо. Этот скрипт закрывает
 * ровно механическую часть: буквальное совпадение принимаемого ответа с текстом.
 * Семантический класс (текст пересказывает ответ определением, без совпадения
 * слова — кейсы #1445) скан НЕ ловит, см. запись QUEST-HINT-LEAK-001 в
 * docs/PROBLEM_MEMORY.md.
 *
 * Две поверхности, у них разные пары «текст × ответ»:
 *   - ШАГ (`step`): поля шага против ответа ЭТОГО ЖЕ шага. Исторический контур.
 *   - КВЕСТ (`quest_title`, `intro`, `finale`): текст уровня квеста против
 *     ответов ВСЕХ шагов этого квеста. Интро игрок читает до первого шага,
 *     поэтому названный там ответ снимает вопрос любого шага впереди (#1488).
 *     Заголовок квеста читается ещё раньше и ещё шире: в каталоге, в шапке
 *     визарда на десктопе и в мета-описании страницы квеста, куда
 *     `buildQuestSeoMetadata` вставляет его ЦЕЛИКОМ (`utils/questSeo.js:96-99`),
 *     то есть в поисковой выдаче и в превью репоста (#1540). Сам `<title>`
 *     кламится и длинный заголовок обрезает — проверять надо описание. Заголовок, интро и финал приходят
 *     отдельными ключами бандла, а не элементами `steps`, — до #1488 скан не
 *     читал интро с финалом, а `title` не читал вовсе до #1540, и нулевой свип
 *     #1467 ни к одному из них не относился.
 *
 *   node scripts/scan-quest-hint-leak.js                      # весь прод
 *   node scripts/scan-quest-hint-leak.js --quest-id=vienna-imperial-secrets
 *   node scripts/scan-quest-hint-leak.js --source=scripts/vienna-quest-data.js
 *   node scripts/scan-quest-hint-leak.js --fields=hint,story,title,task,location
 *   node scripts/scan-quest-hint-leak.js --scopes=step,quest_title,intro,finale
 *   node scripts/scan-quest-hint-leak.js --json
 *
 * Exit code 1, если найдена хотя бы одна утечка.
 */

const path = require('path')

const { fetchQuestBundles, loadLocalBundles, parseSteps } = require('./lib/questBundles')
// Baseline — общий с другими аудит-сканами квестов механизм (#1450, #1488):
// загрузка, вычитание и запись живут в `scripts/lib/scanBaseline`, здесь только
// свои путь, версия контракта и функция ключей.
const { localQuestDataFiles, loadBaseline, splitByBaseline, writeBaseline } = require('./lib/scanBaseline')
// Что считается локальными данными квеста — знает скан достижимости, и шаблон
// имени живёт там в одном экземпляре: вторая копия однажды разойдётся, и гейт
// начнёт проверять не тот набор файлов, что baseline (#1450).
const { QUEST_DATA_FILE_PATTERN } = require('./scan-quest-answer-reachability')
// Нормализация — общая с рантаймом и со сканом достижимости (#1450): собственная
// копия правил разошлась бы с `utils/questAdapters.normalize` и молча изменила
// бы ответ «утечек нет».
const { normalizeAnswer: normalize } = require('./lib/questAnswerNormalize')

const DEFAULT_API = process.env.METRAVEL_API_URL || 'https://metravel.by'

// Поля шага, в которых ищем ответ. По умолчанию только `hint`: это тот контур,
// который правило 4a требует держать чистым безусловно. `title`/`story` шумят
// закономерно — шаг «Кривая башня» с вопросом «как называется башня» попадает в
// совпадение, оставаясь корректным, — поэтому включаются только флагом и в
// gate не входят.
//
// `location` (#1461, #1467) — подпись места. Она печатается игроку ДО попытки: в
// мастере строкой под заголовком шага (`questWizardStepCard.tsx:468`), в
// печатной версии в шапке шага и в таблице маршрута
// (`QuestPrintable.tsx:99,255`), в офлайн-экспорте именем и описанием точки
// (`questOfflineMapExport.ts:80-81`). Замер 18.08.2026 по проду дал 17 находок
// на 1256 шагах — все реальные утечки, шума нет; в #1467 все 17 переписаны, и
// прогон по проду стал нулевым. Поэтому поле переведено в умолчание: контур
// чист, и любая новая находка здесь — новая утечка, а не известный долг.
const DEFAULT_FIELDS = ['hint', 'location']
const KNOWN_FIELDS = new Set(['hint', 'story', 'title', 'task', 'location'])

// Поверхности текста. `--fields` управляет только шагом: у интро своя причина
// смотреть шире (см. INTRO_FIELDS), а у заголовка квеста и финала поле одно.
//
// Поверхность заголовка названа `quest_title`, а не `title`, намеренно: `title`
// уже занят как ПОЛЕ шага (`--fields=title`) и как поле интро, а это третий,
// самостоятельный ключ бандла — имя всего квеста (#1540). Одноимённая
// поверхность сделала бы ключ baseline `title|<quest>||title|<слово>`
// нечитаемым и путала бы флаги местами.
const KNOWN_SCOPES = new Set(['step', 'quest_title', 'intro', 'finale'])
// Поверхности уровня квеста: их пара — «текст квеста × ответы всех шагов».
const QUEST_LEVEL_SCOPES = ['quest_title', 'intro', 'finale']
// `finale` вне умолчания сознательно: экран финала игрок читает ПОСЛЕ последнего
// шага, а сам текст по замыслу пересказывает пройденный маршрут. Замер по проду
// 23.08.2026 — 99 находок на 149 квестов (две трети базы), то есть контур
// красный by design; в печатной версии он и помечен спойлером
// («Не подглядывай раньше времени: финал читают после последней точки»,
// `QuestPrintable.tsx:280`). Это принятое ограничение формата, как кросс-шаговый
// класс в печати, а не долг — но флаг оставлен, чтобы класс можно было измерить.
//
// `quest_title` в умолчании: заголовок — самый ранний и самый широкий текст
// квеста (каталог, шапка визарда на десктопе, мета-описание страницы, куда
// заголовок вставляется ЦЕЛИКОМ). Сплошной прогон по проду 24.08.2026 дал 14
// находок на 156 квестов; разобраны поштучно в #1540 — одна настоящая утечка
// («Свислочский цмок» при ответе шага «свислочь») переписана, остальные 13 —
// осознанный остаток и лежат в baseline. То есть контур пригоден для гейта, в
// отличие от финала, который красный by design на двух третях базы.
const DEFAULT_SCOPES = ['step', 'quest_title', 'intro']

// Поля интро. Шире, чем у шага, и это не непоследовательность: у интро НЕТ
// своего ответа, поэтому здесь нет самореференции, из-за которой `title`/`story`
// шага шумят закономерно. Любое совпадение в интро — это ответ ЧУЖОГО шага,
// прочитанный игроком заранее. `hint` у интро всегда пуст (отвечать там нечего).
const INTRO_FIELDS = ['title', 'location', 'story', 'task']

// Словарные типы: у них есть закрытый список принимаемых строк.
const DICT_TYPES = new Set(['exact_any', 'exact'])
// Числовые типы: утечка — это точное число (или любое число из диапазона)
// в тексте подсказки, запрет «их от 3 до 5» из того же правила 4a.
const NUMERIC_RANGE_TYPE = 'range'

// Короткие строки дают ложные срабатывания подстрокой («ум» внутри «думай»).
// На всей базе (912 шагов с непустым hint) порог 3 даёт ноль ложных
// срабатываний по `hint` и находит все три известных кейса #1447.
const MIN_VALUE_LENGTH = 3

// Baseline — тот же механизм, что у скана достижимости (#1450). Он нужен ровно
// поверхности `intro`: сплошной прогон 23.08.2026 дал 85 находок, 18 из них были
// настоящими утечками и переписаны в #1488, а оставшиеся 67 — осознанный остаток
// (совпадение внутри чужого слова, родовое существительное о другом объекте,
// собственное имя квеста). Без baseline контур пришлось бы держать вне
// умолчания, и он снова остался бы без охраны — как это и случилось с интро
// между #1467 и #1488. С baseline умолчание защищает: известное молчит, любая
// НОВАЯ находка роняет гейт сразу.
const BASELINE_PATH = 'scripts/quest-hint-leak-baseline.json'
const BASELINE_CONTRACT_VERSION = 1

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

/**
 * Словарь ответов всего квеста — с какого шага пришло каждое значение, иначе
 * находку невозможно разобрать: в интро на 2000 знаков надо знать, чей вопрос
 * испорчен.
 *
 * Числа сюда НЕ входят, и это измерено, а не срезано: свип 23.08.2026 дал 51
 * числовой хит в интро, и все 51 — адреса («Пролетарская, 5»), часы работы
 * («9:00–18:00»), длина маршрута («3,7 км») и маркеры списка «Что делать: 1) 2)
 * 3)», который стоит в каждом интро. У текста уровня квеста нет своего вопроса,
 * поэтому одиночная цифра в нём — это никогда не ответ шага, а всегда бытовое
 * число; на уровне шага ситуация обратная, и там числовой контур сохранён.
 */
function questAnswerDictionary(steps) {
  const answers = []
  for (const step of steps) {
    if (step.is_intro) continue
    for (const value of dictionaryValues(step.answer_pattern)) {
      answers.push({ value, step_db_id: step.id ?? null, step_id: step.step_id })
    }
  }
  return answers
}

// Окончание словоизменения: ОДНА последняя гласная (или «ь»/«й») слова, и
// только если от него остаётся минимум четыре буквы. Нужно, потому что словарь ответов
// записан в именительном падеже, а проза интро ставит то же слово в косвенный:
// «ротонда» из словаря шага 677 не является подстрокой «ротонду» в интро
// `sofia-serdica-underfoot`, «пуговица» шага 538 — подстрокой «пуговице» в
// интро `brest-lantern`. Ровно эти два примера и завели #1488, и наивное
// подстрочное совпадение их НЕ находит: без основы скан отчитался бы «чисто»
// по тем самым текстам, ради которых его расширяли.
//
// Границы подобраны замером, а не на глаз: срезание ДВУХ букв превращает
// «мария» в «мар» и ловит им «маршрут», а порог в три буквы оставляет от «роза»
// основу «роз» и ловит ею «розовый». Одна буква и минимум четыре в остатке
// снимают оба класса и сохраняют «ротонда» → «ротонду», «сосна» → «соснового»,
// «фонари» → «фонарей». Более длинные окончания («круглая» → «кругл») намеренно
// не трогаем: словарь ответа и так перечисляет свои формы.
const INFLECTION_TAIL = /(?<=\p{L}{4})[аеиоуыьэюяй]$/u

/**
 * Основа слова-ответа: «ротонда» → «ротонд», «сосна» → «сосн», «дуб» → «дуб»,
 * «роза» → «роза».
 *
 * Граница: для многословных значений путь через основу мёртв — окончание
 * срезается у всей строки, а сравнение идёт со словами текста, и основа с
 * пробелом («золотое рун») ни с одним словом не совпадёт. Это осознанно:
 * многословные значения почти всегда сопровождаются в том же словаре
 * однословными («руно» рядом с «золотое руно»), и их ловит подстрока.
 */
function answerStem(value) {
  return value.replace(INFLECTION_TAIL, '')
}

/** Начинается ли хоть одно слово текста с этой основы. */
function startsAnyWord(words, stem) {
  return words.some((word) => word.startsWith(stem))
}

/**
 * Утечки в тексте уровня квеста: ответы ВСЕХ шагов против одного текста.
 *
 * Совпадение — объединение двух правил, а не выбор одного:
 *   - подстрока в любом месте, как на уровне шага («перед валом» для «вал»);
 *   - основа с начала слова — она добирает косвенный падеж («ротонду»).
 * Объединение, потому что каждое правило по отдельности слепо к находкам
 * другого, а сузить контур у инструмента, который существует ради ответа
 * «утечек нет», дороже, чем разобрать лишнюю находку руками.
 */
function findQuestLeaks(text, answers) {
  const haystack = normalize(text)
  if (!haystack) return []
  const words = haystack.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  const leaks = []
  for (const { value, step_db_id, step_id } of answers) {
    const needle = normalize(value)
    if (needle.length < MIN_VALUE_LENGTH) continue
    const substring = haystack.includes(needle)
    const stem = answerStem(needle)
    const byStem = !substring && stem.length >= MIN_VALUE_LENGTH && startsAnyWord(words, stem)
    if (!substring && !byStem) continue
    leaks.push({ kind: 'dictionary', value, via: substring ? 'substring' : 'stem', step_db_id, step_id })
  }
  return leaks
}

function scanQuests(quests, fields, scopes = DEFAULT_SCOPES) {
  const wantedScopes = new Set(scopes)
  const findings = []
  let scannedSteps = 0
  let scannedQuestNodes = 0

  const pushFinding = (finding) => {
    if (finding.leaks.length) findings.push(finding)
  }

  for (const quest of quests) {
    const steps = quest.steps || []
    if (wantedScopes.has('step')) {
      for (const step of steps) {
        if (step.is_intro) continue
        scannedSteps++
        for (const field of fields) {
          pushFinding({
            quest_db_id: quest.id ?? null,
            quest_id: quest.quest_id,
            scope: 'step',
            step_db_id: step.id ?? null,
            step_id: step.step_id,
            field,
            answer_type: step.answer_pattern?.type ?? null,
            leaks: findLeaks(step, field),
            text: String(step[field] ?? ''),
          })
        }
      }
    }

    // Текст уровня квеста. Считаем узлы, а не квесты: «149 квестов» в отчёте
    // скрыло бы, сколько текста скан на самом деле прочитал (#1464).
    if (!QUEST_LEVEL_SCOPES.some((scope) => wantedScopes.has(scope))) continue
    const answers = questAnswerDictionary(steps)
    const questNodes = []
    // Заголовок квеста — самостоятельный ключ бандла, НЕ `intro.title`: пары
    // «`quest.title` × ответы шагов» до #1540 не существовало ни при одной
    // комбинации флагов.
    if (wantedScopes.has('quest_title')) {
      questNodes.push({ scope: 'quest_title', field: 'title', text: quest.title })
    }
    if (wantedScopes.has('intro') && quest.intro) {
      for (const field of INTRO_FIELDS) questNodes.push({ scope: 'intro', field, text: quest.intro[field] })
    }
    // Финал в локальных данных встречается в двух формах — `{text}` и `{story}`,
    // обе уезжают в одно поле прода (`sync-quest-to-prod.js:114`), поэтому
    // читаем обе, иначе `--source` слеп к финалу пяти квестов (#1464).
    if (wantedScopes.has('finale')) {
      questNodes.push({ scope: 'finale', field: 'finale', text: quest.finale?.text ?? quest.finale?.story })
    }
    for (const node of questNodes) {
      if (node.text == null || node.text === '') continue
      scannedQuestNodes++
      pushFinding({
        quest_db_id: quest.id ?? null,
        quest_id: quest.quest_id,
        scope: node.scope,
        step_db_id: null,
        step_id: null,
        field: node.field,
        answer_type: null,
        leaks: findQuestLeaks(node.text, answers),
        text: String(node.text),
      })
    }
  }
  return { findings, scannedSteps, scannedQuestNodes }
}

// ===================== Baseline =====================

/**
 * Ключи находки — ПО ОДНОМУ на каждое слово-ответ. Не один общий ключ на всю
 * находку: в интро совпадений часто несколько сразу, и склейка означала бы, что
 * правка одного слова делает «новыми» остальные, уже разобранные.
 */
function findingKeys(finding) {
  return finding.leaks.map((leak) => [finding.scope, finding.quest_id, finding.step_id ?? '', finding.field, leak.value].join('|'))
}

/**
 * Baseline держит ТОЛЬКО текст уровня квеста. Поля шага (`hint`, `location`)
 * вычищены до нуля в #1467 и обязаны оставаться жёстким гейтом: попади шаговая
 * находка в baseline — и красный прогон стал бы зелёным молча. Так и вышло на
 * первой редакции #1488: baseline, снятый с умолчанием `step,intro`, проглотил
 * реальную утечку подписи места. Поэтому фильтр стоит и на записи, и на чтении.
 */
const BASELINE_SCOPES = new Set(['quest_title', 'intro', 'finale'])

/** Находка шага в baseline не попадает никогда — она всегда «новая». */
function splitFindings(findings, knownKeys) {
  const scoped = splitByBaseline(
    findings.filter((f) => BASELINE_SCOPES.has(f.scope)),
    knownKeys,
    findingKeys,
  )
  return { fresh: [...findings.filter((f) => !BASELINE_SCOPES.has(f.scope)), ...scoped.fresh], known: scoped.known }
}

/** Перезапись baseline по всем локальным данным квестов — единственный способ его пополнить. */
function updateBaseline(rootDir, fields = DEFAULT_FIELDS, scopes = DEFAULT_SCOPES) {
  const known = {}
  let total = 0
  for (const file of localQuestDataFiles(rootDir, QUEST_DATA_FILE_PATTERN)) {
    const { findings } = scanQuests(loadLocalBundles(file, null), fields, scopes)
    const keys = findings.filter((f) => BASELINE_SCOPES.has(f.scope)).flatMap(findingKeys).sort()
    if (!keys.length) continue
    known[file] = keys
    total += keys.length
  }
  writeBaseline(path.join(rootDir, BASELINE_PATH), {
    contractVersion: BASELINE_CONTRACT_VERSION,
    note: 'Известные совпадения правила 4a в ТЕКСТЕ УРОВНЯ КВЕСТА (заголовок квеста, интро, финал) '
      + 'локальных данных — разобранный остаток #1488 и #1540: совпадение внутри чужого слова, родовое '
      + 'существительное о другом объекте, имя города и слово, которым назван сам квест. '
      + 'Поля шага сюда не попадают никогда: их контур вычищен до нуля и '
      + 'обязан падать сразу. Гейт check:fast падает только на том, что добавила правка. '
      + 'Снимается по файлам данных в рабочем дереве, поэтому обновлять его надо на дереве без чужих '
      + 'незавершённых правок. Обновлять: npm run quest:scan-hint-leak:baseline',
    known,
  })
  return { baselinePath: path.join(rootDir, BASELINE_PATH), files: Object.keys(known).length, total }
}

// ===================== Источники данных =====================
//
// Загрузка бандлов — в `scripts/lib/questBundles`: обход страниц каталога и
// ретраи там в одном экземпляре на все аудит-скрипты. В локальных данных
// `answer_pattern` уже объект, а не строка, поэтому форма совпадает с API и
// приводить ничего не нужно.

/**
 * Бандл API → форма, которую читает `scanQuests`.
 *
 * Вынесено отдельной функцией, потому что ровно здесь жил дефект #1540: маппинг
 * перечислял ключи вручную и `title` в список не попал, поэтому поверхность
 * заголовка молча читала undefined и отчитывалась «чисто» по прод-данным при
 * любых флагах. В локальных бандлах (`lib/questBundles.loadLocalBundles`) поле
 * есть с самого начала — то есть `--source` и `--api-url` расходились. Теперь
 * маппинг покрыт тестом: любой новый ключ уровня квеста обязан появиться и тут,
 * иначе прод-контур скана слепнет незаметно.
 */
function toScanBundle(bundle) {
  return {
    id: bundle.id,
    quest_id: bundle.quest_id,
    title: bundle.title ?? null,
    intro: bundle.intro ?? null,
    finale: bundle.finale ?? null,
    steps: parseSteps(bundle),
  }
}

async function loadFromApi(apiUrl, questId) {
  const bundles = await fetchQuestBundles(apiUrl, questId)
  return bundles.map(toScanBundle)
}

// ===================== CLI =====================

function parseArgs(argv) {
  const get = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=')
  const fields = (get('fields') || DEFAULT_FIELDS.join(',')).split(',').map((f) => f.trim()).filter(Boolean)
  for (const field of fields) {
    if (!KNOWN_FIELDS.has(field)) throw new Error(`неизвестное поле --fields=${field}`)
  }
  const scopes = (get('scopes') || DEFAULT_SCOPES.join(',')).split(',').map((s) => s.trim()).filter(Boolean)
  for (const scope of scopes) {
    if (!KNOWN_SCOPES.has(scope)) throw new Error(`неизвестная поверхность --scopes=${scope}`)
  }
  return {
    apiUrl: get('api-url') || DEFAULT_API,
    questId: get('quest-id') || null,
    source: get('source') || null,
    fields,
    scopes,
    baseline: get('baseline') || null,
    updateBaseline: argv.includes('--update-baseline'),
    json: argv.includes('--json'),
  }
}

const SCOPE_LABEL = { step: 'шаг', quest_title: 'заголовок квеста', intro: 'интро', finale: 'финал' }

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.updateBaseline) {
    // Умолчание, а НЕ `args.scopes`: baseline хранит только текст уровня квеста,
    // и прогон с набором без `intro` перезаписал бы файл пустым объектом —
    // следующий `check:fast` покраснел бы на 68 уже разобранных находках.
    const result = updateBaseline(process.cwd(), args.fields, DEFAULT_SCOPES)
    console.log(`Baseline перезаписан: ${BASELINE_PATH} — ${result.total} находок в ${result.files} файлах.`)
    return
  }
  const quests = args.source
    ? loadLocalBundles(args.source, args.questId)
    : await loadFromApi(args.apiUrl, args.questId)

  const scanned = scanQuests(quests, args.fields, args.scopes)
  const { scannedSteps, scannedQuestNodes } = scanned
  const source = args.source || args.apiUrl
  // Baseline вычитается по имени файла-источника: гейт `check:fast` смотрит
  // ровно тот файл, который правит автор, и должен падать только на том, что
  // добавила правка.
  const { fresh: findings, known: knownFindings } = args.baseline
    ? splitFindings(
      scanned.findings,
      loadBaseline(path.resolve(process.cwd(), args.baseline), BASELINE_CONTRACT_VERSION).known?.[source],
    )
    : { fresh: scanned.findings, known: [] }

  if (args.json) {
    console.log(JSON.stringify(
      {
        source,
        quests: quests.length,
        scannedSteps,
        scannedQuestNodes,
        fields: args.fields,
        scopes: args.scopes,
        baseline: args.baseline,
        knownFindings: knownFindings.length,
        findings,
      },
      null,
      2,
    ))
  } else {
    console.log(
      `Скан 4a: ${source} — ${quests.length} квестов, ${scannedSteps} шагов, ` +
        `${scannedQuestNodes} текстов квеста, поля шага: ${args.fields.join(', ')}, поверхности: ${args.scopes.join(', ')}`,
    )
    for (const f of findings) {
      const values = f.leaks
        .map((l) => `${l.value}${l.kind === 'numeric' ? ' (число)' : ''}${l.step_db_id ? ` → шаг ${l.step_db_id}` : ''}`)
        .join(', ')
      const where = f.scope === 'step'
        ? `шаг ${f.step_db_id ?? '?'} ${f.step_id}`
        : SCOPE_LABEL[f.scope]
      console.log(`\n  [quest ${f.quest_db_id ?? '?'}] ${f.quest_id} / ${where}`)
      console.log(`    поле ${f.field} (${f.answer_type ?? 'ответы всех шагов'}) содержит ответ: ${values}`)
      console.log(`    ${f.text}`)
    }
    if (knownFindings.length) {
      console.log(`\nУчтено baseline (лежало в файле до правки, разобрано в QUEST-HINT-LEAK-001): ${knownFindings.length}`)
    }
    console.log(findings.length ? `\nУтечек: ${findings.length}` : '\nУтечек нет.')
  }

  if (findings.length) process.exitCode = 1
}

module.exports = {
  BASELINE_PATH,
  BASELINE_SCOPES,
  findingKeys,
  splitFindings,
  updateBaseline,
  normalize,
  dictionaryValues,
  numericValues,
  findLeaks,
  answerStem,
  questAnswerDictionary,
  findQuestLeaks,
  scanQuests,
  toScanBundle,
  parseArgs,
  INTRO_FIELDS,
  KNOWN_SCOPES,
  QUEST_LEVEL_SCOPES,
}

if (require.main === module) {
  main().catch((e) => {
    console.error('Fatal:', e.message || e)
    process.exit(1)
  })
}
