'use strict'

const fs = require('fs')
const path = require('path')

// Guard #1391: SEO ops scripts have no permissive default.
//
// Four incidents in one family (`SEO-OPS-001`: #1107, #1325, #1389, #1390) broke
// one invariant — a script fed an undefined or unsupported input did something
// wide, or reported success, instead of failing where you can see it. Every
// point fix cured one script and left the pattern free to reappear in the next,
// so the contract is now enforced instead of remembered:
//
//   1. the CLI parses through `scripts/lib/seo-cli-contract.js`, where an
//      unknown or mistyped argument is a UsageError and a declared mode is
//      mandatory;
//   2. it runs through `runSeoCli`, so bad input exits 2 and a failed run exits 1;
//   3. it holds no hand-rolled flag lookup — `argv.includes('--all')`,
//      `args.indexOf('--limit')`, `arg === '--json'` — each of which answers a
//      typo with the default instead of an error (#1389 submitted 544 URLs that way);
//   4. it never calls `process.exit(0)`: "nothing to do" is a named non-zero
//      failure, not a green report over an empty selection (#1325).
//
// The covered set is derived from the filesystem, not an allowlist: a new
// `scripts/seo-*.js` or `scripts/indexnow-*.js` joins it automatically and fails
// until it adopts the contract. There is deliberately no "skip if unclear" path —
// a guard with a permissive default would be the very bug it guards against.

const OUTPUT_CONTRACT_VERSION = 1

const SCRIPTS_DIR = 'scripts'
const CONTRACT_MODULE = 'scripts/lib/seo-cli-contract.js'
const COVERED_FILE_PATTERN = /^(seo-.+|indexnow-.+|index-status)\.js$/

const REQUIRED_NEEDLES = [
  {
    rule: 'contract-module',
    needle: "require('./lib/seo-cli-contract')",
    reason: `does not require ${CONTRACT_MODULE} — its arguments are parsed somewhere without the contract`,
  },
  {
    rule: 'strict-parse',
    needle: 'parseCliArgs(',
    reason: 'never calls parseCliArgs() — an unknown or mistyped flag would fall through to a default',
  },
  {
    rule: 'exit-contract',
    needle: 'runSeoCli(',
    reason: 'never calls runSeoCli() — bad input would not reach the non-zero exit contract',
  },
]

const FORBIDDEN_PATTERNS = [
  {
    rule: 'hand-rolled-parse',
    pattern: /process\.argv\.slice\(/,
    reason: 'reads process.argv directly — pass process.argv to parseCliArgs() instead',
  },
  {
    rule: 'hand-rolled-parse',
    pattern: /\.(includes|indexOf)\(\s*['"`]--[a-z$]/,
    reason: 'looks a flag up with includes()/indexOf() — a mistyped flag silently keeps the default (#1389)',
  },
  {
    rule: 'hand-rolled-parse',
    pattern: /===\s*['"]--[a-z]/,
    reason: 'compares an argument against a flag literal — declare the flag in the CLI spec instead',
  },
  {
    // Every way of spelling a zero exit: `exit(0)`, the argument-less `exit()`
    // and `exit(failed ? 1 : 0)`, whose zero branch is the same green report.
    // A successful run simply returns; only failures name an exit code.
    rule: 'exit-zero-on-empty',
    pattern: /process\.exit\((?:\s*\)|[^)]*\b0\b[^)]*\))/,
    reason: 'exits 0 explicitly — an empty selection must fail through requireNonEmptySelection(), not report success (#1325)',
  },
]

const normalizePath = (value) => String(value || '').replace(/\\/g, '/')

const parseArgs = (argv) => ({ output: argv.includes('--json') ? 'json' : 'text' })

const isCoveredFile = (relativePath) => {
  const normalized = normalizePath(relativePath)
  const dir = path.posix.dirname(normalized)
  if (dir !== SCRIPTS_DIR) return false
  return COVERED_FILE_PATTERN.test(path.posix.basename(normalized))
}

// Prose about the ban — including the comments in this guard's own remediation —
// is not a violation.
const isCommentLine = (line) => {
  const trimmed = String(line || '').trim()
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')
}

const collectCoveredFiles = (rootDir) => {
  const scriptsDir = path.join(rootDir, SCRIPTS_DIR)
  if (!fs.existsSync(scriptsDir)) return []
  return fs
    .readdirSync(scriptsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && COVERED_FILE_PATTERN.test(entry.name))
    .map((entry) => `${SCRIPTS_DIR}/${entry.name}`)
    .sort()
}

const findViolationsInSource = ({ filePath, content }) => {
  const normalizedPath = normalizePath(filePath)
  if (!isCoveredFile(normalizedPath)) return []

  const lines = String(content || '').split('\n')
  const codeLines = lines
    .map((line, index) => ({ line, number: index + 1 }))
    .filter((entry) => !isCommentLine(entry.line))
  const code = codeLines.map((entry) => entry.line).join('\n')

  const violations = []

  for (const { rule, needle, reason } of REQUIRED_NEEDLES) {
    if (!code.includes(needle)) {
      violations.push({ file: normalizedPath, line: 1, rule, reason })
    }
  }

  for (const { rule, pattern, reason } of FORBIDDEN_PATTERNS) {
    const hit = codeLines.find((entry) => pattern.test(entry.line))
    if (hit) {
      violations.push({
        file: normalizedPath,
        line: hit.number,
        rule,
        reason,
        snippet: hit.line.trim().slice(0, 120),
      })
    }
  }

  return violations
}

const evaluateGuard = ({ sources = [] } = {}) => {
  const covered = sources.filter((source) => isCoveredFile(source.filePath))
  const violations = []
  for (const source of covered) violations.push(...findViolationsInSource(source))

  if (violations.length === 0) {
    return {
      ok: true,
      reason: `All ${covered.length} SEO CLI script(s) parse through ${CONTRACT_MODULE} and fail loudly on unsupported input`,
      checkedFiles: covered.length,
      violations: [],
    }
  }

  return {
    ok: false,
    reason: `SEO CLI contract broken — see ${CONTRACT_MODULE}`,
    checkedFiles: covered.length,
    violations,
  }
}

const buildJsonResult = (result) => {
  const violations = Array.isArray(result?.violations) ? result.violations : []
  return {
    contractVersion: OUTPUT_CONTRACT_VERSION,
    ok: Boolean(result?.ok),
    reason: String(result?.reason || ''),
    checkedFiles: Number(result?.checkedFiles || 0),
    violations,
    violationCount: violations.length,
  }
}

const formatViolations = (violations) =>
  violations.map((v) => `- ${v.file}:${v.line} [${v.rule}] ${v.reason}${v.snippet ? `\n    ${v.snippet}` : ''}`)

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const rootDir = process.cwd()
  const sources = collectCoveredFiles(rootDir).map((relativePath) => ({
    filePath: relativePath,
    content: fs.readFileSync(path.join(rootDir, relativePath), 'utf8'),
  }))

  const result = evaluateGuard({ sources })

  if (args.output === 'json') {
    process.stdout.write(`${JSON.stringify(buildJsonResult(result), null, 2)}\n`)
    if (!result.ok) process.exit(1)
    return
  }

  if (result.ok) {
    console.log(`seo-cli-contract: passed. ${result.reason}`)
    return
  }

  console.error('seo-cli-contract: failed.')
  console.error(`- ${result.reason}`)
  formatViolations(result.violations).forEach((line) => console.error(line))
  process.exit(1)
}

if (require.main === module) {
  main()
}

module.exports = {
  COVERED_FILE_PATTERN,
  FORBIDDEN_PATTERNS,
  OUTPUT_CONTRACT_VERSION,
  REQUIRED_NEEDLES,
  buildJsonResult,
  collectCoveredFiles,
  evaluateGuard,
  findViolationsInSource,
  isCoveredFile,
  isCommentLine,
  parseArgs,
}
