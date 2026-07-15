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

const normalizePath = (filePath) => filePath.split(path.sep).join('/')

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

const readTrackedFiles = (root) =>
  execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)

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

    if (!CONFIG_FILE_PATTERN.test(relativePath)) continue
    const stat = fs.statSync(absolutePath)
    if (!stat.isFile() || stat.size > 1024 * 1024) continue

    for (const key of findSensitiveAssignments(fs.readFileSync(absolutePath, 'utf8'))) {
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
    process.stderr.write(`- ${violation.file}${keySuffix}: ${violation.reason}\n`)
  }
  return 1
}

if (require.main === module) {
  const { scanFilesArgs } = parseArgs(process.argv.slice(2))
  process.exitCode = run({ filePaths: scanFilesArgs.length > 0 ? scanFilesArgs : undefined })
}

module.exports = {
  findSensitiveAssignments,
  isAllowedEnvPlaceholder,
  isForbiddenSecretPath,
  run,
  scanFiles,
}
