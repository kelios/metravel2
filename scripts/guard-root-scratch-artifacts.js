const { execFileSync } = require('child_process')

const { isAllowedEnvPlaceholder } = require('./guard-env-secrets')

// Guard #1846 (семья DEVTOOL-SCRATCH-ARTIFACT-IGNORE-GAP-001, второй эпизод
// после #1466): запрещает трекать в git одноразовые артефакты сессий, которые
// легли в корень репозитория отдельным dotfile-ом.
//
// Почему именно корень и именно git-index. `.gitignore` и `eslint.config.js`
// перечисляют КАТАЛОГИ временных артефактов (`.codex-temp/`, `.codex-debug/`,
// `.quest-audit/`), и директорийный паттерн не матчит одиночный файл, названный
// по той же конвенции: `.codex-temp-probe.js` не был покрыт ни одним игнором,
// его подобрал обычный `git add`, и он уехал на origin/main sweep'ом чужого
// коммита. Красный `eslint . --max-warnings=0` получила каждая сессия,
// синхнувшая main, а `githook/pre-commit` (тот же `check:fast`) перестал
// пропускать коммиты вообще у всех.
//
// Расширение префиксных паттернов до `.codex-temp*` чинит имя. Этот guard
// закрывает класс: любой НОВЫЙ файл в корне, названный как одноразовый
// артефакт, обязан быть либо в allow-list осознанно, либо не в git. Третий
// эпизод придёт под другим именем, и точечный паттерн его не поймает.
//
// Область чтения привязана к тому, что реально ломается: `git ls-files`, то
// есть индекс. Untracked scratch-файл — забота игнора, а не этого guard'а, и
// рекурсивный обход дерева здесь был бы вреден (`.claude/worktrees/` содержит
// чужие checkout'ы параллельных сессий).

const OUTPUT_CONTRACT_VERSION = 1

const GIT_PATH_ARGS = ['-c', 'core.quotePath=false']

// Легитимные top-level dotfile-ы. Новый файл в этом списке — осознанное
// решение владельца конфигурации, а не побочный эффект `git add`.
const ALLOWED_ROOT_DOTFILES = new Set([
  '.gitattributes',
  '.gitignore',
  '.mcp.json',
  '.node-version',
  '.npmrc',
  '.nvmrc',
])

// Одноразовые артефакты корня, названные НЕ через точку. `eslint.config.js`
// уже объявляет `__*.mjs` и `_tmp-*` разовыми диагностическими скриптами, но
// eslint их лишь не читает — в git они попадали свободно, и такой артефакт на
// origin/main не краснел бы вовсе (в отличие от #1846). Класс закрывается тем
// же индексом.
// Расширение перечисляется, потому что `_tmp-` ловит любое, а `__` — только
// исполняемый скрипт: корневой `__probe.js` воспроизводил бы #1846 целиком.
const ROOT_SCRATCH_FILE_PATTERNS = [/^__.+\.[cm]?[jt]sx?$/, /^_tmp-/, /\.tmp\.[^.]+$/]

const REMEDIATION =
  'Временные скрипты и логи держи внутри .codex-temp/, .codex-debug/, test-results/ или playwright-report/ (AGENTS.md §3). Если это настоящий конфиг проекта — переименуй его вне scratch-конвенций и добавь dotfile в ALLOWED_ROOT_DOTFILES в scripts/guard-root-scratch-artifacts.js.'

const normalizePath = (value) => String(value || '').replace(/\\/g, '/')

const parseArgs = (argv) => ({
  output: argv.includes('--json') ? 'json' : 'text',
})

const isRootFile = (relativePath) => {
  const file = normalizePath(relativePath)
  return file.length > 0 && !file.includes('/')
}

const isRootDotfile = (relativePath) => isRootFile(relativePath) && normalizePath(relativePath).startsWith('.')

// Единственная конвенция, где новые root-dotfile появляются штатно: примеры env
// без значений. Что считается таким примером, решает `guard-env-secrets.js` —
// иначе два guard'а разойдутся в трактовке одного и того же имени.
const isAllowedRootDotfile = (name) => ALLOWED_ROOT_DOTFILES.has(name) || isAllowedEnvPlaceholder(name)

const isScratchArtifact = (relativePath) => {
  const file = normalizePath(relativePath)
  if (!isRootFile(file)) return false
  if (isRootDotfile(file)) return !isAllowedRootDotfile(file)
  return ROOT_SCRATCH_FILE_PATTERNS.some((pattern) => pattern.test(file))
}

const findViolations = (trackedFiles = []) => {
  const violations = []
  for (const trackedFile of trackedFiles) {
    const file = normalizePath(trackedFile)
    if (!isScratchArtifact(file)) continue
    violations.push({ file })
  }
  return violations
}

const evaluateGuard = ({ trackedFiles = [] } = {}) => {
  const violations = findViolations(trackedFiles)

  if (violations.length === 0) {
    return {
      ok: true,
      reason: 'В git нет одноразовых артефактов в корне репозитория',
      violations: [],
    }
  }

  return {
    ok: false,
    reason: `Одноразовый артефакт в корне репозитория отслеживается git. ${REMEDIATION}`,
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
const listTrackedFiles = (rootDir = resolveRepoRoot()) => {
  const stdout = execFileSync(
    'git',
    [...GIT_PATH_ARGS, '-C', rootDir, 'ls-files', '-z', '--full-name'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  return stdout.split('\0').filter(Boolean)
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

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const result = evaluateGuard({ trackedFiles: listTrackedFiles() })

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
  result.violations.forEach((v) => console.error(`- ${v.file}`))
  process.exit(1)
}

if (require.main === module) {
  main()
}

module.exports = {
  OUTPUT_CONTRACT_VERSION,
  ALLOWED_ROOT_DOTFILES,
  ROOT_SCRATCH_FILE_PATTERNS,
  REMEDIATION,
  GIT_PATH_ARGS,
  parseArgs,
  isRootFile,
  isRootDotfile,
  isAllowedRootDotfile,
  isScratchArtifact,
  findViolations,
  evaluateGuard,
  resolveRepoRoot,
  listTrackedFiles,
  buildJsonResult,
}
