'use strict'

/**
 * Исполнитель единого списка стражей до push (`scripts/pre-push-guards.js`, #3371).
 *
 *   node scripts/run-pre-push-guards.js                 стадия `pre-push` — шаг `check:preflight`
 *   node scripts/run-pre-push-guards.js --all           весь список — `npm run guard:pre-push`
 *   … --dry-run [--json]                                только план, ничего не запускает
 *   … --changed-files-file <файл> | --base-ref <ref>    scope для предупреждения о пробной сборке
 *                                                       и для Jest-контрактов изменённых документов
 *
 * Занятый quality-gate lock: Jest-шаг (`test:governance`, контракты документов) при
 * прямом `npm run guard:pre-push` выходил нейтрально с кодом 0, и прогон печатал
 * `PASS` без обязательного шага. Теперь шаг выходит с `SKIPPED_EXIT_CODE`, прогон
 * печатает `SKIPPED` и завершается этим кодом. Внутри `check:preflight` lock уже
 * принадлежит обёртке, там пропуска нет.
 *
 * Стражи читают рабочее дерево целиком, а не коммит: красное в чужом
 * незакоммиченном файле соседней сессии остановит и чужой push. Порядок на этот
 * случай — `docs/TASK_BOARD_MCP.md` → «Коммит и пуш — часть перехода `review → testing`».
 */

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { resolveChangedFilesInput } = require('./run-local-selective-checks')
const { QUALITY_GATE_BUSY_EXIT_ENV } = require('./quality-gate-lock')
const {
  STAGE_PRE_PUSH,
  PRE_PUSH_GUARDS,
  BUNDLE_PROBE_RULE,
  guardsForStage,
  isRuntimeSourcePath,
  findImportAdditions,
} = require('./pre-push-guards')

const CHECK_NAME = 'pre-push-guards'
const ESLINT_BIN_PATH = path.resolve(process.cwd(), 'node_modules/eslint/bin/eslint.js')
const JEST_BIN_PATH = path.resolve(process.cwd(), 'node_modules/jest/bin/jest.js')
// EX_TEMPFAIL: обязательный шаг не выполнен, потому что quality-gate lock занят.
const SKIPPED_EXIT_CODE = 75

const guardEnv = () => ({ ...process.env, [QUALITY_GATE_BUSY_EXIT_ENV]: String(SKIPPED_EXIT_CODE) })

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
    if (token === '--json') {
      out.output = 'json'
    }
  }

  return out
}

const selectGuards = ({ all }) => (all ? [...PRE_PUSH_GUARDS] : guardsForStage(STAGE_PRE_PUSH))

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

/**
 * Jest-контракты изменённых документов и данных. Тест, который читает документ
 * по литералу пути (`'docs/features/ai-assistant.md'`), краснеет от правки
 * одного документа, а выборочные наборы preflight подбирают тесты только по
 * коду: так `metravel-llm-manifest.test.ts` ушёл в `main` красным с полным
 * sha256 в документе ассистента (`781314569`, #3357). Ищется путь в одинарных
 * или двойных кавычках — то есть в коде теста; упоминание в комментарии
 * (обратные кавычки) тест не выбирает.
 */
const DOC_CONTRACT_PATTERN = /\.(?:md|json)$/
// Контракты скриптов `package.json` уже держит `test:governance` из того же шага,
// а литерал `'package.json'` читают десятки тестов-фикстур.
const DOC_CONTRACT_SKIP = new Set(['package.json'])
const TEST_FILE_PATTERN = /\.test\.[jt]sx?$/
const TESTS_ROOT = '__tests__'

const listTestFiles = (root, dir = TESTS_ROOT) => {
  let entries
  try {
    entries = fs.readdirSync(path.join(root, dir), { withFileTypes: true })
  } catch {
    return []
  }
  return entries.flatMap((entry) => {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) return listTestFiles(root, rel)
    return entry.isFile() && TEST_FILE_PATTERN.test(entry.name) ? [rel] : []
  })
}

const findDocContractTests = (changedFiles, root = process.cwd()) => {
  const docs = [...new Set((changedFiles || []).map((file) => String(file || '').replace(/\\/g, '/')))]
    .filter((file) => DOC_CONTRACT_PATTERN.test(file) && !DOC_CONTRACT_SKIP.has(file) && !file.startsWith(`${TESTS_ROOT}/`))
  if (!docs.length) return []
  const needles = docs.flatMap((file) => [`'${file}'`, `"${file}"`])
  return listTestFiles(root)
    .filter((file) => {
      const source = fs.readFileSync(path.join(root, file), 'utf8')
      return needles.some((needle) => source.includes(needle))
    })
    .sort()
}

const runDocContractTests = (tests) => {
  const result = spawnSync(process.execPath, [JEST_BIN_PATH, '--runInBand', '--watchAll=false', ...tests], {
    encoding: 'utf8',
    stdio: 'inherit',
    env: guardEnv(),
  })
  return result.status ?? 1
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
    const stage = args.all ? 'all' : STAGE_PRE_PUSH
    // Ошибка git при сборе scope не роняет стражей: они читают дерево целиком.
    let changedFiles = []
    try {
      changedFiles = resolveChangedFilesInput(args).files
    } catch {
      changedFiles = []
    }
    const importAdditions = collectImportAdditions(changedFiles)
    const docContractTests = findDocContractTests(changedFiles)

    if (args.output === 'json') {
      process.stdout.write(`${JSON.stringify({
        contractVersion: 1,
        check: CHECK_NAME,
        stage,
        guards: guards.map((item) => item.id),
        docContractTests,
        bundleProbe: { rule: BUNDLE_PROBE_RULE.id, importAdditions },
      }, null, 2)}\n`)
      return
    }

    console.log(`${CHECK_NAME}: stage=${stage}, guards=${guards.length}: ${guards.map((item) => item.id).join(', ')}`)
    if (docContractTests.length) {
      console.log(`${CHECK_NAME}: doc-contract tests for changed docs/data (${docContractTests.length}): ${docContractTests.join(', ')}`)
    }
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
    if (docContractTests.length) {
      const status = runDocContractTests(docContractTests)
      if (status !== 0) {
        console.error(formatGuardFailure('doc-contract tests', status, `тест читает изменённый документ по пути: ${docContractTests.join(', ')}`))
        process.exit(status)
      }
    }
    console.log(`${CHECK_NAME}: PASS (${guards.length} guards, ${docContractTests.length} doc-contract tests, ${((Date.now() - startedAt) / 1000).toFixed(1)} s)`)
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
  guardEnv,
  formatGuardFailure,
  parseArgs,
  selectGuards,
  buildGuardInvocation,
  collectImportAdditions,
  findDocContractTests,
  formatBundleProbeWarning,
}
