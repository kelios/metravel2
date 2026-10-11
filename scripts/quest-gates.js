#!/usr/bin/env node
/**
 * Все гейты data-файла квеста одним прогоном и одним кодом выхода.
 *
 *   npm run quest:gates -- --source=.codex-temp/quests-plan/<city>/<quest_id>-quest-data.js
 *   npm run quest:gates -- --source=scripts/<city>-quest-data.js --max-route-m=3500 --max-leg-m=1000
 *   npm run quest:gates -- --source=<file> --offline     # без сети: без prod-drift и alias против прода
 *
 * Выход 0 — все гейты зелёные, 1 — хотя бы один красный, 2 — неверный вызов.
 *
 * Зачем отдельный скрипт. До него фактическим конвейером волн был
 * `.codex-temp/quests-plan/gates.sh` — gitignored, о нём не знал скилл, а
 * половина `scripts/scan-quest-*.js` не была подключена никуда, кроме
 * `check:fast` по уже изменённому файлу в `scripts/` (ревью контент-агентов
 * 11.10.2026). Черновик квеста живёт в `.codex-temp/quests-plan/` (#2228:
 * недописанный файл в `scripts/` роняет общий pre-commit), поэтому до переноса
 * в `scripts/` его не проверял ни один трекаемый гейт.
 *
 * Состав:
 *   1. dry-run миграции (`migrate-quest-from-file.js --dry-run`);
 *   2. КАЖДЫЙ `scripts/scan-quest-*.js` с `--source=` и теми же baseline, что
 *      у `check:fast` (список берётся с диска: новый скан входит сам и падает
 *      красным, если не умеет `--source`);
 *   3. геометрия маршрута `quest-geocheck.js --route-only`: возвраты и бюджет
 *      длины (≤4 км суммой перегонов, перегон ≤1,2 км; `roadtrip` — без бюджета);
 *   4. запрещённые по Беларуси источники (`scan-content-sources.js`);
 *   5. проверки этого файла:
 *      - самоутечка: вариант ответа целым словом стоит в title/location/task/
 *        hint/story своего шага или в story соседних (scan-quest-hint-leak
 *        story не читает — кейс «силуэты», хорватская серия 31.08.2026);
 *      - доля проверяемых: ≥6 обязательных шагов с проверяемым ответом и ≤3
 *        `any_text` среди обязательных; пол точек 8 (детские 6/7) — урок
 *        зимней волны 11.10.2026, где авторы без порога сдавали 2–4 проверяемых;
 *      - короткий ответ-подстрока: словарный вариант из 3–4 букв сидит внутри
 *        чужого слова (не его словоформы) в тексте, который скан утечек читает
 *        подстрокой («лев» в «слева», «две» в «Медвешчак»), и число из 3–4
 *        цифр внутри чужого числа («120» в «1200 м»): словарный вариант скан
 *        сравнивает подстрокой и для чисел;
 *      - alias города (#2209, #2211): новый квест не меняет alias уже
 *        опубликованного города, новый город не занимает чужой alias из
 *        sitemap, многословный город получает alias из всех слов имени.
 */

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const { fetchQuestCatalog } = require('./lib/questBundles')
const {
  parseCliArgs,
  parseCliTokens,
  requireNoBatchFailures,
  requireNonEmptySelection,
  runCli,
} = require('./lib/cli-contract')
const { normalizeAnswer } = require('./lib/questAnswerNormalize')
const { buildQuestCityAliasMap } = require('../utils/questCityAlias')

const SCRIPTS_DIR = __dirname
const DEFAULT_API = process.env.METRAVEL_API_URL || 'https://metravel.by'
const USER_AGENT = 'metravel-quest-gates/1.0 (+https://metravel.by)'

const MIN_CHECKABLE = 6
const MAX_FREE_TEXT = 3
// Скан утечек сравнивает словарь подстрокой от 3 знаков (`MIN_VALUE_LENGTH` в
// scan-quest-hint-leak.js); чем короче слово, тем чаще оно сидит в чужих словах.
const SHORT_VARIANT_MIN = 3
const SHORT_VARIANT_MAX = 4
const CHECKABLE_TYPES = new Set(['exact', 'exact_any', 'range', 'approx'])

/** Пол точек по тиру: взрослые и подростки 8, детские 5-7 — 6, 8-10 — 7. */
function pointFloor(tags) {
  if (tags.includes('age-5-7')) return 6
  if (tags.includes('age-8-10')) return 7
  return 8
}

/** Дополнительные аргументы сканов — те же baseline и allow-файлы, что у `check:fast`. */
function scanExtraArgs() {
  return {
    'scan-quest-answer-reachability.js': [`--baseline=${require('./scan-quest-answer-reachability').BASELINE_PATH}`],
    'scan-quest-compound-spelling-gap.js': [`--baseline=${require('./scan-quest-compound-spelling-gap').BASELINE_PATH}`],
    'scan-quest-hint-leak.js': [`--baseline=${require('./scan-quest-hint-leak').BASELINE_PATH}`],
    'scan-quest-surface-answer.js': [`--baseline=${require('./scan-quest-surface-answer').BASELINE_PATH}`],
    'scan-quest-point-roles.js': [`--baseline=${require('./scan-quest-point-roles').BASELINE_PATH}`],
    'scan-quest-anytext-minlen.js': [`--allow-file=${require('./scan-quest-anytext-minlen').ALLOW_PATH}`],
    'scan-quest-city-walk.js': [`--baseline=${require('./scan-quest-city-walk').BASELINE_PATH}`],
  }
}

/** Сканы, которым нужна сеть: с `--offline` они пропускаются, а не зеленеют молча. */
const NETWORK_SCANS = new Set(['scan-quest-prod-drift.js'])

/** Команды внешних гейтов в порядке прогона. */
function buildCommands(source, { offline = false, routeArgs = [], scanFiles } = {}) {
  const files = scanFiles || fs.readdirSync(SCRIPTS_DIR).filter((f) => /^scan-quest-.+\.js$/.test(f)).sort()
  const extra = scanExtraArgs()
  const commands = [
    { name: 'migrate --dry-run', args: ['scripts/migrate-quest-from-file.js', `--source-file=${source}`, '--dry-run'] },
  ]
  for (const file of files) {
    const name = file.replace(/\.js$/, '')
    if (offline && NETWORK_SCANS.has(file)) {
      commands.push({ name, skip: 'нужна сеть (--offline)' })
      continue
    }
    commands.push({ name, args: [`scripts/${file}`, `--source=${source}`, ...(extra[file] || [])] })
  }
  commands.push({ name: 'scan-content-sources', args: ['scripts/scan-content-sources.js', source] })
  commands.push({
    name: 'geocheck --route-only',
    args: ['scripts/quest-geocheck.js', `--source-file=${source}`, '--route-only', '--json', ...routeArgs],
    parse: 'route',
  })
  return commands
}

// ===================== Проверки по тексту квеста =====================

// Нормализация та же, по которой засчитывает ответ рантайм и сравнивает скан
// утечек (ё/і/э, пунктуация); дефис и тире — граница слова, а не склейка, чтобы
// «Санкт-Петербург» в тексте совпал с вариантом «санкт петербург».
const normText = (text) =>
  normalizeAnswer(String(text ?? '').replace(/[-–—]/g, ' '))
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

function parsePatternValue(value) {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

/** Варианты ответа как строки; для `range`/`approx` — пусто (их ловит `rangeBounds`). */
function answerVariants(pattern) {
  if (!pattern) return []
  if (pattern.type === 'exact') return [String(pattern.value ?? '')].filter(Boolean)
  if (pattern.type === 'exact_any') {
    const list = parsePatternValue(pattern.value)
    return (Array.isArray(list) ? list : [list]).map(String).filter(Boolean)
  }
  return []
}

function rangeBounds(pattern) {
  if (!pattern || pattern.type !== 'range') return null
  const v = parsePatternValue(pattern.value)
  const min = Number(v?.min)
  const max = Number(v?.max)
  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null
}

const tagsOf = (quest) => (Array.isArray(quest?.meta?.tags) ? quest.meta.tags.map(String) : [])
const isOptional = (step) => step.point_role === 'optional' || step.answer_pattern?.type === 'any'
const numberedSteps = (quest) => (quest.steps || []).filter((s) => s && !s.is_intro)

const OWN_FIELDS = ['title', 'location', 'task', 'hint', 'story']

/**
 * Самоутечка: вариант ответа целым словом (не подстрокой) в тексте своего шага
 * или в story соседнего. Целое слово, а не подстрока — иначе «лев» в «слева»
 * давал бы ложную находку, и гейт выключили бы первым же прогоном.
 */
function checkSelfLeak(quest) {
  const steps = numberedSteps(quest)
  const findings = []
  steps.forEach((step, index) => {
    const pattern = step.answer_pattern
    // В отчёт — вариант как он записан в data-файле, сравнение — по нормализованному.
    const variants = answerVariants(pattern).map((raw) => ({ raw, norm: normText(raw) })).filter((v) => v.norm)
    const bounds = rangeBounds(pattern)
    if (!variants.length && !bounds) return
    const surfaces = OWN_FIELDS.map((field) => ({ where: field, text: step[field] }))
    for (const neighbour of [steps[index - 1], steps[index + 1]]) {
      if (neighbour) surfaces.push({ where: `story шага ${neighbour.step_id}`, text: neighbour.story })
    }
    for (const { where, text } of surfaces) {
      const hay = ` ${normText(text)} `
      if (hay.trim() === '') continue
      for (const v of variants) {
        if (hay.includes(` ${v.norm} `)) findings.push({ step_id: step.step_id, where, answer: v.raw })
      }
      if (bounds && OWN_FIELDS.includes(where)) {
        // Числа — по сырому тексту и границе цифр, как в скане: нормализация
        // склеила бы «8-9» в «89».
        for (const token of String(text ?? '').match(/\d+/g) || []) {
          if (Number(token) >= bounds.min && Number(token) <= bounds.max) {
            findings.push({ step_id: step.step_id, where, answer: token })
          }
        }
      }
    }
  })
  return findings
}

/** Доля проверяемых и пол точек (урок зимней волны 11.10.2026). */
function checkCheckableShare(quest) {
  const tags = tagsOf(quest)
  const steps = numberedSteps(quest)
  const required = steps.filter((s) => !isOptional(s))
  const checkable = required.filter((s) => CHECKABLE_TYPES.has(s.answer_pattern?.type)).length
  const freeText = required.filter((s) => s.answer_pattern?.type === 'any_text').length
  const floor = pointFloor(tags)
  const kids = tags.includes('kids')
  const problems = []
  if (steps.length < floor) problems.push(`точек ${steps.length} < ${floor}: запас якорей меньше пола — это статья, не квест`)
  if (!kids && checkable < MIN_CHECKABLE) problems.push(`проверяемых обязательных шагов ${checkable} < ${MIN_CHECKABLE}`)
  if (!kids && freeText > MAX_FREE_TEXT) problems.push(`any_text среди обязательных ${freeText} > ${MAX_FREE_TEXT}`)
  return { steps: steps.length, required: required.length, checkable, freeText, floor, kids, problems }
}

/**
 * Короткий вариант ответа внутри чужого слова — мина для скана утечек, который
 * матчит словарь подстрокой. Поверхности те же, что у `scan-quest-hint-leak`:
 * интро и заголовок квеста — против ответов всех шагов, hint/location/title
 * шага — против его собственного ответа. Слово, которое НАЧИНАЕТСЯ с варианта
 * («вал» → «валом»), — настоящая словоформа ответа и настоящая утечка: её ловит
 * сам скан, здесь она не дублируется. У числа словоформ нет: «120» внутри
 * «1200» — мина, а не утечка, хотя скан её находит.
 */
function checkShortSubstring(quest) {
  const tokensOf = (text) => normText(text).split(' ').filter(Boolean)
  const shared = [{ where: 'quest.title', tokens: tokensOf(quest.title) }]
  if (quest.intro) for (const f of ['title', 'location', 'story', 'task']) shared.push({ where: `intro.${f}`, tokens: tokensOf(quest.intro[f]) })
  const findings = []
  for (const step of numberedSteps(quest)) {
    const own = ['hint', 'location', 'title'].map((f) => ({ where: `${step.step_id}.${f}`, tokens: tokensOf(step[f]) }))
    for (const raw of answerVariants(step.answer_pattern)) {
      const v = normText(raw)
      if (v.includes(' ') || v.length < SHORT_VARIANT_MIN || v.length > SHORT_VARIANT_MAX) continue
      const numeric = /^\d+$/.test(v)
      for (const { where, tokens } of [...shared, ...own]) {
        const host = tokens.find((t) => t !== v && (numeric || !t.startsWith(v)) && t.includes(v))
        if (host) findings.push({ step_id: step.step_id, answer: raw, where, host })
      }
    }
  }
  return findings
}

/** Сегменты `/quests/<alias>` из sitemap: только посадочные городов (один сегмент). */
function sitemapQuestAliases(xml) {
  const aliases = new Set()
  for (const m of String(xml).matchAll(/<loc>https?:\/\/[^<]*?\/quests\/([a-z0-9-]+)\/?<\/loc>/g)) aliases.add(m[1])
  return aliases
}

/**
 * Alias города (#2209). Фронт и бэк считают его одной эвристикой по quest_id
 * (`utils/questCityAlias.js` ↔ `quests/services/city_alias.py`), поэтому
 * прогноз для каталога «прод + этот квест» совпадает с тем, что опубликует
 * sitemap после заливки.
 */
function checkCityAlias(quest, catalog, sitemapAliases) {
  const cityName = String(quest?.city?.name || '').trim()
  const words = cityName.includes('(') ? [] : cityName.split(/[\s.\-–—_/,]+/).filter(Boolean)
  const problems = []
  const cityRows = catalog ? catalog.filter((q) => String(q.city_name || '').trim() === cityName) : []
  const cityId = cityRows[0]?.city_id != null ? String(cityRows[0].city_id) : '__new__'
  const rows = cityRows
    .filter((q) => q.quest_id !== quest.quest_id)
    .map((q) => ({ quest_id: q.quest_id, city_id: cityId, city_name: cityName }))
  rows.push({ quest_id: quest.quest_id, city_id: cityId, city_name: cityName })
  const predicted = buildQuestCityAliasMap(rows).get(cityId) || null

  if (!predicted) problems.push(`quest_id «${quest.quest_id}» не даёт alias городу «${cityName}»`)
  else if (cityRows.length) {
    const current = String(cityRows[0].city_alias || '').trim().toLowerCase()
    if (current && current !== predicted) problems.push(`квест меняет alias города «${cityName}»: /quests/${current} → /quests/${predicted}`)
    if (sitemapAliases && current && !sitemapAliases.has(current)) problems.push(`alias /quests/${current} города «${cityName}» нет в sitemap.xml`)
  } else {
    if (words.length >= 2 && !predicted.includes('-')) {
      problems.push(`многословный город «${cityName}» получит alias /quests/${predicted}: quest_id пишет каждое слово имени латиницей (veliky-novgorod-…, не veliky-…)`)
    }
    if (sitemapAliases && sitemapAliases.has(predicted)) problems.push(`alias /quests/${predicted} уже занят другим городом в sitemap.xml`)
  }
  return { cityName, predicted, existing: cityRows.length > 0, problems }
}

async function fetchSitemapAliases(apiUrl) {
  const response = await fetch(`${apiUrl.replace(/\/+$/, '')}/sitemap.xml`, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) throw new Error(`sitemap.xml: HTTP ${response.status}`)
  return sitemapQuestAliases(await response.text())
}

/** Вердикт геометрии из JSON `quest-geocheck --route-only`; `roadtrip` честно заявляет транспорт. */
function evaluateRoute(report, quests) {
  const problems = []
  for (const r of report.reports || []) {
    const quest = quests.find((q) => q.quest_id === r.quest_id)
    const route = r.route || {}
    if (route.backtracks?.length) problems.push(`${r.quest_id}: возвратов ${route.backtracks.length} (кольцо даёт ложный возврат по 1D-оси — тогда --backtrack-m)`)
    const len = route.length
    if (len && (len.over_route || len.over_leg) && !tagsOf(quest).includes('roadtrip')) {
      problems.push(`${r.quest_id}: маршрут ${len.total_m} м (≤${len.max_route_m}), max leg ${len.max_leg?.m} м (≤${len.max_leg_m})`)
    }
  }
  return problems
}

// ===================== CLI =====================

const USAGE = `Все гейты data-файла квеста одним прогоном

Usage:
  node scripts/quest-gates.js --source <file> [--offline] [--max-route-m <m>] [--max-leg-m <m>] [--backtrack-m <m>] [--api-url <url>]

Options:
  --source <file>       data-файл квеста (scripts/ или .codex-temp/quests-plan/)
  --offline             без сети: пропустить prod-drift и сверку alias с продом
  --max-route-m <m>     бюджет суммы перегонов (по умолчанию 4000; зима 3500, детские по сетке)
  --max-leg-m <m>       бюджет одного перегона (по умолчанию 1200)
  --backtrack-m <m>     порог возврата для quest-geocheck (по умолчанию 150)
  --api-url <url>       адрес прода (по умолчанию METRAVEL_API_URL или https://metravel.by)
  --help, -h            напечатать эту справку и выйти

Exit: 0 — все гейты зелёные, 1 — хотя бы один красный, 2 — неверный вызов.`

const CLI_SPEC = {
  name: 'quest-gates',
  usage: USAGE,
  selection: 'quests',
  flags: {
    source: { type: 'string', required: true, valueName: 'a data file' },
    offline: { type: 'boolean' },
    'max-route-m': { type: 'int', min: 1 },
    'max-leg-m': { type: 'int', min: 1 },
    'backtrack-m': { type: 'int', min: 1 },
    'api-url': { type: 'string', default: DEFAULT_API, stripTrailingSlash: true },
  },
}

const parseArgs = (tokens) => parseCliTokens(tokens, CLI_SPEC)

/** Квесты data-файла целиком: проверкам нужны `meta.tags`, `city`, `point_role`, которых бандл скана не несёт. */
function loadQuests(source) {
  const data = require(path.resolve(process.cwd(), source))
  return (Array.isArray(data) ? data : [data]).filter((q) => q && q.quest_id)
}

function tail(text, lines) {
  return String(text || '').split('\n').filter((l) => l.trim()).slice(-lines).join('\n')
}

async function main() {
  const args = parseCliArgs(process.argv, CLI_SPEC)
  const source = args.source
  if (!fs.existsSync(path.resolve(source))) throw new Error(`нет файла ${source}`)
  const quests = requireNonEmptySelection(loadQuests(source), {
    what: 'квестов',
    source,
    hint: 'module.exports = [ { quest } ]',
  })

  const routeArgs = []
  if (args.maxRouteM) routeArgs.push(`--max-route-m=${args.maxRouteM}`)
  if (args.maxLegM) routeArgs.push(`--max-leg-m=${args.maxLegM}`)
  if (args.backtrackM) routeArgs.push(`--backtrack-m=${args.backtrackM}`)

  const results = []
  const report = (name, ok, detail) => {
    results.push({ name, ok })
    console.log(`${ok === null ? 'SKIP' : ok ? 'ok  ' : 'FAIL'} :: ${name}${detail ? ` :: ${detail}` : ''}`)
  }

  for (const cmd of buildCommands(source, { offline: args.offline, routeArgs })) {
    if (cmd.skip) {
      report(cmd.name, null, cmd.skip)
      continue
    }
    const run = spawnSync(process.execPath, cmd.args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    const out = `${run.stdout || ''}${run.stderr || ''}`
    if (cmd.parse === 'route') {
      let problems
      try {
        problems = evaluateRoute(JSON.parse(run.stdout), quests)
      } catch (error) {
        problems = [`не разобран вывод geocheck: ${error.message}; ${tail(out, 3)}`]
      }
      report(cmd.name, problems.length === 0, problems.join(' | '))
      continue
    }
    const ok = run.status === 0
    report(cmd.name, ok, ok ? tail(out, 1).slice(0, 160) : `exit=${run.status}`)
    if (!ok) console.log(tail(out, 40).replace(/^/gm, '      '))
  }

  let catalog = null
  let sitemapAliases = null
  let networkError = null
  if (!args.offline) {
    // Недоступный прод краснит гейт alias, но не отменяет проверки текста ниже.
    try {
      catalog = await fetchQuestCatalog(args.apiUrl, USER_AGENT)
      sitemapAliases = await fetchSitemapAliases(args.apiUrl)
    } catch (error) {
      networkError = `прод недоступен (${error.message}); повтори или запусти с --offline`
    }
  }

  for (const quest of quests) {
    const leaks = checkSelfLeak(quest)
    report(`${quest.quest_id}: самоутечка в story/task`, leaks.length === 0,
      leaks.map((f) => `${f.step_id} «${f.answer}» в ${f.where}`).join('; '))

    const share = checkCheckableShare(quest)
    report(`${quest.quest_id}: доля проверяемых`, share.problems.length === 0,
      share.problems.length ? share.problems.join('; ') : `точек ${share.steps}, проверяемых ${share.checkable}, any_text ${share.freeText}${share.kids ? ' (детский: доля не меряется)' : ''}`)

    const shorts = checkShortSubstring(quest)
    report(`${quest.quest_id}: короткие ответы-подстроки`, shorts.length === 0,
      shorts.map((f) => `${f.step_id} «${f.answer}» внутри «${f.host}» (${f.where})`).join('; '))

    if (networkError) {
      report(`${quest.quest_id}: alias города`, false, networkError)
      continue
    }
    const alias = checkCityAlias(quest, catalog, sitemapAliases)
    report(`${quest.quest_id}: alias города`, alias.problems.length === 0,
      alias.problems.length ? alias.problems.join('; ') : `/quests/${alias.predicted}${args.offline ? ' (offline: прод и sitemap не сверены)' : alias.existing ? '' : ' (новый город)'}`)
  }

  const failed = results.filter((r) => r.ok === false).length
  console.log(`\nquest-gates: ${results.length - failed} из ${results.length} зелёные${failed ? `, красных ${failed}` : ''}.`)
  requireNoBatchFailures(failed, { total: results.length, message: `красных гейтов: ${failed}` })
}

module.exports = {
  CLI_SPEC,
  MIN_CHECKABLE,
  MAX_FREE_TEXT,
  answerVariants,
  buildCommands,
  checkCheckableShare,
  checkCityAlias,
  checkSelfLeak,
  checkShortSubstring,
  evaluateRoute,
  parseArgs,
  sitemapQuestAliases,
}

if (require.main === module) {
  runCli(main, { name: CLI_SPEC.name, usage: USAGE })
}
