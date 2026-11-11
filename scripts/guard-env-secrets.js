#!/usr/bin/env node

const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const ALLOWED_ENV_PLACEHOLDER = /(^|\/)\.env(?:\.[^/]+)?\.example$/
const CONFIG_FILE_PATTERN = /(?:^|\/)(?:\.env[^/]*|[^/]+\.(?:json|ya?ml|toml|ini|conf|properties))$/i
const SENSITIVE_KEY_PATTERN = /(?:^|_)(?:API_?SECRET|CLIENT_?SECRET|SECRET|TOKEN|PASSWORD|PRIVATE_?KEY|API_?KEY)$/i
const SAFE_VALUE_PATTERNS = [
  /^$/,
  /^<[^>]+>$/,
  /^(?:your|example|placeholder|replace[_-]?me|test)[_-]/i,
  /^\*+$/,
  /^\$\{.+\}$/,
  /^\$\{\{\s*secrets\..+\}\}$/,
]

// ── Ключ, вписанный литералом в отслеживаемый файл (#3211) ──────────────────
// Правила выше смотрят на ИМЯ: путь `.env*` и присваивание `SECRET_KEY=…` в
// конфиге. `const TOKEN = '<40 hex>'` в `scripts/*.js` под них не попадал и
// пролежал в публичном репозитории с февраля по ноябрь 2026. Здесь проверяется
// ФОРМАТ значения, в любом текстовом файле; само значение в отчёт не попадает
// никогда — только файл, строка и причина.
const BINARY_FILE_PATTERN =
  /\.(?:png|jpe?g|webp|gif|ico|icns|heic|avif|pdf|ttf|otf|woff2?|mp[34]|mov|webm|zip|gz|tgz|jar|keystore|jks|p8|p12|aab|apk|ipa|bin|wasm)$/i
// 40 шестнадцатеричных знаков — формат ключа DRF, но и git-объекта. В прозе и
// разметке интерфейса это ссылки на коммиты и идентификаторы связей, поэтому
// голый литерал там не проверяется; заголовок `Token <ключ>` — проверяется везде.
const HEX_LITERAL_EXEMPT_PATTERN = /\.(?:mdx?|storyboard|xib)$/i
const HEX_KEY_LITERAL = /(['"`])[0-9a-fA-F]{40}\1/g
// Литерал, привязанный к имени git-объекта или контрольной суммы, ключом не
// считается: `const SHA = '…'`, `commit: '…'`, `baseSha`. Сравниваются целые
// слова имени, поэтому `shareToken` исключением не становится.
const NON_KEY_NAME_WORDS = new Set([
  'sha', 'sha1', 'commit', 'revision', 'rev', 'blob', 'tree', 'oid', 'hash', 'digest', 'checksum', 'fingerprint',
])
const KEY_FORMATS = [
  { reason: 'authorization header with a literal 40-hex key', pattern: /\b(?:Token|Bearer)\s+[0-9a-fA-F]{40}(?![0-9A-Za-z_])/ },
  { reason: 'GitHub token literal', pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})/ },
  { reason: 'Slack token literal', pattern: /\bxox[abprs]-[A-Za-z0-9-]{20,}/ },
  { reason: 'Stripe live key literal', pattern: /\b[sr]k_live_[A-Za-z0-9]{20,}/ },
  { reason: 'Telegram bot token literal', pattern: /(?<![0-9A-Za-z_])\d{8,10}:AA[A-Za-z0-9_-]{33}(?![0-9A-Za-z_-])/ },
  // #3305: идентификатор ключа доступа AWS (`AKIA…` — постоянный, `ASIA…` —
  // временный). Сам по себе не секрет, но в presigned-ссылке, скопированной в
  // тест, называет настоящий ключ аккаунта. Примеры из документации AWS
  // оканчиваются на `EXAMPLE` (`AKIAIOSFODNN7EXAMPLE`) и пропускаются — ими и
  // пишутся фикстуры.
  { reason: 'AWS access key id literal', pattern: /(?<![A-Z0-9])(?:AKIA|ASIA)(?![A-Z0-9]{9}EXAMPLE(?![A-Z0-9]))[A-Z0-9]{16}(?![A-Z0-9])/ },
  // С телом ключа: одна строка-заголовок встречается в детекторах и шаблонах.
  { reason: 'private key block', pattern: /-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----(?:\\r|\\n|\s)*[A-Za-z0-9+/]{32,}/ },
]
// Дешёвый отсев: построчный разбор нужен единицам файлов из тысяч.
const KEY_FORMAT_HINT = /[0-9a-fA-F]{40}|gh[pousr]_|github_pat_|xox[abprs]-|[sr]k_live_|:AA[A-Za-z0-9_-]{33}|PRIVATE KEY-----|A[KS]IA[A-Z0-9]{16}/

const normalizePath = (filePath) => filePath.split(path.sep).join('/')

const nameWords = (text) =>
  String(text).replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/)

const findKeyLiterals = (content, { hexLiterals = true } = {}) => {
  const text = String(content ?? '')
  if (!KEY_FORMAT_HINT.test(text)) return []
  const found = []
  const lines = text.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    for (const { reason, pattern } of KEY_FORMATS) {
      if (pattern.test(line)) found.push({ line: index + 1, reason })
    }
    if (!hexLiterals) continue
    for (const match of line.matchAll(HEX_KEY_LITERAL)) {
      if (nameWords(line.slice(0, match.index)).some((word) => NON_KEY_NAME_WORDS.has(word))) continue
      found.push({ line: index + 1, reason: '40-hex key literal' })
    }
  }
  return found
}

const isAllowedEnvPlaceholder = (filePath) => ALLOWED_ENV_PLACEHOLDER.test(normalizePath(filePath))

const isForbiddenSecretPath = (filePath) => {
  const normalized = normalizePath(filePath)
  const basename = path.posix.basename(normalized)
  return normalized.startsWith('.secrets/') || (basename.startsWith('.env') && !isAllowedEnvPlaceholder(normalized))
}

const isSafeConfiguredValue = (value) => {
  const normalized = String(value ?? '')
    .trim()
    .replace(/^['"]|['"],?$/g, '')
    .trim()
  return SAFE_VALUE_PATTERNS.some((pattern) => pattern.test(normalized))
}

const findSensitiveAssignments = (content) => {
  const keys = new Set()
  for (const line of String(content ?? '').split(/\r?\n/)) {
    const match = line.match(/^\s*["']?([A-Z][A-Z0-9_]*)["']?\s*[:=]\s*(.*?)\s*,?\s*$/)
    if (!match || !SENSITIVE_KEY_PATTERN.test(match[1]) || isSafeConfiguredValue(match[2])) continue
    keys.add(match[1])
  }
  return [...keys]
}

// Индекс плюс неигнорируемый untracked-срез: ключ в новом файле должен краснеть
// до `git add`, а не после коммита (тот же приём, что у guard корня репозитория).
const readTrackedFiles = (root) => [
  ...new Set(
    execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
      .split('\0')
      .filter(Boolean),
  ),
]

const scanFiles = (root, filePaths) => {
  const violations = []
  for (const requestedPath of filePaths) {
    const absolutePath = path.resolve(root, requestedPath)
    const relativePath = normalizePath(path.relative(root, absolutePath))

    // A tracked deletion is a valid pre-commit cleanup state. Reintroduced
    // files exist again and are rejected below.
    if (!fs.existsSync(absolutePath)) continue

    if (isForbiddenSecretPath(relativePath)) {
      violations.push({ file: relativePath, reason: 'forbidden env/secret path' })
    }

    if (BINARY_FILE_PATTERN.test(relativePath)) continue
    const stat = fs.statSync(absolutePath)
    if (!stat.isFile() || stat.size > 1024 * 1024) continue
    const content = fs.readFileSync(absolutePath, 'utf8')

    for (const { line, reason } of findKeyLiterals(content, { hexLiterals: !HEX_LITERAL_EXEMPT_PATTERN.test(relativePath) })) {
      violations.push({ file: relativePath, line, reason })
    }

    if (!CONFIG_FILE_PATTERN.test(relativePath)) continue
    for (const key of findSensitiveAssignments(content)) {
      violations.push({ file: relativePath, key, reason: 'literal sensitive assignment' })
    }
  }
  return violations
}

const parseArgs = (argv) => {
  const scanFilesArgs = []
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--scan-file' && argv[index + 1]) {
      scanFilesArgs.push(argv[index + 1])
      index += 1
    }
  }
  return { scanFilesArgs }
}

const run = ({ root = process.cwd(), filePaths } = {}) => {
  const requestedFiles = filePaths ?? readTrackedFiles(root)
  const violations = scanFiles(root, requestedFiles)

  if (violations.length === 0) {
    process.stdout.write('Environment/secret guard passed.\n')
    return 0
  }

  process.stderr.write(`Environment/secret guard found ${violations.length} violation(s):\n`)
  for (const violation of violations) {
    const keySuffix = violation.key ? ` key=${violation.key}` : ''
    const lineSuffix = violation.line ? `:${violation.line}` : ''
    process.stderr.write(`- ${violation.file}${lineSuffix}${keySuffix}: ${violation.reason}\n`)
  }
  return 1
}

if (require.main === module) {
  const { scanFilesArgs } = parseArgs(process.argv.slice(2))
  process.exitCode = run({ filePaths: scanFilesArgs.length > 0 ? scanFilesArgs : undefined })
}

module.exports = {
  findKeyLiterals,
  findSensitiveAssignments,
  isAllowedEnvPlaceholder,
  isForbiddenSecretPath,
  run,
  scanFiles,
}
