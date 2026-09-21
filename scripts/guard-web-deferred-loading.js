'use strict'

const fs = require('fs')
const path = require('path')

const { maskSource } = require('./lib/maskSource')

/**
 * Гейт правила `docs/RULES.md` → «Web loading and hydration policy» (#2012).
 *
 * Секция страницы на web грузится при загрузке страницы, а ждать прокрутки,
 * таймера или idle вправе только поимённые места из реестра правила. С марта по
 * сентябрь 2026 правило запрещало такое ожидание вовсе, а код шесть тикетов
 * подряд его вводил — ревью сверялось с практикой, а не с текстом
 * (RULES-WEB-LOADING-POLICY-DRIFT-001). Поэтому список мест теперь закрыт
 * механически, и закрыт с двух сторон:
 *
 *   1. файл, где в коде есть `IntersectionObserver`, `useProgressiveLoad` (вызов,
 *      импорт под другим именем) или `<DeferredSection>`, обязан стоять в
 *      `APPROVED_DEFERRED_LOADING`;
 *   2. число мест отложенной загрузки в файле из списка совпадает с
 *      записанным — новая отложенная секция в уже одобренном файле тоже видна;
 *   3. список этого скрипта и реестр в `RULES.md` совпадают файл в файл, так
 *      что строку нельзя добавить в одно место, минуя другое.
 *
 * Новое место — это сначала решение владельца, записанное в реестр, и только
 * потом строка здесь: агент сам себе исключение не вписывает (прецедент
 * INV2-17). Отложенную загрузку на одних `setTimeout`/`requestIdleCallback`
 * гейт не видит — такие места перечислены в правиле отдельно и сверяются ревью.
 */
const OUTPUT_CONTRACT_VERSION = 1
const RULES_PATH = 'docs/RULES.md'
const RULES_SECTION_HEADING = '### Web loading and hydration policy'
const REGISTRY_MARKER = 'Deferred loading registry (web)'

// Файл → число мест отложенной загрузки в нём (см. `findDeferralSites`).
// Ровно те файлы, что перечислены в реестре `RULES.md`; зачем каждое место и на
// каком триггере оно ждёт — там же.
const APPROVED_DEFERRED_LOADING = Object.freeze({
  // механизм
  'hooks/useProgressiveLoading.ts': 1,
  // секции и их данные
  'components/home/Home.tsx': 10,
  'components/quests/QuestNextStepSection.tsx': 1,
  'components/travel/TravelDescription.tsx': 1,
  'components/travel/details/hooks/useTravelDeferredSectionsModel.ts': 1,
  'components/travel/details/hooks/useTravelDetailsContentSectionModel.ts': 1,
  'components/travel/details/hooks/useTravelDetailsMapSectionContentModel.ts': 1,
  'components/travel/details/hooks/useTravelDetailsSidebarSectionModel.ts': 1,
  // медиа и встраивания
  'components/belkraj/BelkrajWidget.tsx': 1,
  'components/travel/details/sections/LazyYouTubeSection.web.tsx': 1,
  'components/travel/stableContent/useWebEffects.ts': 1,
  'components/ui/CustomImageRenderer.tsx': 1,
  'components/ui/ImageCardMediaWebHelpers.tsx': 2,
  // наблюдатель есть, но ничего не загружает
  'components/MapPage/Map/useMapWebLayoutEffects.ts': 1,
  'components/affiliate/useAffiliateImpression.ts': 1,
  'hooks/useActiveSection.ts': 1,
  'hooks/useTrackedImpression.ts': 1,
})

// Код web-приложения. Тесты мокают наблюдатель на каждом шагу, а native-файлы
// его не имеют вовсе: `useProgressiveLoad` там грузит сразу.
const SCAN_ROOTS = [
  'api',
  'app',
  'components',
  'config',
  'constants',
  'context',
  'hooks',
  'i18n',
  'screens',
  'services',
  'stores',
  'styles',
  'types',
  'ui',
  'utils',
]
const IGNORED_DIRS = new Set(['__tests__', '__mocks__', 'node_modules'])
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'])
const NON_WEB_FILE = /\.(?:native|ios|android)\.[cm]?[jt]sx?$/
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/

// Обёртка вокруг `useProgressiveLoad`, каждое употребление которой — своя
// отложенная секция. В дереве такая одна: `DeferredSection` главной (#1475).
const DEFERRAL_WRAPPER_ELEMENTS = ['DeferredSection']

// Зависимость от наблюдателя или хука без места: тип, проверка `typeof`,
// `import { useProgressiveLoad as useLazy }`. Вызов `useLazy(` шаблон
// `HOOK_CALL` не узнаёт, а секция за ним всё равно ждёт.
const DEFERRAL_MENTION = /\b(?:IntersectionObserver|useProgressiveLoad)\b/
// `new IntersectionObserver(`, `new window.IntersectionObserver(`,
// `new (window as any).IntersectionObserver(`, `new IntersectionObserverCtor(`.
const IO_DIRECT_CONSTRUCTION = /\bnew\b[^;\n]*?\bIntersectionObserver\w*\s*\(/g
// `const Observer = w?.IntersectionObserver` — конструктор под другим именем.
const IO_ALIAS_DECLARATION =
  /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]*)?=[^\n]*\bIntersectionObserver\b/g
const HOOK_CALL = /\buseProgressiveLoad\s*\(/g
const FUNCTION_DEFINITION_BEFORE = /\bfunction\s*$/

const normalizePath = (value) => String(value || '').replace(/\\/g, '/')

const parseArgs = (argv) => ({
  output: argv.includes('--json') ? 'json' : 'text',
})

const shouldScanFile = (relativePath) => {
  const normalized = normalizePath(relativePath)
  const parts = normalized.split('/')
  if (!SCAN_ROOTS.includes(parts[0])) return false
  if (parts.some((part) => IGNORED_DIRS.has(part))) return false
  if (!SOURCE_EXTENSIONS.has(path.extname(normalized))) return false
  return !NON_WEB_FILE.test(normalized) && !TEST_FILE.test(normalized)
}

const collectSourceFiles = (rootDir) => {
  const files = []
  const walk = (dirPath) => {
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
      const absolute = path.join(dirPath, entry.name)
      const relative = normalizePath(path.relative(rootDir, absolute))
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) walk(absolute)
      } else if (entry.isFile() && shouldScanFile(relative)) {
        files.push(relative)
      }
    }
  }
  for (const root of SCAN_ROOTS) {
    const absoluteRoot = path.join(rootDir, root)
    if (fs.existsSync(absoluteRoot)) walk(absoluteRoot)
  }
  return files.sort()
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const lineAt = (text, index) => {
  let line = 1
  for (let i = 0; i < index; i++) if (text[i] === '\n') line++
  return line
}

/**
 * Места отложенной загрузки в одном файле. Комментарии и содержимое строк не
 * считаются: `maskSource` гасит их посимвольно, так что смещения и номера строк
 * совпадают с файлом на диске.
 */
const findDeferralSites = ({ content }) => {
  const source = String(content || '')
  const masked = maskSource(source, { literals: true })
  const sourceLines = source.split('\n')
  const sites = []
  const addSite = (kind, index) => {
    const line = lineAt(masked, index)
    sites.push({ kind, line, snippet: (sourceLines[line - 1] || '').trim().slice(0, 160) })
  }

  for (const match of masked.matchAll(IO_DIRECT_CONSTRUCTION)) addSite('observer', match.index)

  const aliases = new Set()
  for (const match of masked.matchAll(IO_ALIAS_DECLARATION)) {
    // Имя с `IntersectionObserver` внутри уже посчитано прямым шаблоном.
    if (!match[1].includes('IntersectionObserver')) aliases.add(match[1])
  }
  if (aliases.size) {
    const aliasConstruction = new RegExp(
      `\\bnew\\s+(?:${[...aliases].map(escapeRegExp).join('|')})\\s*\\(`,
      'g',
    )
    for (const match of masked.matchAll(aliasConstruction)) addSite('observer', match.index)
  }

  for (const match of masked.matchAll(HOOK_CALL)) {
    const before = masked.slice(Math.max(0, match.index - 24), match.index)
    if (!FUNCTION_DEFINITION_BEFORE.test(before)) addSite('useProgressiveLoad', match.index)
  }

  for (const element of DEFERRAL_WRAPPER_ELEMENTS) {
    for (const match of masked.matchAll(new RegExp(`<${escapeRegExp(element)}\\b`, 'g'))) {
      addSite(element, match.index)
    }
  }

  sites.sort((a, b) => a.line - b.line)
  const mentionIndex = masked.search(DEFERRAL_MENTION)
  return {
    sites,
    // Упоминание без места тоже делает файл зависимым от механизма — такой
    // файл обязан быть в списке.
    mentionLine: mentionIndex >= 0 ? lineAt(masked, mentionIndex) : null,
  }
}

/**
 * Файлы реестра из `RULES.md`: пункт с `REGISTRY_MARKER` внутри раздела и его
 * подпункты вида «- `путь`, `путь` — …». Прочие строки раздела не читаются.
 */
const readRegistryFiles = (rulesText) => {
  const lines = String(rulesText || '').split('\n')
  const start = lines.findIndex((line) => line.trim() === RULES_SECTION_HEADING)
  if (start < 0) return { found: false, files: new Set() }

  let inRegistry = false
  let found = false
  const files = new Set()
  for (const line of lines.slice(start + 1)) {
    if (/^#{2,3} /.test(line)) break
    if (/^- /.test(line)) {
      inRegistry = line.includes(REGISTRY_MARKER)
      found = found || inRegistry
      continue
    }
    if (!inRegistry) continue
    const entry = line.match(/^\s+- ((?:`[^`]+`(?:,\s*)?)+)\s+—/)
    if (!entry) continue
    for (const token of entry[1].matchAll(/`([^`]+)`/g)) files.add(token[1])
  }
  return { found, files }
}

const evaluateGuard = ({ sources = [], rulesText = '', approved = APPROVED_DEFERRED_LOADING } = {}) => {
  const violations = []
  const scanned = new Set()

  if (sources.length === 0) {
    violations.push({
      rule: 'empty-scan',
      file: SCAN_ROOTS.join(', '),
      line: 0,
      snippet: 'no web source files were read — a pass over nothing proves nothing',
    })
  }

  for (const source of sources) {
    const file = normalizePath(source.filePath)
    const { sites, mentionLine } = findDeferralSites(source)
    if (!sites.length && mentionLine == null) continue
    scanned.add(file)
    const firstLine = sites[0]?.line ?? mentionLine

    if (!Object.prototype.hasOwnProperty.call(approved, file)) {
      violations.push({
        rule: 'unlisted-file',
        file,
        line: firstLine,
        snippet:
          sites.map((site) => `${site.kind} @${site.line}`).join(', ') ||
          'mentions IntersectionObserver or useProgressiveLoad',
      })
      continue
    }

    if (sites.length !== approved[file]) {
      violations.push({
        rule: 'site-count',
        file,
        line: firstLine,
        snippet: `expected ${approved[file]} deferral site(s), found ${sites.length}: ${sites
          .map((site) => `${site.kind} @${site.line}`)
          .join(', ')}`,
      })
    }
  }

  for (const file of Object.keys(approved)) {
    if (scanned.has(file)) continue
    violations.push({
      rule: 'stale-entry',
      file,
      line: 0,
      snippet: 'no deferral site left — drop the entry here and in the RULES.md registry',
    })
  }

  const registry = readRegistryFiles(rulesText)
  if (!registry.found) {
    violations.push({
      rule: 'registry-missing',
      file: RULES_PATH,
      line: 0,
      snippet: `no "${REGISTRY_MARKER}" bullet under "${RULES_SECTION_HEADING}"`,
    })
  } else {
    for (const file of Object.keys(approved)) {
      if (registry.files.has(file)) continue
      violations.push({
        rule: 'registry-parity',
        file: RULES_PATH,
        line: 0,
        snippet: `${file} is approved in the guard but missing from the registry`,
      })
    }
    for (const file of registry.files) {
      if (Object.prototype.hasOwnProperty.call(approved, file)) continue
      violations.push({
        rule: 'registry-parity',
        file: RULES_PATH,
        line: 0,
        snippet: `${file} is in the registry but missing from APPROVED_DEFERRED_LOADING`,
      })
    }
  }

  if (violations.length === 0) {
    const siteCount = Object.values(approved).reduce((sum, count) => sum + count, 0)
    return {
      ok: true,
      reason: `${siteCount} deferral site(s) in ${scanned.size} approved file(s) match the ${RULES_PATH} registry`,
      violations: [],
    }
  }

  return {
    ok: false,
    reason: `Deferred loading outside the ${RULES_PATH} registry, or the registry and the guard disagree`,
    violations,
  }
}

const buildJsonResult = (result) => {
  const violations = Array.isArray(result?.violations) ? result.violations : []
  return {
    contractVersion: OUTPUT_CONTRACT_VERSION,
    ok: Boolean(result?.ok),
    reason: String(result?.reason || ''),
    violations,
    violationCount: violations.length,
  }
}

const formatViolations = (violations) =>
  violations.map((v) => `- [${v.rule}] ${v.file}${v.line ? `:${v.line}` : ''} -> ${v.snippet}`)

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const rootDir = process.cwd()
  const sources = collectSourceFiles(rootDir).map((relativePath) => ({
    filePath: relativePath,
    content: fs.readFileSync(path.join(rootDir, relativePath), 'utf8'),
  }))
  const rulesPath = path.join(rootDir, RULES_PATH)
  const rulesText = fs.existsSync(rulesPath) ? fs.readFileSync(rulesPath, 'utf8') : ''

  const result = evaluateGuard({ sources, rulesText })

  if (args.output === 'json') {
    process.stdout.write(`${JSON.stringify(buildJsonResult(result), null, 2)}\n`)
    if (!result.ok) process.exit(1)
    return
  }

  if (result.ok) {
    console.log(`web-deferred-loading: passed. ${result.reason}`)
    return
  }

  console.error('web-deferred-loading: failed.')
  console.error(`- ${result.reason}`)
  formatViolations(result.violations).forEach((line) => console.error(line))
  console.error(
    `A page section that waits for scroll, a timer or idle needs the owner's decision in ${RULES_PATH} → ` +
      '«Web loading and hydration policy» first; then its file goes into the registry there and into ' +
      'APPROVED_DEFERRED_LOADING here, with the site count this guard reports.',
  )
  process.exit(1)
}

if (require.main === module) {
  main()
}

module.exports = {
  APPROVED_DEFERRED_LOADING,
  DEFERRAL_WRAPPER_ELEMENTS,
  OUTPUT_CONTRACT_VERSION,
  REGISTRY_MARKER,
  RULES_PATH,
  RULES_SECTION_HEADING,
  SCAN_ROOTS,
  buildJsonResult,
  collectSourceFiles,
  evaluateGuard,
  findDeferralSites,
  parseArgs,
  readRegistryFiles,
  shouldScanFile,
}
