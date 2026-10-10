#!/usr/bin/env node
/**
 * Скан обращений к кнопке, которой в мастере квеста нет.
 *
 * Текст шага вправе звать игрока нажать кнопку — но только ту, что мастер
 * действительно показывает: на шаге без проверяемого ответа (`any`) это
 * «Далее», на шаге с полем ввода — «Проверить ответ»
 * (`components/quests/questWizardStepCard.tsx`, ветка `isAutoPassStep`).
 * Опциональные привалы при этом годами копировали шаблон «нажми „Ответить“ и
 * продолжай маршрут» либо «нажми „Дальше“»: игрок ищет кнопку, которой нет, а
 * переводчик (#2199) тащит несуществующую подпись в пять локалей — именно так
 * сбой всплыл при переводе 07.10.2026 (gomel-palace 349/227, minsk-cmok 215,
 * krevo-walled-maiden 800, golshany-black-monk 763, minsk-teens-oktyabrskaya
 * 1133/1134, minsk-cinema 1158). `scan-quest-skip-promise.js` ловит только
 * «Пропустить» — у него другой дефект (обещание выхода, которого нет).
 *
 * Что считается обращением к кнопке: подпись в «ёлочках», перед которой в той
 * же фразе стоит глагол действия («нажми», «жми», «тапни», «кликни», «выбери»)
 * или слово «кнопка»/«ссылка». Эталон подписей — ТОЛЬКО русские строки
 * интерфейса квестов из `i18n/locales/ru` (`components.quests.*`,
 * `utils.quest*`): это тот же источник, из которого задание перевода берёт
 * `ui_labels`, поэтому скан и переводчик не могут разойтись в том, какие
 * кнопки существуют. Своего списка «правильных» подписей у скана нет.
 *
 * Чего скан НЕ ловит и не должен: цитаты без глагола действия («табличка
 * „Вход“»), названия мест и надписи «как на табличке» — у них перед кавычкой
 * нет приглашения нажать.
 *
 *   node scripts/scan-quest-button-labels.js                               # весь прод
 *   node scripts/scan-quest-button-labels.js --quest-id=gomel-palace
 *   node scripts/scan-quest-button-labels.js --source=scripts/gomel-palace-quest-data.js
 *   node scripts/scan-quest-button-labels.js --json
 *
 * Exit code 1, если найдено хотя бы одно обращение к несуществующей кнопке.
 */

const path = require('path')

const { fetchQuestBundles, loadLocalBundles, parseSteps } = require('./lib/questBundles')
const { readQuestUiStrings } = require('./lib/questTranslation/task')
const {
  parseCliArgs,
  parseCliTokens,
  requireNonEmptySelection,
  requireNoBatchFailures,
  runCli,
} = require('./lib/cli-contract')

const DEFAULT_API = process.env.METRAVEL_API_URL || 'https://metravel.by'
const DEFAULT_LOCALES_DIR = path.join(__dirname, '..', 'i18n', 'locales')

const USAGE = `Скан обращений к кнопке, которой в мастере квеста нет

Usage:
  node scripts/scan-quest-button-labels.js [--quest-id <id>] [--source <file>] [--api-url <url>] [--json]

Options:
  --quest-id <id>       один квест вместо всего корпуса
  --source <file>       локальный data-файл вместо прода
  --api-url <url>       адрес прода (по умолчанию METRAVEL_API_URL или https://metravel.by)
  --json                machine-readable результат на stdout
  --help, -h            напечатать эту справку и выйти`

const CLI_SPEC = {
  name: 'scan-quest-button-labels',
  usage: USAGE,
  selection: 'quests',
  flags: {
    'api-url': { type: 'string', default: DEFAULT_API, stripTrailingSlash: true },
    'quest-id': { type: 'string' },
    source: { type: 'string' },
    json: { type: 'boolean' },
  },
}

/** Поля шага, которые игрок читает у карточки: задание, рассказ и подсказка. */
const SCANNED_FIELDS = ['task', 'story', 'hint']

/** Типы ответа, на которых мастер показывает одну кнопку «Далее» без поля ввода. */
const AUTO_PASS_TYPES = new Set(['any'])

/** Ключи i18n двух кнопок мастера — подписи, которые скан предлагает взамен. */
const NEXT_LABEL_KEY = 'components.quests.questWizardStepCard.dalee_74add698'
const CHECK_LABEL_KEY = 'components.quests.questWizardStepCard.proverit_otvet_76814505'
const START_LABEL_KEY = 'components.quests.questWizardStepCard.nachat_kvest_2847e749'

/** Подпись в «ёлочках» длиной от 2 до 40 знаков — больше кнопка не бывает. */
const QUOTED_LABEL_RE = /«([^«»\n]{2,40})»/gu

/**
 * Приглашение нажать: глагол действия или слово «кнопка»/«ссылка» в той же
 * фразе перед кавычкой. Окно обрывается на конце предложения, чтобы глагол из
 * соседней фразы не превращал обычную цитату в кнопку. «Выбери» сюда не
 * входит: «выбери самый „детективный“ вкус» (warsaw-kids / icecream) — это
 * выбор мороженого, а не элемента интерфейса.
 */
const BUTTON_ACTION_RE = /(?:нажм|жми|тапн|кликн|кнопк|ссылк)[^.!?«»]{0,40}$/iu

/** Нормализация для сравнения подписей: регистр, ё и пробелы не значимы. */
const foldLabel = (value) => String(value ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()

/**
 * Эталон подписей интерфейса квестов и две подписи мастера для предложения
 * замены. Читается один раз на прогон.
 */
function loadUiLabels(localesDir = DEFAULT_LOCALES_DIR) {
  const strings = readQuestUiStrings('ru', localesDir)
  const known = new Set([...strings.values()].map(foldLabel))
  const next = strings.get(NEXT_LABEL_KEY)
  const check = strings.get(CHECK_LABEL_KEY)
  const start = strings.get(START_LABEL_KEY)
  if (!next || !check || !start) throw new Error(`${localesDir}/ru: нет подписей кнопок мастера (${NEXT_LABEL_KEY}, ${CHECK_LABEL_KEY}, ${START_LABEL_KEY})`)
  return { known, next, check, start }
}

/** Обращения к несуществующей кнопке в одном поле шага. */
function findUnknownButtonLabels(text, uiLabels) {
  const source = String(text ?? '')
  if (!source) return []
  const hits = []
  for (const match of source.matchAll(QUOTED_LABEL_RE)) {
    const label = match[1].trim()
    const before = source.slice(Math.max(0, match.index - 60), match.index)
    if (!BUTTON_ACTION_RE.test(before)) continue
    if (uiLabels.known.has(foldLabel(label))) continue
    hits.push({
      label,
      excerpt: source.slice(Math.max(0, match.index - 45), match.index + match[0].length + 15).trim(),
    })
  }
  return hits
}

function scanQuests(quests, uiLabels) {
  const findings = []
  let scannedSteps = 0
  for (const quest of quests) {
    const steps = [...(quest.intro ? [quest.intro] : []), ...(quest.steps || [])]
    for (const step of steps) {
      scannedSteps++
      const type = step.answer_pattern?.type ?? 'any'
      const expected = step === quest.intro || step.is_intro ? uiLabels.start : AUTO_PASS_TYPES.has(type) ? uiLabels.next : uiLabels.check
      for (const field of SCANNED_FIELDS) {
        const hits = findUnknownButtonLabels(step[field], uiLabels)
        if (!hits.length) continue
        findings.push({
          quest_db_id: quest.id ?? null,
          quest_id: quest.quest_id,
          step_db_id: step.id ?? null,
          step_id: step.step_id,
          answer_type: type,
          field,
          expected,
          hits,
        })
      }
    }
  }
  return { findings, scannedSteps }
}

// ===================== Источники данных =====================

function toScanBundle(bundle) {
  const steps = parseSteps(bundle)
  const intro = bundle.intro && bundle.intro.id != null && !steps.some((step) => step.id === bundle.intro.id)
    ? bundle.intro
    : null
  return { id: bundle.id, quest_id: bundle.quest_id, intro, steps }
}

async function loadFromApi(apiUrl, questId) {
  const bundles = await fetchQuestBundles(apiUrl, questId)
  return bundles.map(toScanBundle)
}

function loadFromFile(sourceFile, questId) {
  return loadLocalBundles(sourceFile, questId).map((bundle) => ({
    id: bundle.id,
    quest_id: bundle.quest_id,
    intro: bundle.intro,
    steps: bundle.steps,
  }))
}

// ===================== CLI =====================

const parseArgs = (tokens) => parseCliTokens(tokens, CLI_SPEC)

async function main() {
  const args = parseCliArgs(process.argv, CLI_SPEC)
  const quests = requireNonEmptySelection(
    args.source ? loadFromFile(args.source, args.questId) : await loadFromApi(args.apiUrl, args.questId),
    {
      what: 'квестов',
      source: args.source || args.apiUrl,
      hint: 'проверь --source / --quest-id / --api-url',
    },
  )

  const uiLabels = loadUiLabels()
  const { findings, scannedSteps } = scanQuests(quests, uiLabels)
  const source = args.source || args.apiUrl

  if (args.json) {
    console.log(JSON.stringify({ source, quests: quests.length, scannedSteps, findings }, null, 2))
  } else {
    console.log(`Скан кнопок мастера: ${source} — ${quests.length} квестов, ${scannedSteps} шагов`)
    for (const f of findings) {
      console.log(`\n  [quest ${f.quest_db_id ?? '?'}] ${f.quest_id} / шаг ${f.step_db_id ?? '?'} ${f.step_id}`)
      console.log(`    поле ${f.field} (${f.answer_type}) зовёт нажать ${f.hits.map((h) => `«${h.label}»`).join(', ')} — в мастере здесь «${f.expected}»: ${f.hits.map((h) => h.excerpt).join(' | ')}`)
    }
    console.log(findings.length ? `\nОбращений к несуществующей кнопке: ${findings.length}` : '\nОбращений к несуществующей кнопке нет.')
  }

  requireNoBatchFailures(findings.length, {
    total: Math.max(findings.length, quests.length),
    message: `обращений к несуществующей кнопке: ${findings.length}`,
  })
}

module.exports = {
  AUTO_PASS_TYPES,
  SCANNED_FIELDS,
  findUnknownButtonLabels,
  loadUiLabels,
  scanQuests,
  toScanBundle,
  parseArgs,
}

if (require.main === module) {
  runCli(main, { name: CLI_SPEC.name, usage: USAGE })
}
