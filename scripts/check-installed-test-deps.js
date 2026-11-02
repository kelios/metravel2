const fs = require('fs')
const path = require('path')

// #2915: harness-worktree может нести node_modules старше yarn.lock — тогда
// jest гоняется на других версиях тестового стека, красит чужие тесты и
// подталкивает к «фиксам», которые ломают main. Сверяем ключевые пакеты
// тестового стека с lockfile до запуска проверок.
const TEST_STACK_PACKAGES = Object.freeze([
  '@testing-library/react-native',
  'test-renderer',
  'react-dom',
  'jest',
])

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'))

const getDeclaredSpecifier = (packageJson, name) => {
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    const spec = packageJson?.[field]?.[name]
    if (typeof spec === 'string' && spec) return spec
  }
  return null
}

// yarn lockfile v1: заголовок записи — список дескрипторов через запятую,
// каждый в кавычках или без: `"jest@~30.5.2":`, `test-renderer@1.3.1, test-renderer@^1.3.0:`.
const resolveLockedVersion = (lockfileText, name, specifier) => {
  const wanted = `${name}@${specifier}`
  const lines = lockfileText.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line || /^\s/.test(line) || line.startsWith('#') || !line.endsWith(':')) continue
    const descriptors = line
      .slice(0, -1)
      .split(',')
      .map((part) => part.trim().replace(/^"|"$/g, ''))
    if (!descriptors.includes(wanted)) continue
    for (let next = index + 1; next < lines.length && /^\s/.test(lines[next]); next += 1) {
      const match = lines[next].match(/^\s+version\s+"([^"]+)"/)
      if (match) return match[1]
    }
    return null
  }
  return null
}

const readInstalledVersion = (rootDir, name) => {
  const manifestPath = path.join(rootDir, 'node_modules', name, 'package.json')
  if (!fs.existsSync(manifestPath)) return null
  return readJson(manifestPath).version || null
}

const findTestStackDrift = ({ rootDir = process.cwd(), packages = TEST_STACK_PACKAGES } = {}) => {
  const packageJsonPath = path.join(rootDir, 'package.json')
  const lockfilePath = path.join(rootDir, 'yarn.lock')
  if (!fs.existsSync(packageJsonPath) || !fs.existsSync(lockfilePath)) return []

  const packageJson = readJson(packageJsonPath)
  const lockfileText = fs.readFileSync(lockfilePath, 'utf8')
  const drift = []
  for (const name of packages) {
    const specifier = getDeclaredSpecifier(packageJson, name)
    if (!specifier) continue
    const locked = resolveLockedVersion(lockfileText, name, specifier)
    if (!locked) continue
    const installed = readInstalledVersion(rootDir, name)
    if (installed !== locked) drift.push({ name, locked, installed })
  }
  return drift
}

const formatDriftMessage = (drift) => [
  'node_modules отстаёт от yarn.lock: проверки запущены не на тех версиях тестового стека.',
  ...drift.map(({ name, locked, installed }) => `  ${name}: yarn.lock ${locked}, установлено ${installed ?? 'нет'}`),
  'Выполните `yarn install --frozen-lockfile` в этом чекауте и повторите (docs/WORKFLOW_OPERATIONS.md, раздел про harness-worktree).',
].join('\n')

module.exports = {
  TEST_STACK_PACKAGES,
  findTestStackDrift,
  formatDriftMessage,
  resolveLockedVersion,
}
