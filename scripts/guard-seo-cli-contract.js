'use strict'

const fs = require('fs')
const path = require('path')

const { parseCliArgs, runSeoCli } = require('./lib/seo-cli-contract')

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
// By name for the family's naming convention, plus the two prod gates that
// predate it — `test-seo-prod.js` is #1107, the first incident of SEO-OPS-001,
// and `post-deploy-seo-check.js` is its post-deploy twin.
const COVERED_FILE_PATTERN =
  /^(seo-.+|indexnow-.+|index-status|test-seo-prod|post-deploy-seo-check)\.js$/
// `scripts/lib/` is the library home, not a CLI surface — the shared contract
// itself lives there and obviously cannot require itself. Matched as an exact
// path prefix, not by folder name: a `scripts/ops/lib/seo-foo.js` is still a CLI
// and must stay covered. Everything else under `scripts/`, at any depth, is
// covered — moving a CLI into a subfolder must not be a way out.
const EXCLUDED_PATH_PREFIXES = [`${SCRIPTS_DIR}/lib/`, `${SCRIPTS_DIR}/node_modules/`]

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
    // `.slice(2)` on anything, not just `process.argv`: assigning argv to a local
    // first is the obvious way around a `process.argv.slice(` needle.
    rule: 'hand-rolled-parse',
    pattern: /\.slice\(\s*2\s*[,)]/,
    reason: 'slices the argument vector by hand — pass process.argv to parseCliArgs() instead',
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
    // A `switch` over the argument vector has the same hole as the if-chain: its
    // `default` branch keeps going instead of refusing the unknown flag.
    rule: 'hand-rolled-parse',
    pattern: /case\s+['"]-{1,2}[a-z]/,
    reason: 'switches on a flag literal — its default branch swallows an unknown flag',
  },
  {
    rule: 'exit-zero-on-empty',
    pattern: /process\.exitCode\s*=\s*0\b/,
    reason: 'sets a zero exit code explicitly — success is the absence of a failure, not an assignment',
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

const USAGE = `SEO CLI contract guard — SEO-OPS-001

Usage:
  node scripts/guard-seo-cli-contract.js [--json]

Options:
  --json                machine-readable result on stdout
  --help, -h            print this help and exit`

// The guard parses its own arguments through the contract it enforces: a
// mistyped \`--jsonn\` printing human text to a caller that expects JSON is the
// very shape this guard exists to stop.
const CLI_SPEC = {
  name: 'guard-seo-cli-contract',
  usage: USAGE,
  flags: { json: { type: 'boolean' } },
}

const isExcludedPath = (normalizedPath) =>
  EXCLUDED_PATH_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))

const isCoveredFile = (relativePath) => {
  const normalized = normalizePath(relativePath)
  if (!normalized.startsWith(`${SCRIPTS_DIR}/`)) return false
  if (isExcludedPath(normalized)) return false
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

  const found = []
  const walk = (absoluteDir, relativeDir) => {
    for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
      const relative = `${relativeDir}/${entry.name}`
      if (entry.isDirectory()) {
        if (!isExcludedPath(`${relative}/`)) walk(path.join(absoluteDir, entry.name), relative)
        continue
      }
      if (entry.isFile() && isCoveredFile(relative)) found.push(relative)
    }
  }

  walk(scriptsDir, SCRIPTS_DIR)
  return found.sort()
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

  // A guard that scanned nothing and said "passed" would be the very report this
  // whole family is about (#1325). Zero covered files means the scan looked in
  // the wrong place, not that the repository is clean.
  if (covered.length === 0) {
    return {
      ok: false,
      reason: `No SEO CLI script matched under ${SCRIPTS_DIR}/ — the guard scanned nothing, which is a broken scan, not a clean repository`,
      checkedFiles: 0,
      violations: [
        {
          file: `${SCRIPTS_DIR}/`,
          line: 1,
          rule: 'empty-scan',
          reason: 'covered set is empty — run the guard from the repository root',
        },
      ],
    }
  }

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
  const args = parseCliArgs(process.argv, CLI_SPEC)
  const rootDir = process.cwd()
  const sources = collectCoveredFiles(rootDir).map((relativePath) => ({
    filePath: relativePath,
    content: fs.readFileSync(path.join(rootDir, relativePath), 'utf8'),
  }))

  const result = evaluateGuard({ sources })

  if (args.json) {
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
  runSeoCli(main, { name: 'guard-seo-cli-contract', usage: USAGE })
}

module.exports = {
  CLI_SPEC,
  COVERED_FILE_PATTERN,
  EXCLUDED_PATH_PREFIXES,
  FORBIDDEN_PATTERNS,
  OUTPUT_CONTRACT_VERSION,
  REQUIRED_NEEDLES,
  USAGE,
  buildJsonResult,
  collectCoveredFiles,
  evaluateGuard,
  findViolationsInSource,
  isCoveredFile,
  isCommentLine,
}
