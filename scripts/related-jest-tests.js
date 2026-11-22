'use strict'

/**
 * Jest-тесты, связанные с изменёнными файлами (#3468, RED-TEST-ON-MAIN-OUTSIDE-GATE-001).
 * Правило и замеры — `scripts/pre-push-guards.js` → `RELATED_TESTS_RULE`; запуск —
 * шаг `pre-push-guards` (`scripts/run-pre-push-guards.js`) и `npm run test:related`.
 *
 * Выбирается объединение четырёх источников:
 *   graph        — тесты, которые импортируют изменённый модуль напрямую или
 *                  транзитивно: граф зависимостей самого Jest
 *                  (`jest --listTests --findRelatedTests`), а не свой разбор импортов;
 *   mocks        — тесты, которые подменяют изменённый модуль (`jest.mock`,
 *                  `jest.doMock` по пути). Граф их не гарантирует: на 22.11.2026
 *                  в репозитории 57 пар «тест → подменённый модуль» вне графа
 *                  (платформенные файлы `*.web.tsx`, модуль за другой подменой);
 *   docContracts — тесты, читающие изменённый документ по литералу пути (#3371);
 *   dataSuites   — собственный набор данных вместо графа (локали → `__tests__/i18n`).
 *
 * Потолок: граф больше `RELATED_TESTS_RULE.ceiling` не усекается молча — идут
 * только обязательные (изменённые тесты, mocks, docContracts, dataSuites), а
 * отчёт называет число незапущенных и команду, которой их прогнать. Так же
 * называется весь остальной набор, когда diff меняет конфигурацию Jest
 * (`RELATED_TESTS_RULE.wholeSuiteInputs`): `full` тогда запускает набор целиком.
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')
const { RELATED_TESTS_RULE } = require('./pre-push-guards')

// Jest берётся от самого скрипта, а конфиг — из каталога проекта (`cwd`).
const JEST_BIN_PATH = path.join(__dirname, '..', 'node_modules', 'jest', 'bin', 'jest.js')
const TESTS_ROOT = '__tests__'
const TEST_FILE_PATTERN = /\.test\.[jt]sx?$/
const MODULE_EXTENSION_PATTERN = /\.(?:[cm]?[jt]sx?|json)$/
const PLATFORM_SUFFIX_PATTERN = /\.(?:web|native|ios|android)$/
// Текстовые файлы вне графа импортов: документы, данные, shell/python-скрипты и CI-конфиги.
// Их контракт — тест, читающий файл по пути (`deploy-prod.test.ts` → `'scripts/deploy-prod.sh'`).
const DOC_CONTRACT_PATTERN = /\.(?:md|json|sh|py|ya?ml)$/
// Контракты скриптов `package.json` уже держит `test:governance` из того же шага,
// а литерал `'package.json'` читают десятки тестов-фикстур.
const DOC_CONTRACT_SKIP = new Set(['package.json'])
// Псевдоним корня из `jest.config.js` → `moduleNameMapper` (`'^@/(.*)$': '<rootDir>/$1'`).
const ROOT_ALIAS = '@/'
const MOCK_CALL_PATTERN = /\bjest\s*\.\s*(?:mock|doMock|unstable_mockModule|setMock)\s*\(\s*(['"`])([^'"`\n]+)\1/g

const toPosix = (filePath) => String(filePath || '').replace(/\\/g, '/')
const uniqueSorted = (list) => [...new Set(list)].sort()
const isTestFile = (filePath) => filePath.startsWith(`${TESTS_ROOT}/`) && TEST_FILE_PATTERN.test(filePath)
const dataSuiteFor = (filePath) => RELATED_TESTS_RULE.dataSuites.find((suite) => filePath.startsWith(suite.prefix))
const isWholeSuiteInput = (filePath) => RELATED_TESTS_RULE.wholeSuiteInputs
  .some((input) => (input.endsWith('/') ? filePath.startsWith(input) : filePath === input))

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

/** Исходники тестов читаются один раз на отбор: их просматривают и подмены, и контракты документов. */
const createTestIndex = (root) => {
  let files = null
  const sources = new Map()
  return {
    files: () => {
      if (!files) files = listTestFiles(root).sort()
      return files
    },
    source: (file) => {
      if (!sources.has(file)) sources.set(file, fs.readFileSync(path.join(root, file), 'utf8'))
      return sources.get(file)
    },
  }
}

/**
 * Jest-контракты изменённых документов и данных. Тест, который читает документ
 * по литералу пути (`'docs/features/ai-assistant.md'`), краснеет от правки
 * одного документа, а граф импортов такой связи не знает: так
 * `metravel-llm-manifest.test.ts` ушёл в `main` красным с полным sha256 в
 * документе ассистента (`781314569`, #3357). Ищется путь в одинарных или
 * двойных кавычках — то есть в коде теста; упоминание в комментарии (обратные
 * кавычки) тест не выбирает.
 */
const findDocContractTests = (changedFiles, root = process.cwd(), index = createTestIndex(root)) => {
  const docs = uniqueSorted((changedFiles || []).map(toPosix))
    .filter((file) => DOC_CONTRACT_PATTERN.test(file) && !DOC_CONTRACT_SKIP.has(file) && !file.startsWith(`${TESTS_ROOT}/`))
  if (!docs.length) return []
  const needles = docs.flatMap((file) => [`'${file}'`, `"${file}"`])
  return index.files().filter((file) => needles.some((needle) => index.source(file).includes(needle)))
}

/** `utils/links.web.ts`, `utils/links/index.ts` и `@/utils/links` — один и тот же модуль для `jest.mock`. */
const moduleKey = (filePath) => toPosix(filePath)
  .replace(MODULE_EXTENSION_PATTERN, '')
  .replace(PLATFORM_SUFFIX_PATTERN, '')
  .replace(/\/index$/, '')

const mockSpecifierKey = (specifier, testFile) => {
  if (specifier.startsWith(ROOT_ALIAS)) return moduleKey(specifier.slice(ROOT_ALIAS.length))
  if (specifier.startsWith('.')) return moduleKey(path.posix.join(path.posix.dirname(testFile), specifier))
  return ''
}

/**
 * Тесты, которые подменяют изменённый модуль. Образец —
 * `tripCreateScreen.authGate.test.tsx`: подмена `@/utils/tripPlanLinks` целиком
 * перестала отдавать имена, которые начал брать импортёр (`8791989d1`).
 * Удалённый модуль тоже считается: подмена несуществующего пути роняет тест.
 */
const findMockingTests = (changedFiles, root = process.cwd(), index = createTestIndex(root)) => {
  const changedKeys = new Set((changedFiles || [])
    .map(toPosix)
    .filter((file) => MODULE_EXTENSION_PATTERN.test(file) && !isTestFile(file))
    .map(moduleKey))
  if (!changedKeys.size) return []
  return index.files().filter((file) => {
    const source = index.source(file)
    if (!source.includes('jest')) return false
    for (const match of source.matchAll(MOCK_CALL_PATTERN)) {
      if (changedKeys.has(mockSpecifierKey(match[2], file))) return true
    }
    return false
  })
}

/** Что отдаётся графу Jest: существующие модули и JSON; данные со своим набором — только при `full`. */
const graphInputsFor = (changedFiles, root, { full = false } = {}) => changedFiles
  .filter((file) => MODULE_EXTENSION_PATTERN.test(file))
  .filter((file) => full || !dataSuiteFor(file))
  .filter((file) => fs.existsSync(path.join(root, file)))

const listGraphTests = (inputs, root = process.cwd()) => {
  if (!inputs.length) return []
  const result = spawnSync(process.execPath, [JEST_BIN_PATH, '--listTests', '--findRelatedTests', ...inputs], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || result.error?.message || '').trim().split('\n').slice(0, 3).join(' | ')
    throw new Error(`jest --listTests --findRelatedTests failed (exit ${result.status}): ${detail}`)
  }
  const realRoot = fs.realpathSync(root)
  return uniqueSorted(String(result.stdout || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => path.isAbsolute(line))
    .map((line) => toPosix(path.relative(realRoot, line)))
    .filter((file) => !file.startsWith('..')))
}

/**
 * @param changedFiles пути от корня проекта
 * @param alreadyRun тесты, которые тот же прогон выполняет другим шагом (`test:governance`,
 *        выборочные наборы `check:fast` внутри preflight) — второй раз не идут
 * @param full ручной шаг: без потолка, данные со своим набором раскрываются графом
 */
const selectRelatedTests = ({
  changedFiles,
  root = process.cwd(),
  ceiling = RELATED_TESTS_RULE.ceiling,
  full = false,
  alreadyRun = [],
} = {}) => {
  const files = uniqueSorted((changedFiles || []).map(toPosix).filter(Boolean))
  const skip = new Set(alreadyRun)
  const keep = (tests) => uniqueSorted(tests).filter((test) => !skip.has(test))
  const index = createTestIndex(root)

  const graphInputs = graphInputsFor(files, root, { full })
  const graph = keep(listGraphTests(graphInputs, root))
  const changedTests = keep(files.filter((file) => isTestFile(file) && fs.existsSync(path.join(root, file))))
  const mocks = keep(findMockingTests(files, root, index))
  const docContracts = keep(findDocContractTests(files, root, index))
  const dataFiles = full ? [] : files.filter((file) => dataSuiteFor(file))
  const suites = uniqueSorted(dataFiles.map((file) => dataSuiteFor(file).suite))
  const dataSuites = keep(index.files().filter((test) => suites.some((suite) => test.startsWith(`${suite}/`))))

  const mandatory = uniqueSorted([...changedTests, ...mocks, ...docContracts, ...dataSuites])
  const overCeiling = !full && graph.length > ceiling
  // Изменена конфигурация Jest: граф затронутых тестов не знает, затронут весь набор.
  const wholeSuiteFiles = files.filter(isWholeSuiteInput)
  const wholeSuite = wholeSuiteFiles.length ? keep(index.files()) : []
  const selected = full && wholeSuite.length
    ? uniqueSorted([...wholeSuite, ...mandatory])
    : overCeiling ? mandatory : uniqueSorted([...graph, ...mandatory])
  const selectedSet = new Set(selected)
  const notRunPool = !full && wholeSuite.length ? wholeSuite : overCeiling ? graph : []

  return {
    ceiling,
    full,
    graphInputs,
    graph,
    changedTests,
    mocks,
    mocksOutsideGraph: mocks.filter((test) => !graph.includes(test)),
    docContracts,
    dataFiles,
    dataSuites,
    overCeiling,
    wholeSuiteFiles,
    selected,
    notRun: notRunPool.filter((test) => !selectedSet.has(test)),
  }
}

/** Строки отчёта шага: состав выборки и, если есть, незапущенное с командой. */
const formatRelatedSelection = (selection, prefix = 'related tests') => {
  const lines = [
    `${prefix}: ${selection.selected.length} к запуску — граф Jest ${selection.graph.length} (по ${selection.graphInputs.length} изменённым модулям), подмены jest.mock ${selection.mocks.length} (вне графа ${selection.mocksOutsideGraph.length}), контракты документов ${selection.docContracts.length}, наборы данных ${selection.dataSuites.length}`,
  ]
  if (selection.overCeiling) {
    lines.push(
      `${prefix}: ВНИМАНИЕ — граф Jest даёт ${selection.graph.length} тестов, потолок ${selection.ceiling}. Запускаются только обязательные (${selection.selected.length}: изменённые тесты, подмены, контракты документов, наборы данных); НЕ ЗАПУЩЕНО ${selection.notRun.length}.`,
      `${prefix}: обязательный ручной шаг до push: ${RELATED_TESTS_RULE.fullCommand} (после коммита — с \`--base-ref origin/main\`)`,
    )
  }
  if (selection.wholeSuiteFiles?.length && !selection.full) {
    lines.push(
      `${prefix}: ВНИМАНИЕ — изменена конфигурация, setup или зависимости Jest (${selection.wholeSuiteFiles.join(', ')}): граф затронутых тестов не знает, затронут весь набор; НЕ ЗАПУЩЕНО ${selection.notRun.length}.`,
      `${prefix}: обязательный ручной шаг до push: ${RELATED_TESTS_RULE.fullCommand} (весь набор; после коммита — с \`--base-ref origin/main\`)`,
    )
  }
  if (selection.dataFiles.length) {
    const suites = uniqueSorted(selection.dataFiles.map((file) => dataSuiteFor(file).suite))
    lines.push(
      `${prefix}: изменены данные со своим набором (${selection.dataFiles.length} файлов: ${uniqueSorted(selection.dataFiles.map((file) => dataSuiteFor(file).prefix)).join(', ')}) — граф по ним не раскрывается, идёт ${suites.join(', ')}. Если diff меняет или удаляет существующие строки, обязателен ручной шаг: ${RELATED_TESTS_RULE.fullCommand}`,
    )
  }
  return lines
}

/** Запуск выбранных тестов. Возвращает код Jest и красные файлы — их называет итоговая строка шага. */
const runRelatedTests = (tests, { root = process.cwd(), env = process.env, maxWorkers = RELATED_TESTS_RULE.maxWorkers } = {}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'related-jest-'))
  const outputFile = path.join(dir, 'result.json')
  try {
    const result = spawnSync(process.execPath, [
      JEST_BIN_PATH,
      '--watchAll=false',
      `--maxWorkers=${maxWorkers}`,
      '--json',
      `--outputFile=${outputFile}`,
      '--runTestsByPath',
      ...tests,
    ], { cwd: root, stdio: 'inherit', env })
    let failed = []
    try {
      const realRoot = fs.realpathSync(root)
      failed = uniqueSorted(JSON.parse(fs.readFileSync(outputFile, 'utf8')).testResults
        .filter((suite) => suite.status === 'failed')
        .map((suite) => toPosix(path.relative(realRoot, suite.name))))
    } catch {
      failed = []
    }
    return { status: result.status ?? 1, failed }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

/** Тесты из команды `test:governance`: тот же шаг уже выполняет их стражем списка. */
const governanceTestsFromPackage = (root = process.cwd()) => {
  try {
    const script = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts['test:governance']
    return String(script || '').split(/\s+/).filter((token) => isTestFile(token))
  } catch {
    return []
  }
}

module.exports = {
  JEST_BIN_PATH,
  listTestFiles,
  createTestIndex,
  findDocContractTests,
  moduleKey,
  mockSpecifierKey,
  findMockingTests,
  graphInputsFor,
  listGraphTests,
  selectRelatedTests,
  formatRelatedSelection,
  runRelatedTests,
  governanceTestsFromPackage,
}
