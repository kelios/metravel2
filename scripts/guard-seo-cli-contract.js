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
//      failure, not a green report over an empty selection (#1325);
//   5. it says in its CLI spec whether it selects anything, and when it does, it
//      calls `requireNonEmptySelection()` (#1398). Rule 4 alone only catches the
//      loud spelling of the green report; a script that simply returns from
//      `main()` over an empty list names no exit code at all and still leaves
//      the process at 0. What this rule proves is that the call is there — which
//      list reaches it would take an AST, deliberately out of scope; what it
//      removes is the shape where nothing checks the selection at all.
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

// Whether a script has a selection is declared, not inferred: `selection: 'URLs'`
// for a run over a list, `selection: 'none'` for one that works on a single named
// target (`seo-edit --id 641`, `seo-apply-one --id 641`), where an empty selection
// cannot happen. `normalizeSpec` ignores the field — its only reader is this
// guard, which needs it to know when `requireNonEmptySelection()` is mandatory.
//
// The alternative was to derive the answer from the source: "the file iterates a
// fetch result, so it has a selection". That is a heuristic, and a heuristic that
// cannot decide has to fall through to "probably fine" — the permissive default
// this entire family exists to remove. A declaration can be wrong, but it is
// wrong in writing, in review, next to the flags it describes.
const NO_SELECTION = 'none'
// `--all`, `--ids`, `--limit`, `--map-file`, `--urls-file` all mean "many
// targets" — matched where flags are declared (`all: { type:`), not anywhere the
// word appears.
const LIST_FLAG_DECLARATION = /(?:^|[\s{,])'?(all|ids|limit|map-file|urls-file)'?:\s*\{\s*type:/

// Read only the CLI_SPEC object. A `selection: 'none'` in another object (or in
// prose) is not the declaration this contract asks for and must not let a
// script with an undeclared selection pass.
const findCliSpecObject = (code) => {
  const text = String(code || '')
  const assignment = /(?:^|[\n;])\s*(?:const|let|var)\s+CLI_SPEC\s*=\s*\{/.exec(text)
  if (!assignment) return ''

  const start = assignment.index + assignment[0].lastIndexOf('{')
  let quote = null
  let depth = 0
  for (let i = start; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      if (char === '\\') i++
      else if (char === quote) quote = null
      continue
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char
      continue
    }
    if (char === '{') depth++
    else if (char === '}' && --depth === 0) return text.slice(start, i + 1)
  }

  return ''
}

const readDeclaredSelections = (code) => {
  const cliSpec = findCliSpecObject(stripComments(code))
  const values = []
  let quote = null
  let depth = 0

  for (let i = 0; i < cliSpec.length; i++) {
    const char = cliSpec[i]
    if (quote) {
      if (char === '\\') i++
      else if (char === quote) quote = null
      continue
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char
      continue
    }
    if (char === '{') {
      depth++
      continue
    }
    if (char === '}') {
      depth--
      continue
    }
    if (depth !== 1 || !cliSpec.startsWith('selection', i)) continue
    if (/[A-Za-z0-9_$]/.test(cliSpec[i - 1] || '') || /[A-Za-z0-9_$]/.test(cliSpec[i + 9] || '')) {
      continue
    }

    let cursor = i + 9
    while (/\s/.test(cliSpec[cursor] || '')) cursor++
    if (cliSpec[cursor] !== ':') continue
    cursor++
    while (/\s/.test(cliSpec[cursor] || '')) cursor++
    const delimiter = cliSpec[cursor]
    if (delimiter !== "'" && delimiter !== '"' && delimiter !== '`') continue

    let value = ''
    for (cursor++; cursor < cliSpec.length; cursor++) {
      if (cliSpec[cursor] === '\\' && cliSpec[cursor + 1] !== undefined) {
        value += cliSpec[++cursor]
      } else if (cliSpec[cursor] === delimiter) {
        break
      } else {
        value += cliSpec[cursor]
      }
    }
    if (value.trim()) values.push(value.trim())
    i = cursor
  }

  return values
}

const declaresSelection = (code) => readDeclaredSelections(code).some((value) => value !== NO_SELECTION)

const declaresNoSelection = (code) => {
  const values = readDeclaredSelections(code)
  return values.length > 0 && values.every((value) => value === NO_SELECTION)
}

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
  {
    rule: 'selection-declared',
    satisfiedWhen: (code) => readDeclaredSelections(code).length > 0,
    reason:
      "does not declare a selection in its CLI spec — add selection: '<what the run works on>', " +
      `or selection: '${NO_SELECTION}' when it works on one named target, so the guard knows ` +
      'whether an empty selection is possible instead of assuming it is not',
  },
  {
    rule: 'empty-selection-guard',
    satisfiedWhen: (code) => hasCallExpression(code, 'requireNonEmptySelection'),
    appliesWhen: declaresSelection,
    reason:
      'declares a selection but never calls requireNonEmptySelection() — over an empty list it would ' +
      'return from main() without naming an exit code, and the run would still report success (#1325)',
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
  {
    // A declaration nobody revisits rots: seo-edit is honest about its single
    // --id today and would stay `none` on the day someone adds --all. This is a
    // heuristic, but it only ever adds a violation — the unclear case fails
    // loudly, which is the opposite of the permissive default it guards (#1398).
    rule: 'selection-none-with-list-flag',
    appliesWhen: declaresNoSelection,
    pattern: LIST_FLAG_DECLARATION,
    reason: `declares selection: '${NO_SELECTION}' but takes a flag that names many targets — a run over a list does select something, and that selection has to go through requireNonEmptySelection()`,
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

// Prose is not code, whether it occupies a whole line, trails a statement, or
// sits in an inline block comment. Comments are replaced rather than deleted so
// violation line numbers still point at the original source. A `//` inside a
// string stays put, or every URL in these scripts would lose its host.
const stripComments = (source) => {
  const text = String(source || '')
  let output = ''
  let quote = null
  let regex = false
  let regexCharacterClass = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      output += char
      if (char === '\\' && text[i + 1] !== undefined) output += text[++i]
      else if (char === quote) quote = null
      else if (char === '\n' && quote !== '`') quote = null
      continue
    }
    if (regex) {
      output += char
      if (char === '\\' && text[i + 1] !== undefined) output += text[++i]
      else if (char === '[') regexCharacterClass = true
      else if (char === ']') regexCharacterClass = false
      else if (char === '/' && !regexCharacterClass) regex = false
      else if (char === '\n') regex = false
      continue
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char
      output += char
      continue
    }
    if (char === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') {
        output += ' '
        i++
      }
      if (text[i] === '\n') output += '\n'
      continue
    }
    if (char === '/' && text[i + 1] === '*') {
      output += '  '
      i += 2
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        output += text[i] === '\n' ? '\n' : ' '
        i++
      }
      if (i < text.length) {
        output += ' '
        i++
      }
      continue
    }
    if (char === '/') {
      const beforeSlash = output.trimEnd()
      const previous = beforeSlash.at(-1) || ''
      const startsRegex =
        !previous ||
        '=(:,!&|?{[;'.includes(previous) ||
        beforeSlash.endsWith('=>') ||
        /\b(?:case|return|throw|typeof|void|yield)$/.test(beforeSlash)
      if (startsRegex) {
        regex = true
        regexCharacterClass = false
      }
    }
    output += char
  }
  return output
}

const hasCallExpression = (code, name) => {
  const callPattern = new RegExp(`\\b${name}\\s*\\(`, 'g')
  return String(code || '')
    .split('\n')
    .some((line) => {
      for (const match of line.matchAll(callPattern)) {
        const prefix = line.slice(0, match.index)
        const preceding = prefix.at(-1) || ''
        // Calls in this family are direct helper calls. Quotes before the match
        // mean it is string prose; a slash means a regex literal. Resetting this
        // small check per line avoids mistaking quotes inside an earlier regex
        // (for example /['"]/) for a multiline JavaScript string.
        if (!/['"`]/.test(prefix) && !/[A-Za-z0-9_$./\\]/.test(preceding)) return true
      }
      return false
    })
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
  const strippedLines = stripComments(content).split('\n')
  // `line` is what the rules read — comments removed; `raw` is what the operator
  // sees in the report, so the snippet still shows the line as written.
  const codeLines = lines.map((raw, index) => ({
    raw,
    line: strippedLines[index] || '',
    number: index + 1,
  }))
  const code = codeLines.map((entry) => entry.line).join('\n')

  const violations = []

  for (const { rule, needle, pattern, satisfiedWhen, appliesWhen, reason } of REQUIRED_NEEDLES) {
    // A rule that applies only to some scripts still has no "unclear, so skip"
    // branch: `appliesWhen` reads a declaration the script had to make, and a
    // missing declaration is its own violation above.
    if (appliesWhen && !appliesWhen(code)) continue
    const satisfied = satisfiedWhen
      ? satisfiedWhen(code)
      : needle
        ? code.includes(needle)
        : pattern.test(code)
    if (!satisfied) {
      violations.push({ file: normalizedPath, line: 1, rule, reason })
    }
  }

  for (const { rule, pattern, appliesWhen, reason } of FORBIDDEN_PATTERNS) {
    if (appliesWhen && !appliesWhen(code)) continue
    const hit = codeLines.find((entry) => pattern.test(entry.line))
    if (hit) {
      violations.push({
        file: normalizedPath,
        line: hit.number,
        rule,
        reason,
        snippet: hit.raw.trim().slice(0, 120),
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
  LIST_FLAG_DECLARATION,
  NO_SELECTION,
  OUTPUT_CONTRACT_VERSION,
  REQUIRED_NEEDLES,
  USAGE,
  buildJsonResult,
  collectCoveredFiles,
  declaresNoSelection,
  declaresSelection,
  evaluateGuard,
  findViolationsInSource,
  isCoveredFile,
  readDeclaredSelections,
}
