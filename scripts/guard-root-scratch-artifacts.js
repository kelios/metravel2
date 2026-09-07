const { execFileSync } = require('child_process')

const { isAllowedEnvPlaceholder } = require('./guard-env-secrets')

// Guard семьи DEVTOOL-SCRATCH-ARTIFACT-IGNORE-GAP-001 (#1466 → #1846 → #1852).
//
// Корень репозитория — ЗАКРЫТЫЙ список. Это главное отличие от #1846: там
// корневые файлы отклонялись по denylist'у угаданных конвенций
// (`.codex-temp*`, `__*.js`, `_tmp-*`, `*.tmp.*`), и каждая новая сессия
// приносила конвенцию, которой список ещё не знал. Третий эпизод наступил
// прямо во время #1846: параллельная сессия положила в корень
// `probe1847*.tmp.mjs`, общий eslint покраснел у всех, и `*.tmp.*` был добавлен
// уже по факту. Назови та же сессия файл `probe1847.mjs` — не поймал бы никто.
//
// Denylist по определению неполон, allow-list — полон. Корневых файлов около
// трёх десятков, список меняется реже раза в квартал, поэтому цена закрытого
// списка — одна строка при появлении настоящего корневого файла, а выигрыш —
// любое незнакомое имя отклоняется по умолчанию.
//
// Конвенции scratch-имён при этом СОХРАНЕНЫ, но переехали из решения
// «пропускать/отклонять» в классификацию сообщения: «похоже на одноразовый
// артефакт — унеси в `.codex-temp/`» против «новый корневой файл — если он
// настоящий, объяви его здесь». Без этого разделения автор настоящего конфига
// получал бы совет выбросить свой файл.
//
// Область чтения — ДВА среза корня, и оба обязательны:
//   * `git ls-files` — индекс. Артефакт, который уже уехал на `origin/main`
//     (эпизод #1846), виден только здесь.
//   * `git ls-files --others --exclude-standard` — untracked и НЕ игнорируемые.
//     Это ровно те файлы, которые eslint прочитает локально, а `git add -A`
//     свипнет в чужой коммит. Живой эпизод `probe1847*.tmp.mjs` был именно
//     таким: индекс его не видел, а общий `npm run lint` уже краснел. До #1852
//     этот случай был записан как «не дефект репозитория» — запись оказалась
//     неверной, потому что чинить его приходилось всем сразу.
// Игнорируемый untracked-файл в срез не попадает: он не виден ни git, ни
// eslint, и вреда не наносит. Рекурсивного обхода дерева здесь по-прежнему нет:
// вложенные каталоги имеют своих владельцев, а `.claude/worktrees/` содержит
// чужие checkout'ы параллельных сессий.

const OUTPUT_CONTRACT_VERSION = 2

const GUARD_SOURCE = 'scripts/guard-root-scratch-artifacts.js'

const GIT_PATH_ARGS = ['-c', 'core.quotePath=false']

// Закрытый список корневых файлов репозитория. Каждое имя здесь — осознанное
// решение владельца конфигурации, а не побочный эффект `git add`. Тест
// `keeps the allow-list in sync with what git actually tracks` держит список
// живым в обе стороны: нетрекаемое имя здесь — мёртвая запись, трекаемое имя
// не отсюда — дыра.
const ALLOWED_ROOT_FILES = new Set([
  '.gitattributes',
  '.gitignore',
  '.mcp.json',
  '.node-version',
  '.npmrc',
  '.nvmrc',
  'AGENTS.md',
  'CLAUDE.md',
  'README.md',
  'app.config.js',
  'app.json',
  'babel.config.js',
  'build-dev.sh',
  'build-prod.sh',
  'build.sh',
  'eas.json',
  'entry.js',
  'eslint.config.js',
  'global.d.ts',
  'google-play-service-account.json.example',
  'google-services.json.example',
  'jest.config.js',
  'jest.expo-globals.js',
  'metro.config.js',
  'metro.config.optimized.js',
  'package.json',
  'playwright.config.ts',
  'queryClient.ts',
  'queryKeys.ts',
  'tsconfig.e2e.json',
  'tsconfig.json',
  'verify-security-fixes.sh',
  'yarn.lock',
])

// Единственная конвенция, по которой новый корневой файл появляется штатно и
// не требует правки списка выше: пример env без значений. Что считается таким
// примером, решает `guard-env-secrets.js` — иначе два guard'а разойдутся в
// трактовке одного и того же имени. Именно поэтому `.env.deploy.example` и
// `.env.media-ops.example` в `ALLOWED_ROOT_FILES` не перечислены.
const ALLOWED_ROOT_CONVENTIONS = [
  { id: 'env-placeholder', matches: (name) => isAllowedEnvPlaceholder(name) },
]

// Конвенции одноразовых артефактов. На вердикт они больше не влияют — файл вне
// allow-list отклоняется в любом случае, — но определяют, какой из двух
// советов получит автор.
const SCRATCH_NAME_PATTERNS = [
  /^\.codex-temp/,
  /^\.codex-debug/,
  /^\.quest-audit/,
  /^\.tmp-/,
  /^\.chk-/,
  /^__.+\.[cm]?[jt]sx?$/,
  /^_tmp-/,
  /\.tmp\.[^.]+$/,
]

const SCRATCH_REMEDIATION =
  'похоже на одноразовый артефакт сессии — унеси его в .codex-temp/, .codex-debug/, test-results/ или playwright-report/ (AGENTS.md §3)'

const UNKNOWN_REMEDIATION =
  `новый файл в корне репозитория — если это настоящий файл проекта, объяви его в ALLOWED_ROOT_FILES (${GUARD_SOURCE}); если это разовый артефакт, унеси его в .codex-temp/`

const REMEDIATION_BY_KIND = {
  scratch: SCRATCH_REMEDIATION,
  unknown: UNKNOWN_REMEDIATION,
}

const ORIGIN_LABEL = {
  tracked: 'в git',
  untracked: 'untracked, но не игнорируется',
}

const normalizePath = (value) => String(value || '').replace(/\\/g, '/')

const parseArgs = (argv) => ({
  output: argv.includes('--json') ? 'json' : 'text',
})

const isRootFile = (relativePath) => {
  const file = normalizePath(relativePath)
  return file.length > 0 && !file.includes('/')
}

const isAllowedRootFile = (relativePath) => {
  const file = normalizePath(relativePath)
  if (!isRootFile(file)) return true
  return ALLOWED_ROOT_FILES.has(file) || ALLOWED_ROOT_CONVENTIONS.some((rule) => rule.matches(file))
}

const looksLikeScratchArtifact = (relativePath) => {
  const file = normalizePath(relativePath)
  if (!isRootFile(file)) return false
  return SCRATCH_NAME_PATTERNS.some((pattern) => pattern.test(file))
}

// 'allowed' — файл объявлен; 'scratch' и 'unknown' — оба нарушение, различаются
// только советом.
const classifyRootFile = (relativePath) => {
  if (isAllowedRootFile(relativePath)) return 'allowed'
  return looksLikeScratchArtifact(relativePath) ? 'scratch' : 'unknown'
}

const collectViolations = (files, origin) => {
  const violations = []
  for (const candidate of files) {
    const file = normalizePath(candidate)
    if (!isRootFile(file)) continue
    const kind = classifyRootFile(file)
    if (kind === 'allowed') continue
    violations.push({ file, kind, origin, remediation: REMEDIATION_BY_KIND[kind] })
  }
  return violations
}

const findViolations = ({ trackedFiles = [], untrackedFiles = [] } = {}) => [
  ...collectViolations(trackedFiles, 'tracked'),
  ...collectViolations(untrackedFiles, 'untracked'),
]

const evaluateGuard = ({ trackedFiles = [], untrackedFiles = [] } = {}) => {
  const violations = findViolations({ trackedFiles, untrackedFiles })

  if (violations.length === 0) {
    return {
      ok: true,
      reason: 'В корне репозитория нет файлов вне allow-list',
      violations: [],
    }
  }

  return {
    ok: false,
    reason: `Корень репозитория — закрытый список (ALLOWED_ROOT_FILES в ${GUARD_SOURCE}). Одноразовым артефактам место в .codex-temp/, настоящий корневой файл объявляется в списке.`,
    violations,
  }
}

// `git ls-files` без pathspec перечисляет только поддерево текущего каталога:
// запуск из `scripts/` вернул бы ноль корневых файлов, и guard отчитался бы
// «passed», ничего не прочитав. Область чтения привязывается к корню репозитория.
const resolveRepoRoot = (cwd = process.cwd()) =>
  execFileSync('git', [...GIT_PATH_ARGS, '-C', cwd, 'rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  }).trim()

// `-z` + `core.quotePath=false` обязательны, а не гигиена: при дефолтном
// `core.quotePath` git отдаёт не-ASCII путь в кавычках с октальными escape'ами
// (`".codex-\321\202..."`). Такое имя перестаёт начинаться с точки, guard
// отчитался бы «passed» на реальном артефакте — и именно на чистом CI-runner'е,
// где нет локального system-конфига, который глушит квотирование на этой машине.
const runGitList = (rootDir, extraArgs) =>
  execFileSync('git', [...GIT_PATH_ARGS, '-C', rootDir, 'ls-files', '-z', '--full-name', ...extraArgs], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\0')
    .filter(Boolean)

const listTrackedFiles = (rootDir = resolveRepoRoot()) => runGitList(rootDir, [])

// `--exclude-standard` отсекает всё, что уже игнорируется: такой файл не видит
// ни git, ни eslint, и общий гейт он не красит. Остаётся ровно опасный срез —
// untracked и не игнорируемый.
const listUntrackedFiles = (rootDir = resolveRepoRoot()) =>
  runGitList(rootDir, ['--others', '--exclude-standard'])

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

const formatViolation = (violation) =>
  `${violation.file} [${ORIGIN_LABEL[violation.origin] || violation.origin}]: ${violation.remediation}`

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const rootDir = resolveRepoRoot()
  const result = evaluateGuard({
    trackedFiles: listTrackedFiles(rootDir),
    untrackedFiles: listUntrackedFiles(rootDir),
  })

  if (args.output === 'json') {
    process.stdout.write(`${JSON.stringify(buildJsonResult(result), null, 2)}\n`)
    if (!result.ok) process.exit(1)
    return
  }

  if (result.ok) {
    console.log(`root-scratch-artifacts: passed. ${result.reason}`)
    return
  }

  console.error('root-scratch-artifacts: failed.')
  console.error(`- ${result.reason}`)
  result.violations.forEach((violation) => console.error(`- ${formatViolation(violation)}`))
  process.exit(1)
}

if (require.main === module) {
  main()
}

module.exports = {
  OUTPUT_CONTRACT_VERSION,
  GUARD_SOURCE,
  ALLOWED_ROOT_FILES,
  ALLOWED_ROOT_CONVENTIONS,
  SCRATCH_NAME_PATTERNS,
  SCRATCH_REMEDIATION,
  UNKNOWN_REMEDIATION,
  GIT_PATH_ARGS,
  parseArgs,
  isRootFile,
  isAllowedRootFile,
  looksLikeScratchArtifact,
  classifyRootFile,
  findViolations,
  evaluateGuard,
  resolveRepoRoot,
  listTrackedFiles,
  listUntrackedFiles,
  buildJsonResult,
  formatViolation,
}
