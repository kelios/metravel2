const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const minimatchModule = require('minimatch')
const { resolveChangedFilesInput, runSelectiveChecks } = require('./run-local-selective-checks')

const parseArgs = (argv) => {
  const out = {
    baseRef: '',
    changedFilesFile: '',
    dryRun: false,
    output: 'text',
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--base-ref' && argv[i + 1]) {
      out.baseRef = String(argv[i + 1]).trim()
      i += 1
      continue
    }
    if (token === '--changed-files-file' && argv[i + 1]) {
      out.changedFilesFile = String(argv[i + 1]).trim()
      i += 1
      continue
    }
    if (token === '--dry-run') {
      out.dryRun = true
      continue
    }
    if (token === '--json') {
      out.output = 'json'
    }
  }

  return out
}

const LINTABLE_FILE_PATTERN = /\.(js|jsx|ts|tsx|mjs|cjs)$/
// Локальные данные квеста, из которых собирается заливка на бэкенд. Их словари
// `exact_any` проверяются на достижимость ДО заливки: после неё недостижимый
// вариант ловится только живым игроком на маршруте (#1450). Имя файла узнаёт
// сам скан — второй копии шаблона здесь не заводим, иначе гейт и baseline
// разойдутся в том, какие файлы считаются данными квеста.
const {
  QUEST_DATA_FILE_PATTERN,
  BASELINE_PATH: QUEST_REACHABILITY_BASELINE_PATH,
} = require('./scan-quest-answer-reachability')
const { BASELINE_PATH: QUEST_HINT_LEAK_BASELINE_PATH } = require('./scan-quest-hint-leak')
const { BASELINE_PATH: QUEST_SURFACE_ANSWER_BASELINE_PATH } = require('./scan-quest-surface-answer')
const { BASELINE_PATH: QUEST_COMPOUND_SPELLING_BASELINE_PATH } = require('./scan-quest-compound-spelling-gap')
const { BASELINE_PATH: QUEST_POINT_ROLES_BASELINE_PATH } = require('./scan-quest-point-roles')
const ESLINT_CACHE_LOCATION = 'node_modules/.cache/eslint/check-fast/.eslintcache'
const ESLINT_BIN_PATH = path.resolve(process.cwd(), 'node_modules/eslint/bin/eslint.js')
const MINIMATCH_OPTIONS = Object.freeze({ dot: true })
const eslintConfig = require(path.resolve(process.cwd(), 'eslint.config.js'))
const ESLINT_IGNORE_PATTERNS = Array.isArray(eslintConfig?.[0]?.ignores)
  ? eslintConfig[0].ignores
  : []
const matchGlob = (() => {
  if (typeof minimatchModule === 'function') {
    return minimatchModule
  }

  if (typeof minimatchModule?.minimatch === 'function') {
    return minimatchModule.minimatch
  }

  throw new TypeError('minimatch export does not expose a matcher function')
})()
const MaybeMatcherConstructor = typeof minimatchModule?.Minimatch === 'function'
  ? minimatchModule.Minimatch
  : null

const normalizeForMatching = (filePath) => String(filePath || '').replace(/\\/g, '/')

const createIgnorePatternMatcher = (pattern) => {
  const normalizedPattern = normalizeForMatching(pattern)
  if (!normalizedPattern) return null

  const globMatcher = MaybeMatcherConstructor
    ? new MaybeMatcherConstructor(normalizedPattern, MINIMATCH_OPTIONS)
    : null
  const prefix = normalizedPattern.endsWith('/') ? normalizedPattern : ''

  return (filePath) => {
    const normalizedFilePath = normalizeForMatching(filePath)
    if (!normalizedFilePath) {
      return false
    }

    const isGlobMatch = globMatcher
      ? globMatcher.match(normalizedFilePath)
      : matchGlob(normalizedFilePath, normalizedPattern, MINIMATCH_OPTIONS)

    if (isGlobMatch) {
      return true
    }

    return prefix ? normalizedFilePath.startsWith(prefix) : false
  }
}

const IGNORE_PATTERN_MATCHERS = Object.freeze(ESLINT_IGNORE_PATTERNS
  .map((pattern) => createIgnorePatternMatcher(pattern))
  .filter(Boolean))

const matchesIgnorePattern = (filePath, patternOrMatcher) => {
  if (typeof patternOrMatcher === 'function') {
    return patternOrMatcher(filePath)
  }

  const matcher = createIgnorePatternMatcher(patternOrMatcher)
  return matcher ? matcher(filePath) : false
}

const isIgnoredLintTarget = (filePath) => {
  return IGNORE_PATTERN_MATCHERS.some((matcher) => matchesIgnorePattern(filePath, matcher))
}

const getChangedQuestDataFiles = (changedFiles) => {
  return (changedFiles || [])
    .map((filePath) => normalizeForMatching(filePath))
    .filter((filePath) => path.dirname(filePath) === 'scripts')
    .filter((filePath) => QUEST_DATA_FILE_PATTERN.test(path.basename(filePath)))
    .filter((filePath) => fs.existsSync(path.resolve(process.cwd(), filePath)))
}

const getLintTargets = (changedFiles) => {
  return (changedFiles || []).filter((filePath) => {
    if (!LINTABLE_FILE_PATTERN.test(filePath)) {
      return false
    }

    if (!fs.existsSync(path.resolve(process.cwd(), filePath))) {
      return false
    }

    return !isIgnoredLintTarget(filePath)
  })
}

const buildEslintArgs = (lintTargets) => {
  return [
    ESLINT_BIN_PATH,
    '--cache',
    '--cache-location',
    ESLINT_CACHE_LOCATION,
    '--max-warnings=0',
    ...(lintTargets || []),
  ]
}

const resolveCommand = (command) => {
  if (process.platform !== 'win32') {
    return command
  }

  if (command === 'node') return process.execPath
  if (command === 'npm') return 'npm.cmd'
  if (command === 'npx') return 'npx.cmd'
  return command
}

const runCommand = (command, args, options = {}) => {
  const shell = options.shell ?? process.platform === 'win32'
  const result = spawnSync(resolveCommand(command), args, {
    encoding: 'utf8',
    stdio: 'inherit',
    shell,
  })
  return result.status ?? 1
}

const runFastScopeChecks = ({ changedFiles, dryRun, output }) => {
  const lintTargets = getLintTargets(changedFiles)
  const selectiveChecks = runSelectiveChecks({ changedFiles, dryRun, output })

  return {
    lintTargets,
    selectiveChecks,
  }
}

const emitTextSummary = ({ source, changedFiles, lintTargets }) => {
  console.log(`fast-scope-checks: source=${source}, changed-files=${changedFiles.length}, lint-targets=${lintTargets.length}`)
  if (changedFiles.length > 0) {
    console.log(`fast-scope-checks: files=${changedFiles.join(', ')}`)
  }
}

const emitSelectiveCheckOutputs = (checks) => {
  for (const check of checks || []) {
    if (check.result.stdout.trim()) {
      process.stdout.write(check.result.stdout)
      if (!check.result.stdout.endsWith('\n')) process.stdout.write('\n')
    }
    if (check.result.stderr.trim()) {
      process.stderr.write(check.result.stderr)
      if (!check.result.stderr.endsWith('\n')) process.stderr.write('\n')
    }
  }
}

const emitJsonSummary = ({ source, changedFiles, lintTargets, selectiveChecks }) => {
  const payload = {
    contractVersion: 1,
    source,
    changedFilesScanned: changedFiles.length,
    changedFiles,
    lintTargets,
    checks: selectiveChecks.map((check) => JSON.parse(check.result.stdout)),
  }
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
}

const main = () => {
  try {
    const args = parseArgs(process.argv.slice(2))
    if (args.output === 'json' && !args.dryRun) {
      console.error('fast-scope-checks: --json is supported only with --dry-run.')
      process.exit(2)
    }

    const input = resolveChangedFilesInput(args)
    const result = runFastScopeChecks({
      changedFiles: input.files,
      dryRun: args.dryRun,
      output: args.output,
    })

    if (args.output === 'json') {
      const failedSelective = result.selectiveChecks.find((check) => check.result.status !== 0)
      if (failedSelective) {
        process.exit(failedSelective.result.status)
      }

      emitJsonSummary({
        source: input.source,
        changedFiles: input.files,
        lintTargets: result.lintTargets,
        selectiveChecks: result.selectiveChecks,
      })
      return
    }

    emitTextSummary({
      source: input.source,
      changedFiles: input.files,
      lintTargets: result.lintTargets,
    })
    emitSelectiveCheckOutputs(result.selectiveChecks)

    const failedSelective = result.selectiveChecks.find((check) => check.result.status !== 0)
    if (failedSelective) {
      process.exit(failedSelective.result.status)
    }

    if (args.dryRun) {
      console.log('fast-scope-checks: dry-run, skipping guard:external-links and eslint.')
      return
    }

    const guardStatus = runCommand('npm', ['run', 'guard:external-links'])
    if (guardStatus !== 0) {
      process.exit(guardStatus)
    }

    const typeDebtGuardStatus = runCommand('npm', ['run', 'guard:type-debt'])
    if (typeDebtGuardStatus !== 0) {
      process.exit(typeDebtGuardStatus)
    }

    // Гейт безусловный, а не по изменённым файлам: четвёртая копия правила
    // докачки страниц (#1710, класс API-PAGE-SIZE-CAP-001) появляется в НОВОМ
    // файле рядом со старыми, и проверка «только изменённого» увидела бы её
    // лишь в том прогоне, где этот файл и правили.
    const pageFetchLoopGuardStatus = runCommand('npm', ['run', 'guard:no-inline-page-fetch-loop'])
    if (pageFetchLoopGuardStatus !== 0) {
      process.exit(pageFetchLoopGuardStatus)
    }

    // Та же логика для навигации «назад» (#1727): рукописная копия
    // `canGoBack() ? back() : replace(...)` появляется в новом экране, а не в
    // изменённом, поэтому гейт безусловный.
    const backNavigationGuardStatus = runCommand('npm', ['run', 'guard:no-inline-back-navigation'])
    if (backNavigationGuardStatus !== 0) {
      process.exit(backNavigationGuardStatus)
    }

    const questAnswerEvalGuardStatus = runCommand('npm', ['run', 'guard:quest-answer-eval'])
    if (questAnswerEvalGuardStatus !== 0) {
      process.exit(questAnswerEvalGuardStatus)
    }

    const questReviewSnapshotsGuardStatus = runCommand('npm', ['run', 'guard:quest-review-snapshots'])
    if (questReviewSnapshotsGuardStatus !== 0) {
      process.exit(questReviewSnapshotsGuardStatus)
    }

    // Один quest_id — один локальный файл-источник (#1554). Гейт безусловный, а
    // не по изменённым файлам: дубль появляется как раз тогда, когда НОВЫЙ файл
    // заводят рядом со старым, и проверка «только изменённого» увидела бы лишь
    // одну половину пары. Сетевая половина класса — расхождение файла с продом —
    // живёт отдельной командой `npm run quest:scan-prod-drift`: офлайн-гейт по
    // построению не знает состояния прода (#1489).
    const questDataSourcesGuardStatus = runCommand('npm', ['run', 'guard:quest-data-sources'])
    if (questDataSourcesGuardStatus !== 0) {
      process.exit(questDataSourcesGuardStatus)
    }

    // Скан достижимости идёт по изменённым локальным данным, а не по проду:
    // прогон по всей базе — это ~140 сетевых запросов, которым не место в
    // check:fast. Полный свип — `npm run quest:scan-answer-reachability`.
    // Baseline держит уже лежавшие в файле находки, чтобы правка одной строки
    // не краснела из-за чужого контента; пополняется только явным
    // `npm run quest:scan-answer-reachability:baseline`.
    for (const questDataFile of getChangedQuestDataFiles(input.files)) {
      const reachabilityStatus = runCommand('node', [
        'scripts/scan-quest-answer-reachability.js',
        `--source=${questDataFile}`,
        `--baseline=${QUEST_REACHABILITY_BASELINE_PATH}`,
      ], { shell: false })
      if (reachabilityStatus !== 0) {
        process.exit(reachabilityStatus)
      }

      // Тот же дефект — смешение алфавитов внутри слова — но в видимом игроку
      // тексте шага (#1464). Порог нулевой и baseline'а нет: все находки
      // вычищены до нуля, поэтому любое новое слово валит гейт сразу.
      const textScriptStatus = runCommand('node', [
        'scripts/scan-quest-mixed-script-text.js',
        `--source=${questDataFile}`,
      ], { shell: false })
      if (textScriptStatus !== 0) {
        process.exit(textScriptStatus)
      }

      // Зеркало скана достижимости (#1536): там вариант в словаре лежит, но
      // мёртв, здесь все варианты живы, а формы, которую игрок списывает с
      // объекта, в словаре просто нет. Признак механический — автор уже принял
      // два написания короткого ответа, но фразу собрал только вокруг одного.
      // Порог нулевой: все находки прода вычищены, поэтому новый пропуск валит
      // гейт сразу. Baseline при этом пуст, а не отсутствует — он нужен для
      // омографов («цепь»/«цеп»), где зеркальная фраза была бы несуществующей и
      // у автора иначе остаётся только выкинуть послабление из словаря. Полный
      // свип — `npm run quest:scan-compound-spelling-gap`.
      const compoundSpellingStatus = runCommand('node', [
        'scripts/scan-quest-compound-spelling-gap.js',
        `--source=${questDataFile}`,
        `--baseline=${QUEST_COMPOUND_SPELLING_BASELINE_PATH}`,
      ], { shell: false })
      if (compoundSpellingStatus !== 0) {
        process.exit(compoundSpellingStatus)
      }

      // Правило авторинга 4a: ответ не стоит в тексте, который игрок читает до
      // попытки. Умолчание скана — поля шага `hint` + `location` (#1467) и текст
      // интро против ответов всех шагов квеста (#1488). Контур шага вычищен до
      // нуля, а у интро есть разобранный остаток, поэтому здесь появился
      // baseline: известное молчит, новая находка валит гейт сразу. Полный свип
      // по проду — `npm run quest:scan-hint-leak`.
      const hintLeakStatus = runCommand('node', [
        'scripts/scan-quest-hint-leak.js',
        `--source=${questDataFile}`,
        `--baseline=${QUEST_HINT_LEAK_BASELINE_PATH}`,
      ], { shell: false })
      if (hintLeakStatus !== 0) {
        process.exit(hintLeakStatus)
      }

      // Правило авторинга 4f: ответ не строится на том, как поверхность объекта
      // выглядит сегодня, — перекраска и ремонт протухают молча (#1431, кейс
      // mir-castle/church). Baseline держит контент, написанный до правила;
      // новый цветовой или облицовочный ответ валит гейт, пока автор не
      // подтвердит его датированным фото по порогу свежести 4f. Полный свип по
      // проду — `npm run quest:scan-surface-answer`.
      const surfaceAnswerStatus = runCommand('node', [
        'scripts/scan-quest-surface-answer.js',
        `--source=${questDataFile}`,
        `--baseline=${QUEST_SURFACE_ANSWER_BASELINE_PATH}`,
      ], { shell: false })
      if (surfaceAnswerStatus !== 0) {
        process.exit(surfaceAnswerStatus)
      }

      // #1810 — структурная роль точки: необязательность обещает игроку сам
      // заголовок, а не тип ответа. До заливки проверяемо именно это — роли в
      // авторском файле ещё нет, её проставит заливщик. Прод-режим той же
      // гвардии (`npm run quest:scan-point-roles`) сверяет уже проставленное
      // поле. Baseline держит четыре привала, названные без «(по желанию)» до
      // появления правила: переписывать чужие заголовки задним числом скрипт не
      // должен, а новая такая точка валит гейт сразу.
      const pointRolesStatus = runCommand('node', [
        'scripts/scan-quest-point-roles.js',
        `--source=${questDataFile}`,
        `--baseline=${QUEST_POINT_ROLES_BASELINE_PATH}`,
      ], { shell: false })
      if (pointRolesStatus !== 0) {
        process.exit(pointRolesStatus)
      }
    }

    if (result.lintTargets.length === 0) {
      console.log('fast-scope-checks: no lintable changed files, eslint skipped.')
      return
    }

    const eslintStatus = runCommand('node', buildEslintArgs(result.lintTargets), { shell: false })
    if (eslintStatus !== 0) {
      process.exit(eslintStatus)
    }
  } catch (error) {
    console.error(`fast-scope-checks: failed: ${String(error.message || error)}`)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  LINTABLE_FILE_PATTERN,
  ESLINT_IGNORE_PATTERNS,
  IGNORE_PATTERN_MATCHERS,
  MINIMATCH_OPTIONS,
  parseArgs,
  normalizeForMatching,
  matchesIgnorePattern,
  createIgnorePatternMatcher,
  getLintTargets,
  getChangedQuestDataFiles,
  QUEST_DATA_FILE_PATTERN,
  buildEslintArgs,
  ESLINT_CACHE_LOCATION,
  ESLINT_BIN_PATH,
  isIgnoredLintTarget,
  runFastScopeChecks,
}
