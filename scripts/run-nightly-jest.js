#!/usr/bin/env node
'use strict'

/**
 * Полный Jest на чистом снимке `origin/main` (#3468, RED-TEST-ON-MAIN-OUTSIDE-GATE-001).
 *
 * До push идут только связанные с diff'ом тесты (`scripts/related-jest-tests.js`);
 * всё, что выборка не достала, должно всплыть не позже следующего утра, а не
 * тогда, когда на красный тест наткнётся сосед по ветке.
 *
 *   node scripts/run-nightly-jest.js                  снимок origin/main, отчёт, код 1 при НОВЫХ красных
 *   … --ref <rev>                                     другой коммит вместо origin/main
 *   … --no-fetch                                      не ходить в сеть за origin
 *   … --max-workers <n|n%>                            воркеры Jest (по умолчанию 50%)
 *   … --keep-worktree                                 не убирать снимок (разбор сбоя)
 *   … --dry-run                                       только план
 *
 * Снимок — отдельный worktree РЯДОМ с репозиторием, а не внутри: у него свой
 * quality-gate lock, и сессии основного чекаута прогон не видят. `node_modules`
 * копируется (`cp -c -R`, на APFS это клон без данных), а не подключается
 * симлинком: воркеры Jest по симлинку получили бы пути основного чекаута, и
 * `findConflictingQualityProcesses` глушил бы там Jest на всё время прогона.
 * Путь снимка постоянный — кэш трансформов Jest привязан к rootDir и переживает ночь.
 *
 * Коды выхода: 0 — новых красных нет; 1 — есть новые красные относительно
 * прошлого отчёта (без прошлого отчёта новыми считаются все); 2 — прогон не
 * состоялся (снимок, зависимости, Jest не отдал результат) — прошлый отчёт не трогается.
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const CHECK_NAME = 'nightly-jest'
const MAIN_ROOT = path.resolve(__dirname, '..')
const WORKTREE_PATH = path.join(path.dirname(MAIN_ROOT), 'worktrees', 'nightly-jest')
const REPORT_DIR = path.join(MAIN_ROOT, '.codex-temp', 'nightly-jest')
const LATEST_FILE = 'latest.json'
const RUN_LOCK = 'run.lock'
const FONT_DIR = '.codex-temp/book-renderer-fonts'
const DEFAULT_REF = 'origin/main'
const DEFAULT_MAX_WORKERS = '50%'
const REPORTS_TO_KEEP = 30

const EXIT_NEW_RED = 1
const EXIT_NOT_RUN = 2

/**
 * Красное только из-за стенда: тест требует подготовки, которой в git нет.
 * Если подготовка удалась, запись ничего не прощает — тест обязан быть зелёным.
 */
const ENVIRONMENT_ONLY = Object.freeze([
  Object.freeze({
    pattern: /^__tests__\/services\/pdf-export\/bookRendererWorker/,
    needs: 'fonts',
    why: 'нет закреплённого набора шрифтов `.codex-temp/book-renderer-fonts` (ночной прогон его не готовит: `node scripts/prepare-book-renderer-fonts.js` ходит в сеть)',
  }),
])

const parseArgs = (argv) => {
  const out = { ref: DEFAULT_REF, fetch: true, maxWorkers: DEFAULT_MAX_WORKERS, keepWorktree: false, dryRun: false }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--ref' && argv[i + 1]) { out.ref = String(argv[i + 1]).trim(); i += 1; continue }
    if (token === '--max-workers' && argv[i + 1]) { out.maxWorkers = String(argv[i + 1]).trim(); i += 1; continue }
    if (token === '--no-fetch') { out.fetch = false; continue }
    if (token === '--keep-worktree') { out.keepWorktree = true; continue }
    if (token === '--dry-run') { out.dryRun = true; continue }
    throw new Error(`unknown argument: ${token}`)
  }
  if (!/^\d+%?$/.test(out.maxWorkers)) throw new Error(`--max-workers expects a number or a percentage, got: ${out.maxWorkers}`)
  return out
}

const toPosix = (value) => String(value || '').replace(/\\/g, '/')

/** Сводка `jest --json`: красные файлы с именами упавших тестов. */
const summarizeJestJson = (json, root) => {
  const results = Array.isArray(json?.testResults) ? json.testResults : []
  // `focused` и `pending` — набор с пропущенными тестами (например, без каталога `android/`), не красный.
  const red = results
    .filter((suite) => suite.status === 'failed')
    .map((suite) => {
      const failedTests = (suite.assertionResults || [])
        .filter((assertion) => assertion.status === 'failed')
        .map((assertion) => assertion.fullName || assertion.title || '')
      return {
        file: toPosix(path.relative(root, suite.name)),
        failedTests,
        // Набор, упавший до первого теста (ошибка импорта, синтаксис), тестов не называет.
        message: failedTests.length ? '' : String(suite.message || '').split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 3).join(' | '),
      }
    })
    .sort((a, b) => a.file.localeCompare(b.file))
  return {
    suites: Number(json?.numTotalTestSuites) || results.length,
    tests: Number(json?.numTotalTests) || 0,
    failedTests: Number(json?.numFailedTests) || 0,
    red,
  }
}

/** Делит красное на «только стенд» (подготовка не удалась) и настоящее. */
const splitEnvironmentRed = (red, ready = {}) => {
  const environment = []
  const real = []
  for (const item of red) {
    const rule = ENVIRONMENT_ONLY.find((entry) => entry.pattern.test(item.file) && !ready[entry.needs])
    if (rule) environment.push({ ...item, why: rule.why })
    else real.push(item)
  }
  return { environment, real }
}

/** Отличие от прошлого прогона: новые красные, починенные, оставшиеся. */
const compareWithPrevious = (redFiles, previous) => {
  const current = [...new Set(redFiles)].sort()
  const before = Array.isArray(previous?.redFiles) ? [...new Set(previous.redFiles)].sort() : null
  if (!before) return { baseline: true, newRed: current, fixed: [], stillRed: [] }
  return {
    baseline: false,
    newRed: current.filter((file) => !before.includes(file)),
    fixed: before.filter((file) => !current.includes(file)),
    stillRed: current.filter((file) => before.includes(file)),
  }
}

const exitCodeFor = (diff) => (diff.newRed.length > 0 ? EXIT_NEW_RED : 0)

const formatList = (title, files) => [
  `${title}: ${files.length}`,
  ...files.map((file) => `  - ${file}`),
]

const formatReport = (report) => {
  const lines = [
    `Ночной Jest на ${report.ref}: ${report.sha}`,
    `Дата: ${report.date} (старт ${report.startedAt}, прогон ${report.durationSeconds} с, воркеры ${report.maxWorkers})`,
    `Наборов: ${report.suites}, тестов: ${report.tests}`,
    `Красных наборов: ${report.redCount}${report.previousSha ? ` (прошлый прогон ${report.previousDate} @ ${report.previousSha.slice(0, 9)}: ${report.previousRedCount})` : ' (прошлого прогона нет — все красные считаются новыми)'}`,
    '',
    ...formatList('НОВЫЕ красные', report.newRed),
    ...formatList('Починенные с прошлого прогона', report.fixed),
    ...formatList('Красные по-прежнему', report.stillRed),
    ...formatList('Нестабильные (красные в общем прогоне, зелёные при повторе в одном процессе)', report.flaky),
    ...formatList('Красные только из-за стенда (в счёт не идут)', report.environmentRed.map((item) => `${item.file} — ${item.why}`)),
    '',
    'Подробности красных:',
  ]
  for (const item of report.red) {
    lines.push(`- ${item.file}`)
    for (const name of item.failedTests.slice(0, 20)) lines.push(`    ✕ ${name}`)
    if (item.failedTests.length > 20) lines.push(`    … и ещё ${item.failedTests.length - 20}`)
    if (item.message) lines.push(`    ${item.message}`)
  }
  if (!report.red.length) lines.push('  (нет)')
  lines.push('', ...report.notes.map((note) => `Заметка: ${note}`))
  return `${lines.join('\n').replace(/\n+$/, '')}\n`
}

const localDate = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...options })
  return { status: result.status ?? 1, stdout: String(result.stdout || ''), stderr: String(result.stderr || '') }
}

const git = (args, cwd = MAIN_ROOT) => run('git', args, { cwd })

const removeWorktree = () => {
  if (fs.existsSync(WORKTREE_PATH)) {
    // Скопированный node_modules git не знает: `worktree remove --force` его уберёт, но медленнее.
    fs.rmSync(path.join(WORKTREE_PATH, 'node_modules'), { recursive: true, force: true })
    if (git(['worktree', 'remove', '--force', WORKTREE_PATH]).status !== 0) {
      fs.rmSync(WORKTREE_PATH, { recursive: true, force: true })
    }
  }
  git(['worktree', 'prune'])
}

const isProcessAlive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try { process.kill(pid, 0); return true } catch (error) { return error?.code === 'EPERM' }
}

const acquireRunLock = () => {
  const lockPath = path.join(REPORT_DIR, RUN_LOCK)
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), { flag: 'wx' })
      return () => fs.rmSync(lockPath, { force: true })
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
      let owner = null
      try { owner = JSON.parse(fs.readFileSync(lockPath, 'utf8')) } catch { owner = null }
      if (isProcessAlive(Number(owner?.pid))) throw new Error(`another nightly run is active (pid=${owner.pid}, started=${owner.startedAt})`)
      fs.rmSync(lockPath, { force: true })
    }
  }
  throw new Error('could not take the nightly run lock')
}

const copyNodeModules = () => {
  const source = path.join(MAIN_ROOT, 'node_modules')
  if (!fs.existsSync(source)) throw new Error('node_modules is missing in the primary checkout')
  const flags = process.platform === 'darwin' ? ['-c', '-R'] : ['-R']
  const copied = run('cp', [...flags, source, path.join(WORKTREE_PATH, 'node_modules')])
  if (copied.status !== 0) throw new Error(`node_modules copy failed: ${copied.stderr.trim().split('\n')[0]}`)
}

/**
 * Шрифты книги: только уже подготовленный набор основного чекаута, в снимок его
 * переносит `worktree:bootstrap`. Ночной прогон в сеть не ходит: штатная подготовка
 * (`scripts/prepare-book-renderer-fonts.js`) качает Google Fonts — без набора
 * `bookRendererWorker` идёт строкой «только стенд».
 */
const prepareFonts = (notes) => {
  const { verifiedFontBundle } = require('./prepare-book-renderer-fonts')
  try {
    verifiedFontBundle(path.join(MAIN_ROOT, FONT_DIR), MAIN_ROOT)
  } catch (error) {
    notes.push(`шрифты книги не подготовлены в основном чекауте (${String(error.message || error).split('\n')[0]}); подготовка — вручную: node scripts/prepare-book-renderer-fonts.js (сеть)`)
  }
  const bootstrap = run(process.execPath, ['scripts/worktree-bootstrap.js'], { cwd: WORKTREE_PATH })
  if (bootstrap.status !== 0) notes.push(`worktree:bootstrap в снимке завершился с кодом ${bootstrap.status}: ${(bootstrap.stderr || bootstrap.stdout).trim().split('\n').pop()}`)
  try { verifiedFontBundle(path.join(WORKTREE_PATH, FONT_DIR), WORKTREE_PATH); return true } catch { return false }
}

const runJest = ({ args, logFile, outputFile }) => {
  fs.rmSync(outputFile, { force: true })
  const env = { ...process.env }
  // Прогон стартует из основного чекаута, а lock берёт свой, в снимке.
  delete env.MT_QUALITY_GATE_LOCK_OWNED
  delete env.MT_QUALITY_GATE_BUSY_EXIT_CODE
  const log = fs.openSync(logFile, 'a')
  try {
    const result = spawnSync(process.execPath, ['node_modules/jest/bin/jest.js', '--ci', '--watchAll=false', '--json', `--outputFile=${outputFile}`, ...args], {
      cwd: WORKTREE_PATH,
      env,
      stdio: ['ignore', log, log],
    })
    let json = null
    try { json = JSON.parse(fs.readFileSync(outputFile, 'utf8')) } catch { json = null }
    return { status: result.status ?? 1, json }
  } finally {
    fs.closeSync(log)
    fs.rmSync(outputFile, { force: true })
  }
}

const pruneReports = () => {
  const reports = fs.readdirSync(REPORT_DIR).filter((name) => /^\d{4}-\d{2}-\d{2}-[0-9a-f]+\.(?:txt|jest\.log)$/.test(name)).sort()
  const stems = [...new Set(reports.map((name) => name.replace(/\.(?:txt|jest\.log)$/, '')))]
  for (const stem of stems.slice(0, Math.max(0, stems.length - REPORTS_TO_KEEP))) {
    for (const suffix of ['.txt', '.jest.log']) fs.rmSync(path.join(REPORT_DIR, `${stem}${suffix}`), { force: true })
  }
}

const readPrevious = () => {
  try { return JSON.parse(fs.readFileSync(path.join(REPORT_DIR, LATEST_FILE), 'utf8')) } catch { return null }
}

const main = () => {
  // Здесь, а не при загрузке модуля: тесты разбора результата импортируют файл под любым Node.
  require('./ensure-node-version').assertSupportedNode()
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(`${CHECK_NAME}: ${error.message}`)
    process.exit(EXIT_NOT_RUN)
  }
  if (args.dryRun) {
    console.log(`${CHECK_NAME}: dry-run — снимок ${args.ref} в ${WORKTREE_PATH}, node_modules копией, шрифты книги, полный Jest (--maxWorkers=${args.maxWorkers}), отчёт в ${path.relative(MAIN_ROOT, REPORT_DIR)}/<дата>-<sha>.txt и ${LATEST_FILE}; код ${EXIT_NEW_RED} при новых красных.`)
    return
  }

  let releaseLock = () => {}
  let resultDir = ''
  let exitCode = EXIT_NOT_RUN
  const notes = []
  const startedAt = new Date()
  try {
    releaseLock = acquireRunLock()
    if (args.fetch && git(['fetch', '--quiet', 'origin']).status !== 0) notes.push('git fetch origin не удался — снимок по уже полученному состоянию')
    const sha = git(['rev-parse', '--verify', '--quiet', `${args.ref}^{commit}`]).stdout.trim()
    if (!sha) throw new Error(`cannot resolve ${args.ref}`)

    removeWorktree()
    fs.mkdirSync(path.dirname(WORKTREE_PATH), { recursive: true })
    const added = git(['worktree', 'add', '--detach', '--quiet', WORKTREE_PATH, sha])
    if (added.status !== 0) throw new Error(`git worktree add failed: ${added.stderr.trim()}`)
    copyNodeModules()
    if (git(['diff', '--quiet', sha, '--', 'yarn.lock']).status !== 0) {
      notes.push('yarn.lock основного чекаута отличается от снимка: node_modules могут не соответствовать коммиту')
    }
    const fontsReady = prepareFonts(notes)

    const stem = `${localDate(startedAt)}-${sha.slice(0, 9)}`
    const logFile = path.join(REPORT_DIR, `${stem}.jest.log`)
    fs.rmSync(logFile, { force: true })
    // Не под основным чекаутом: его путь в аргументах Jest сделал бы прогон «чужим
    // quality-процессом» для сессий основного чекаута (`commandReferencesCheckout`).
    resultDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nightly-jest-'))
    const outputFile = path.join(resultDir, 'result.json')
    const jestStarted = Date.now()
    const full = runJest({ args: [`--maxWorkers=${args.maxWorkers}`], logFile, outputFile })
    if (!full.json || !(Number(full.json.numTotalTestSuites) > 0)) {
      throw new Error(`Jest не отдал результат (exit ${full.status}); вывод — ${path.relative(MAIN_ROOT, logFile)}`)
    }
    const summary = summarizeJestJson(full.json, fs.realpathSync(WORKTREE_PATH))

    // Повтор красных в одном процессе отделяет нестабильное от настоящего.
    let flaky = []
    let red = summary.red
    if (red.length) {
      const retry = runJest({ args: ['--runInBand', '--runTestsByPath', ...red.map((item) => item.file)], logFile, outputFile })
      if (retry.json) {
        const stillRed = new Set(summarizeJestJson(retry.json, fs.realpathSync(WORKTREE_PATH)).red.map((item) => item.file))
        flaky = red.filter((item) => !stillRed.has(item.file)).map((item) => item.file)
        red = red.filter((item) => stillRed.has(item.file))
      } else {
        notes.push('повтор красных наборов результата не отдал — нестабильные не отделены')
      }
    }

    const split = splitEnvironmentRed(red, { fonts: fontsReady })
    const previous = readPrevious()
    const redFiles = split.real.map((item) => item.file)
    const diff = compareWithPrevious(redFiles, previous)
    const report = {
      contractVersion: 1,
      check: CHECK_NAME,
      ref: args.ref,
      sha,
      date: localDate(startedAt),
      startedAt: startedAt.toISOString(),
      durationSeconds: Math.round((Date.now() - jestStarted) / 1000),
      maxWorkers: args.maxWorkers,
      suites: summary.suites,
      tests: summary.tests,
      redCount: redFiles.length,
      redFiles,
      red: split.real,
      newRed: diff.newRed,
      fixed: diff.fixed,
      stillRed: diff.stillRed,
      flaky,
      environmentRed: split.environment,
      previousSha: previous?.sha || '',
      previousDate: previous?.date || '',
      previousRedCount: Array.isArray(previous?.redFiles) ? previous.redFiles.length : 0,
      fontsReady,
      notes,
    }
    fs.writeFileSync(path.join(REPORT_DIR, `${stem}.txt`), formatReport(report))
    fs.writeFileSync(path.join(REPORT_DIR, LATEST_FILE), `${JSON.stringify(report, null, 2)}\n`)
    pruneReports()

    exitCode = exitCodeFor(diff)
    console.log(`${CHECK_NAME}: ${sha.slice(0, 9)} — наборов ${report.suites}, красных ${report.redCount} (новых ${diff.newRed.length}, починено ${diff.fixed.length}), нестабильных ${flaky.length}, только стенд ${split.environment.length}; ${report.durationSeconds} с`)
    for (const file of diff.newRed) console.log(`${CHECK_NAME}: НОВЫЙ красный — ${file}`)
    console.log(`${CHECK_NAME}: отчёт — ${path.relative(MAIN_ROOT, path.join(REPORT_DIR, `${stem}.txt`))}`)
  } catch (error) {
    console.error(`${CHECK_NAME}: прогон не состоялся: ${String(error.message || error)}`)
    exitCode = EXIT_NOT_RUN
  } finally {
    if (resultDir) fs.rmSync(resultDir, { recursive: true, force: true })
    if (!args.keepWorktree) {
      try { removeWorktree() } catch (error) { console.error(`${CHECK_NAME}: снимок не убран: ${error.message}`) }
    }
    releaseLock()
  }
  process.exit(exitCode)
}

if (require.main === module) {
  main()
}

module.exports = {
  CHECK_NAME,
  WORKTREE_PATH,
  REPORT_DIR,
  ENVIRONMENT_ONLY,
  EXIT_NEW_RED,
  EXIT_NOT_RUN,
  parseArgs,
  summarizeJestJson,
  splitEnvironmentRed,
  compareWithPrevious,
  exitCodeFor,
  formatReport,
  localDate,
}
