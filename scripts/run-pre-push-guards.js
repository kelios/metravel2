'use strict'

/**
 * Исполнитель единого списка стражей до push (`scripts/pre-push-guards.js`, #3371).
 *
 *   node scripts/run-pre-push-guards.js                 стадия `pre-push` — шаг `check:preflight`
 *   node scripts/run-pre-push-guards.js --all           весь список — `npm run guard:pre-push`
 *   node scripts/run-pre-push-guards.js --related-only  только связанные с diff'ом Jest-тесты —
 *                                                       `npm run test:related`; `--full` снимает потолок
 *   … --dry-run [--json]                                только план, ничего не запускает
 *   … --changed-files-file <файл> | --base-ref <ref>    scope для предупреждения о пробной сборке
 *                                                       и для связанных Jest-тестов
 *
 * Связанные тесты (#3468): после стражей шаг запускает тесты, которые импортируют
 * или подменяют изменённый модуль либо читают изменённый документ. Отбор —
 * `scripts/related-jest-tests.js`, правило и потолок — `RELATED_TESTS_RULE`.
 *
 * Занятый quality-gate lock: Jest-шаг (`test:governance`, связанные тесты) при
 * прямом `npm run guard:pre-push` выходил нейтрально с кодом 0, и прогон печатал
 * `PASS` без обязательного шага. Теперь шаг выходит с `SKIPPED_EXIT_CODE`, прогон
 * печатает `SKIPPED` и завершается этим кодом. Внутри `check:preflight` lock уже
 * принадлежит обёртке, там пропуска нет.
 *
 * Стражи читают рабочее дерево целиком, а не коммит: красное в чужом
 * незакоммиченном файле соседней сессии остановит и чужой push. Порядок на этот
 * случай — `docs/TASK_BOARD_MCP.md` → «Коммит и пуш — часть перехода `review → testing`».
 */

const path = require('path')
const { spawnSync } = require('child_process')
const { resolveChangedFilesInput, listSelectiveTests } = require('./run-local-selective-checks')
const { QUALITY_GATE_BUSY_EXIT_ENV } = require('./quality-gate-lock')
const {
  STAGE_PRE_PUSH,
  PRE_PUSH_GUARDS,
  BUNDLE_PROBE_RULE,
  RELATED_TESTS_RULE,
  PREFLIGHT_SELECTIVE_TESTS_ENV,
  guardsForStage,
  isRuntimeSourcePath,
  findImportAdditions,
} = require('./pre-push-guards')
const {
  findDocContractTests,
  selectRelatedTests,
  formatRelatedSelection,
  runRelatedTests,
  governanceTestsFromPackage,
} = require('./related-jest-tests')

const CHECK_NAME = 'pre-push-guards'
const RELATED_LABEL = 'related tests'
const ESLINT_BIN_PATH = path.resolve(process.cwd(), 'node_modules/eslint/bin/eslint.js')
// EX_TEMPFAIL: обязательный шаг не выполнен, потому что quality-gate lock занят.
const SKIPPED_EXIT_CODE = 75

// Управляющие переменные preflight стражам и тестам не передаются: тест, который сам
// запускает preflight, иначе получал `PREFLIGHT_SKIP_E2E=1` внешнего прогона и видел
// три шага вместо четырёх (`run-preflight-checks.test.ts`, найдено шагом связанных тестов).
const PREFLIGHT_CONTROL_ENV = Object.freeze(['PREFLIGHT_SKIP_E2E', PREFLIGHT_SELECTIVE_TESTS_ENV])

const guardEnv = () => {
  const env = { ...process.env, [QUALITY_GATE_BUSY_EXIT_ENV]: String(SKIPPED_EXIT_CODE) }
  for (const name of PREFLIGHT_CONTROL_ENV) delete env[name]
  return env
}

/** Итоговая строка невыполненного шага: `SKIPPED` из-за занятого lock — не `FAILED` и не `PASS`. */
const formatGuardFailure = (label, status, why) => (status === SKIPPED_EXIT_CODE
  ? `${CHECK_NAME}: SKIPPED ${label} (exit ${status}) — quality-gate lock занят другим прогоном; шаг обязателен и НЕ выполнен, это не PASS. Повтори, когда владелец lock закончит.`
  : `${CHECK_NAME}: FAILED ${label} (exit ${status}) — ${why}`)

const parseArgs = (argv) => {
  const out = {
    baseRef: '',
    changedFilesFile: '',
    dryRun: false,
    output: 'text',
    all: false,
    relatedOnly: false,
    full: false,
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
    if (token === '--all') {
      out.all = true
      continue
    }
    if (token === '--related-only') {
      out.relatedOnly = true
      continue
    }
    if (token === '--full') {
      out.full = true
      continue
    }
    if (token === '--json') {
      out.output = 'json'
    }
  }

  return out
}

const selectGuards = ({ all, relatedOnly }) => {
  if (relatedOnly) return []
  return all ? [...PRE_PUSH_GUARDS] : guardsForStage(STAGE_PRE_PUSH)
}

/**
 * Тесты, которые тот же прогон выполняет другим шагом: `test:governance` — страж
 * списка, выборочные наборы `check:fast` — шаг `fast-scope-checks` preflight.
 */
const alreadyRunTests = ({ guards, changedFiles, env = process.env }) => [
  ...(guards.some((item) => item.id === 'test:governance') ? governanceTestsFromPackage() : []),
  ...(env[PREFLIGHT_SELECTIVE_TESTS_ENV] === '1' ? listSelectiveTests(changedFiles) : []),
]

/** Причина красного шага связанных тестов: поимённо красные файлы. */
const describeRelatedFailure = (failed) => (failed.length
  ? `красные тесты, связанные с diff'ом: ${failed.join(', ')}`
  : 'Jest завершился с ошибкой, не отдав результат')

/** Команда запуска стража: npm-скрипт по имени либо eslint из локальных node_modules. */
const buildGuardInvocation = (item) => {
  if (item.script) {
    return { command: process.platform === 'win32' ? 'npm.cmd' : 'npm', args: ['run', item.script] }
  }
  const [binary, ...rest] = String(item.command || '').split(/\s+/).filter(Boolean)
  if (binary !== 'eslint') {
    throw new Error(`unsupported guard command: ${item.command}`)
  }
  return { command: process.execPath, args: [ESLINT_BIN_PATH, ...rest] }
}

const runGuard = (item) => {
  const { command, args } = buildGuardInvocation(item)
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: 'inherit',
    env: guardEnv(),
    shell: process.platform === 'win32' && command !== process.execPath,
  })
  return result.status ?? 1
}

const runGit = (args) => {
  const result = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return result.status === 0 ? String(result.stdout || '') : ''
}

/**
 * Дешёвый признак диффа, которому может понадобиться пробная прод-сборка:
 * строки импорта, добавленные в рантайм-модули относительно базиса с `origin/main`.
 * Любая ошибка git — «признака нет»: предупреждение не имеет права ронять прогон.
 */
const collectImportAdditions = (changedFiles) => {
  try {
    const runtimeFiles = changedFiles.filter(isRuntimeSourcePath)
    if (runtimeFiles.length === 0) return []
    const base = runGit(['merge-base', 'origin/main', 'HEAD']).trim() || 'HEAD'
    const diff = runGit(['diff', '--no-color', '--no-renames', '--unified=0', base, '--', ...runtimeFiles])
    return findImportAdditions(diff)
  } catch {
    return []
  }
}

const formatBundleProbeWarning = (additions) => {
  if (!additions.length) return []
  const shown = additions.slice(0, 8).map((item) => `${item.file} (+${item.added})`).join(', ')
  const rest = additions.length > 8 ? ` … (+${additions.length - 8})` : ''
  return [
    `${CHECK_NAME}: ВНИМАНИЕ — diff добавляет импорты в рантайм-модули (${additions.length}): ${shown}${rest}`,
    `${CHECK_NAME}: если модуль входит в eager-граф или общий чанк, до push обязательна пробная прод-сборка: ${BUNDLE_PROBE_RULE.command} (правило и снимок — scripts/pre-push-guards.js → BUNDLE_PROBE_RULE)`,
  ]
}

const main = () => {
  try {
    const args = parseArgs(process.argv.slice(2))
    if (args.output === 'json' && !args.dryRun) {
      console.error(`${CHECK_NAME}: --json is supported only with --dry-run.`)
      process.exit(2)
    }

    const guards = selectGuards(args)
    const stage = args.relatedOnly ? 'related-only' : args.all ? 'all' : STAGE_PRE_PUSH
    // Ошибка git при сборе scope не роняет стражей: они читают дерево целиком.
    // Связанные тесты без scope выбрать нельзя — после стражей шаг становится красным.
    let changedFiles = []
    let scopeError = ''
    try {
      changedFiles = resolveChangedFilesInput(args).files
    } catch (error) {
      changedFiles = []
      scopeError = String(error.message || error).trim().split('\n')[0]
    }
    const importAdditions = args.relatedOnly ? [] : collectImportAdditions(changedFiles)
    // Сбой отбора — красный шаг, а не «тестов нет»: молчаливо пустая выборка и есть #3468.
    const related = selectRelatedTests({
      changedFiles,
      full: args.full,
      alreadyRun: alreadyRunTests({ guards, changedFiles }),
    })

    if (args.output === 'json') {
      process.stdout.write(`${JSON.stringify({
        contractVersion: 1,
        check: CHECK_NAME,
        stage,
        guards: guards.map((item) => item.id),
        docContractTests: related.docContracts,
        relatedTests: {
          rule: RELATED_TESTS_RULE.id,
          ceiling: related.ceiling,
          full: related.full,
          graphInputs: related.graphInputs.length,
          graph: related.graph.length,
          mocks: related.mocks,
          dataSuites: related.dataSuites.length,
          overCeiling: related.overCeiling,
          wholeSuiteFiles: related.wholeSuiteFiles,
          notRun: related.notRun.length,
          selected: related.selected,
        },
        bundleProbe: { rule: BUNDLE_PROBE_RULE.id, importAdditions },
      }, null, 2)}\n`)
      return
    }

    console.log(`${CHECK_NAME}: stage=${stage}, guards=${guards.length}: ${guards.map((item) => item.id).join(', ')}`)
    for (const line of formatRelatedSelection(related, `${CHECK_NAME}: ${RELATED_LABEL}`)) console.log(line)
    if (scopeError) console.log(`${CHECK_NAME}: ${RELATED_LABEL}: изменённые файлы не определены (${scopeError}) — связанные тесты не выбраны`)
    for (const line of formatBundleProbeWarning(importAdditions)) console.log(line)

    if (args.dryRun) {
      console.log(`${CHECK_NAME}: dry-run, guards not executed.`)
      return
    }

    const startedAt = Date.now()
    for (const item of guards) {
      const status = runGuard(item)
      if (status !== 0) {
        console.error(formatGuardFailure(item.id, status, item.why))
        process.exit(status)
      }
    }
    if (scopeError) {
      console.error(formatGuardFailure(RELATED_LABEL, 1, `изменённые файлы не определены (${scopeError}): связанные тесты не выбраны`))
      process.exit(1)
    }
    if (related.selected.length) {
      const { status, failed } = runRelatedTests(related.selected, { env: guardEnv() })
      if (status !== 0) {
        console.error(formatGuardFailure(RELATED_LABEL, status, describeRelatedFailure(failed)))
        process.exit(status)
      }
    }
    // Незапущенное повторяется в итоговой строке: предупреждение выше уезжает за вывод Jest.
    const notRun = related.notRun.length ? `, ${related.notRun.length} related tests NOT RUN — ${RELATED_TESTS_RULE.fullCommand}` : ''
    console.log(`${CHECK_NAME}: PASS (${guards.length} guards, ${related.selected.length} related tests${notRun}, ${((Date.now() - startedAt) / 1000).toFixed(1)} s)`)
  } catch (error) {
    console.error(`${CHECK_NAME}: failed: ${String(error.message || error)}`)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  CHECK_NAME,
  SKIPPED_EXIT_CODE,
  alreadyRunTests,
  describeRelatedFailure,
  guardEnv,
  formatGuardFailure,
  parseArgs,
  selectGuards,
  buildGuardInvocation,
  collectImportAdditions,
  findDocContractTests,
  formatBundleProbeWarning,
}
