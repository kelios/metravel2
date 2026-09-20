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
 *   Нет хвоста — нет заметок о местах (#1569); одна-две заметки страницу тоже
 *   не спасают: тот же порог #1930 снимает с выдачи и такой город.
 *
 * Партия 19.09.2026 писалась историями в 1–2 предложения (6–42 слова):
 * дайджест забирал их целиком, хвост оставался пустым, и 20.09.2026
 * `./build-prod.sh prod` упал на 15 городах, а после хотфикса #1569 20
 * посадочных и 2 детальные ушли под `noindex, follow`. Ни один скан семейства
 * `scan-quest-*` объём story не мерил, поэтому партия дошла до сборки прода —
 * первого места, где это стало видно. Этот скан закрывает разрыв на этапе
 * публикации: без сети, без 15-минутной сборки, по одному data-файлу.
 *
 * Что меряется по одному квесту — слова прозы ОБЕИХ страниц, собранных теми же
 * функциями, какими их пишет сборка, для города, где этот квест единственный
 * (ровно случай новой партии; в городе с другими квестами посадочная считается
 * по всем им и порог берёт легче):
 * - `cityWords` — посадочная города (`buildQuestCityLandingModel` →
 *   `buildQuestCityLandingHtml`), где собственный текст города — это заметки о
 *   местах (`places`, они же хвосты историй);
 * - `detailWords` — SSG-срез детальной (`injectQuestIntroSection` →
 *   `questPageFromHtml` → `countWords`).
 *
 * Обе цифры заведомо НИЖЕ сборочных, и это осознанный перекос гейта в сторону
 * «допиши»: до заливки каталога ещё нет, поэтому в замер не входят блок
 * перелинковки детальной (≈20–35 слов), факт «Время: примерно …» (длительность
 * знает карточка каталога, `QuestBundleSerializer` её не отдаёт), название
 * страны, соседние города и статьи путешественников на посадочной (≈15–60
 * слов). Ни одна из этих строк не зависит от `story`, автором квеста не
 * пишется и на проде только прибавляет слов.
 * Чего скан НЕ меряет вовсе: долю собственной лексики уровня (#1930, ≥ 30%) —
 * она относительна набору страниц и считается только по всему каталогу на
 * сборке.
 *
 * Квест не проходит, когда любая из двух страниц ниже `MIN_QUEST_PAGE_WORDS`.
 * Лечится не порогом, а текстом: не меньше четырёх предложений на точку —
 * первые два (до 60 слов) описывают объект для детальной, следующие — факты о
 * месте для города: без обращения к игроку, без вопроса и без слов ответа своей
 * и соседних точек, иначе хвост их отфильтрует и заметки не будет.
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
const { buildQuestCityAliasMap } = require('../utils/questCityAlias')
const { getQuestSteps } = require('../utils/questStoryText')
const {
  buildQuestCityLandingHtml,
  buildQuestCityLandingModel,
  buildQuestSeoMetadata,
  injectQuestIntroSection,
} = require('./generate-seo-pages')
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

/**
 * Числовой `city_id` выдаёт бэкенд при заливке, а группировка каталога без него
 * посадочную не построит вовсе. В текст страницы идентификатор не попадает — он
 * адресует её (`/quests/<id>`), — поэтому для замера берётся заглушка.
 */
const CITY_ID_PLACEHOLDER = 'city'

// ===================== Замер =====================

/** Карточка каталога, какой её видит сборка, — собранная из бандла. */
function catalogQuestOf(bundle, steps) {
  return {
    quest_id: String(bundle?.quest_id || '').trim(),
    title: String(bundle?.title || '').trim(),
    city_name: String(bundle?.city?.name || bundle?.city_name || '').trim(),
    points: steps.length,
    // Длительность живёт в карточке каталога: бандл её не отдаёт ни с прода
    // (`QuestBundleSerializer`), ни из data-файла (`loadLocalBundles` держит
    // форму API), поэтому замер идёт без неё — см. перекос гейта в шапке файла.
    // Поле читается тем же выражением, что и у сборки: начнёт приходить —
    // подтянется само, а расходиться двум меркам тут нельзя.
    duration_min: bundle?.duration_min ?? null,
  }
}

/**
 * Посадочная города — тем же путём, каким её собирает и меряет сборка
 * (`generate-seo-pages.js` → `questPageDepth.js`), для города из одного этого
 * квеста: слова её прозы и та самая модель заметок, из которой они получились.
 * Модель берётся из посадочной, а не считается рядом вторым вызовом, иначе
 * отчёт называл бы заметки, которых на померенной странице может не быть.
 */
function cityPageOf(quest, bundle) {
  const catalogQuest = { ...quest, city_id: CITY_ID_PLACEHOLDER }
  const [city] = buildQuestCityLandingModel(
    [catalogQuest],
    buildQuestCityAliasMap([catalogQuest]),
    [],
    { [catalogQuest.quest_id]: bundle },
  )
  if (!city) return { walk: { places: [], otherPlaces: [] }, words: 0 }
  const html = buildQuestCityLandingHtml(EMPTY_PAGE, city, null)
  return { walk: city.walk, words: countWords(questPageFromHtml(html, city.landingPath).text) }
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

/** Почему посадочной города не хватило слов — объём лечится только текстом точек. */
function cityGapReason(places, steps) {
  if (steps === 0) return 'у квеста нет точек'
  if (places === 0) {
    return `ни одна из ${steps} точек не оставляет хвоста после дайджеста — публиковать сверх шаблона нечего`
  }
  return `заметок о местах ${places} из ${steps} точек`
}

function inspectQuest(bundle) {
  const steps = getQuestSteps(bundle)
  const quest = catalogQuestOf(bundle, steps)
  const { walk, words: cityWords } = cityPageOf(quest, bundle)
  const walkSentences = walk.places.reduce((sum, place) => sum + place.sentences.length, 0)
  const detailWords = detailPageWords(bundle, steps)

  const issues = []
  if (cityWords < MIN_QUEST_PAGE_WORDS) {
    issues.push(
      `${cityWords} слов прозы на посадочной города, порог ${MIN_QUEST_PAGE_WORDS}` +
        ` — ${cityGapReason(walk.places.length, steps.length)}`,
    )
  }
  if (detailWords < MIN_QUEST_PAGE_WORDS) {
    issues.push(`${detailWords} слов прозы на детальной странице, порог ${MIN_QUEST_PAGE_WORDS}`)
  }

  return {
    quest_id: quest.quest_id,
    quest_db_id: bundle?.id ?? null,
    title: quest.title,
    steps: steps.length,
    places: walk.places.length,
    otherPlaces: walk.otherPlaces.length,
    walkSentences,
    cityWords,
    detailWords,
    minWords: MIN_QUEST_PAGE_WORDS,
    issues,
  }
}

function scanQuests(bundles) {
  const results = (Array.isArray(bundles) ? bundles : []).map((bundle) => inspectQuest(bundle))
  return { results, findings: results.filter((result) => result.issues.length > 0) }
}

// ===================== CLI =====================

const USAGE = `Скан глубины историй квеста: слова посадочной города и детальной — QUEST-CITY-LANDING-VALUE-001

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
      ` (${result.walkSentences} предл.), посадочная ${result.cityWords} слов,` +
      ` детальная ${result.detailWords} слов (порог ${result.minWords})`,
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
      : '\nВсе квесты выборки берут порог: и посадочная города, и детальная не тоньше порога.')
  }

  requireNoBatchFailures(findings.length, {
    total: results.length,
    message: `квестов, чья посадочная города или детальная тоньше порога: ${findings.length}`,
  })
}

module.exports = {
  CITY_ID_PLACEHOLDER,
  CLI_SPEC,
  EMPTY_PAGE,
  USAGE,
  catalogQuestOf,
  cityPageOf,
  detailPageWords,
  inspectQuest,
  parseArgs,
  scanQuests,
}

if (require.main === module) {
  runCli(main, { name: CLI_SPEC.name, usage: USAGE })
}
