#!/usr/bin/env node
/**
 * Скан глубины историй квеста ДО публикации — класс
 * QUEST-CITY-LANDING-VALUE-001 (`docs/PROBLEM_MEMORY.md`, #1998).
 *
 * Две страницы квеста собираются из одного поля `steps[].story`, и сборка прода
 * меряет обе тем же кодом, что и этот скан:
 *
 * - детальная `/quests/<город>/<quest_id>` публикует ДАЙДЖЕСТ каждой точки —
 *   первые предложения рассказа (`utils/questStoryText.js`: 2 предложения /
 *   60 слов) — и обязана нести не меньше `MIN_QUEST_PAGE_WORDS` слов прозы
 *   (#1930);
 * - посадочная города `/quests/<город>` публикует ХВОСТ рассказа после
 *   дайджеста (`utils/questCityWalk.js`) — ровно то, чего на детальной нет.
 *   Нет хвоста — нет заметок о местах, и городу нечего рассказать сверх
 *   карточки квеста (#1569).
 *
 * Партия 19.09.2026 писалась историями в 1–2 предложения (6–42 слова):
 * дайджест забирал их целиком, хвост оставался пустым, и 20.09.2026
 * `./build-prod.sh prod` упал на 15 городах, а после хотфикса #1569 20
 * посадочных и 2 детальные ушли под `noindex, follow`. Ни один скан семейства
 * `scan-quest-*` объём story не мерил, поэтому партия дошла до сборки прода —
 * первого места, где это стало видно. Этот скан закрывает разрыв на этапе
 * публикации: без сети, без 15-минутной сборки, по одному data-файлу.
 *
 * Что меряется по одному квесту:
 * - `places` — сколько точек оставляют хотя бы одно хвостовое предложение для
 *   заметок города (`buildQuestCityWalkModel` для города из этого одного
 *   квеста — ровно случай нового города, где других квестов нет);
 * - `detailWords` — слова прозы SSG-среза детальной (`injectQuestIntroSection`
 *   → `questPageFromHtml` → `countWords`) без блока перелинковки: он зависит от
 *   каталога, а подписи ссылок в прозу и так не считаются, так что здесь цифра
 *   на несколько слов консервативнее сборки.
 * Чего скан НЕ меряет: долю собственной лексики уровня (#1930, ≥ 30%) — она
 * относительна набору страниц и считается только по всему каталогу на сборке.
 *
 * Квест не проходит при `places = 0` или `detailWords < 300`. Лечится не
 * порогом, а текстом: не меньше четырёх предложений на точку — первые два
 * (до 60 слов) описывают объект для детальной, следующие — факты о месте для
 * города: без обращения к игроку, без вопроса и без слов ответа своей и
 * соседних точек, иначе хвост их отфильтрует и заметки не будет.
 *
 *   node scripts/scan-quest-city-walk.js --source=scripts/<city>-quest-data.js
 *   node scripts/scan-quest-city-walk.js --quest-id=tartu-bridge-wish
 *   node scripts/scan-quest-city-walk.js                     # весь прод
 *   node scripts/scan-quest-city-walk.js --json
 *
 * Exit code 1, если хотя бы один квест выборки не берёт порог.
 */

const { fetchQuestBundles, loadLocalBundles } = require('./lib/questBundles')
const { MIN_QUEST_PAGE_WORDS, countWords, questPageFromHtml } = require('./lib/questPageDepth')
const { buildQuestCityWalkModel } = require('../utils/questCityWalk')
const { getQuestSteps } = require('../utils/questStoryText')
const { buildQuestSeoMetadata, injectQuestIntroSection } = require('./generate-seo-pages')
const {
  parseCliArgs,
  parseCliTokens,
  requireNonEmptySelection,
  requireNoBatchFailures,
  runCli,
} = require('./lib/cli-contract')

const DEFAULT_API = process.env.METRAVEL_API_URL || 'https://metravel.by'

/**
 * Пустая страница-носитель: меряется только crawlable-секция, которую в неё
 * впишет генератор, поэтому шаблон `dist/` для замера не нужен.
 */
const EMPTY_PAGE =
  '<!doctype html><html><head><title>quest</title></head><body><div id="root"></div></body></html>'

// ===================== Замер =====================

/** Карточка каталога, какой её видит сборка, — собранная из бандла. */
function catalogQuestOf(bundle, steps) {
  return {
    quest_id: String(bundle?.quest_id || '').trim(),
    title: String(bundle?.title || '').trim(),
    city_name: String(bundle?.city?.name || bundle?.city_name || '').trim(),
    points: steps.length,
    duration_min: bundle?.duration_min ?? bundle?.meta?.duration_min ?? null,
  }
}

/**
 * Слова прозы SSG-среза детальной страницы — тем же путём, каким их пишет и
 * меряет сборка (`generate-seo-pages.js` → `questPageDepth.js`).
 */
function detailPageWords(bundle, steps = getQuestSteps(bundle)) {
  const quest = catalogQuestOf(bundle, steps)
  const { description } = buildQuestSeoMetadata({
    title: quest.title,
    cityName: quest.city_name,
    points: quest.points,
    durationMin: quest.duration_min,
  })
  const html = injectQuestIntroSection(EMPTY_PAGE, {
    title: quest.title,
    description,
    quest,
    bundle,
    links: null,
  })
  return countWords(questPageFromHtml(html, `/quests/x/${quest.quest_id}`).text)
}

function inspectQuest(bundle, options = {}) {
  const minWords = Number.isFinite(options.minWords) ? options.minWords : MIN_QUEST_PAGE_WORDS
  const steps = getQuestSteps(bundle)
  const quest = catalogQuestOf(bundle, steps)
  const walk = buildQuestCityWalkModel([quest], { [quest.quest_id]: bundle })
  const walkSentences = walk.places.reduce((sum, place) => sum + place.sentences.length, 0)
  const detailWords = detailPageWords(bundle, steps)

  const issues = []
  if (walk.places.length === 0) {
    issues.push(
      `ни одна из ${steps.length} точек не оставляет хвоста после дайджеста — посадочной города нечего публиковать`,
    )
  }
  if (detailWords < minWords) {
    issues.push(`${detailWords} слов прозы на детальной странице, порог ${minWords}`)
  }

  return {
    quest_id: quest.quest_id,
    quest_db_id: bundle?.id ?? null,
    title: quest.title,
    steps: steps.length,
    places: walk.places.length,
    otherPlaces: walk.otherPlaces.length,
    walkSentences,
    detailWords,
    minWords,
    issues,
  }
}

function scanQuests(bundles, options = {}) {
  const results = (Array.isArray(bundles) ? bundles : []).map((bundle) => inspectQuest(bundle, options))
  return { results, findings: results.filter((result) => result.issues.length > 0) }
}

// ===================== CLI =====================

const USAGE = `Скан глубины историй квеста: хвост для заметок города и слова детальной — QUEST-CITY-LANDING-VALUE-001

Usage:
  node scripts/scan-quest-city-walk.js [--quest-id <id>] [--source <file>] [--api-url <url>] [--json]

Options:
  --quest-id <id>       один квест вместо всего корпуса
  --source <file>       локальный data-файл вместо прода
  --api-url <url>       адрес прода (по умолчанию METRAVEL_API_URL или https://metravel.by)
  --json                machine-readable результат на stdout
  --help, -h            напечатать эту справку и выйти`

const CLI_SPEC = {
  name: 'scan-quest-city-walk',
  usage: USAGE,
  selection: 'quests',
  flags: {
    'api-url': { type: 'string', default: DEFAULT_API, stripTrailingSlash: true },
    'quest-id': { type: 'string' },
    source: { type: 'string' },
    json: { type: 'boolean' },
  },
}

const parseArgs = (tokens) => parseCliTokens(tokens, CLI_SPEC)

function formatResult(result) {
  const mark = result.issues.length ? '❌' : '✅'
  const lines = [
    `  ${mark} ${result.quest_id} — точек ${result.steps}, заметок для города ${result.places}` +
      ` (${result.walkSentences} предл.), детальная ${result.detailWords} слов (порог ${result.minWords})`,
  ]
  for (const issue of result.issues) lines.push(`       - ${issue}`)
  return lines.join('\n')
}

async function main() {
  const args = parseCliArgs(process.argv, CLI_SPEC)
  const bundles = requireNonEmptySelection(
    args.source
      ? loadLocalBundles(args.source, args.questId)
      : await fetchQuestBundles(args.apiUrl, args.questId),
    {
      what: 'квестов',
      source: args.source || args.apiUrl,
      hint: 'проверь --source / --quest-id / --api-url',
    },
  )

  const source = args.source || args.apiUrl
  const { results, findings } = scanQuests(bundles)

  if (args.json) {
    console.log(JSON.stringify({ source, quests: results.length, minWords: MIN_QUEST_PAGE_WORDS, findings, results }, null, 2))
  } else {
    console.log(`Скан глубины историй квестов: ${source} — ${results.length} квестов`)
    for (const result of results) console.log(formatResult(result))
    console.log(findings.length
      ? `\nКвестов ниже порога: ${findings.length} из ${results.length} — дописать story точек (≥ 4 предложения: два для дайджеста, дальше факты о месте без обращения к игроку и без слов ответа).`
      : '\nВсе квесты выборки берут порог: у города есть заметки, детальная не тоньше порога.')
  }

  requireNoBatchFailures(findings.length, {
    total: results.length,
    message: `квестов без хвоста для города или тоньше порога детальной: ${findings.length}`,
  })
}

module.exports = {
  CLI_SPEC,
  EMPTY_PAGE,
  USAGE,
  catalogQuestOf,
  detailPageWords,
  inspectQuest,
  parseArgs,
  scanQuests,
}

if (require.main === module) {
  runCli(main, { name: CLI_SPEC.name, usage: USAGE })
}
