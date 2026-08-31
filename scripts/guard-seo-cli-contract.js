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
//   6. every script that selects a batch calls `requireNoBatchFailures()` with
//      a computed failure count after its final report/artifact flush, so caught
//      item failures cannot leave a green exit (#1655). A hard-coded zero is not
//      evidence about the batch; focused script tests pin the live calls and
//      their placement after the useful output.
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

const SELECTION_KEY = 'selection'

// The declaration is top-level metadata on CLI_SPEC. Anchored to a line that
// starts in column 0, so a `const CLI_SPEC` shadowing the real one inside a
// function body cannot answer for the script; a second statement on that same
// top-level line still counts (`const RETRY = {…}; const CLI_SPEC = {…}`).
// Not finding it fails closed: `selection-declared` fires.
const CLI_SPEC_DECLARATION = /^(?![ \t])(?:[^\n]*;[ \t]*)?(?:const|let|var)[ \t]+CLI_SPEC[ \t]*=[ \t]*\{/gm

// Read only CLI_SPEC objects. A `selection: 'none'` in another object, in prose
// or inside a string is not the declaration this contract asks for and must not
// let a script with an undeclared selection pass. Every top-level CLI_SPEC is
// read, not just the first: with more than one in view, the rule stays on if any
// of them selects something.
const findCliSpecObjects = (code) => {
  const text = String(code || '')
  // Located over the masked reading, where a `{` inside a string or a comment is
  // no longer a brace, then sliced out of the source so the values stay readable.
  const masked = maskSource(text, { literals: true })
  const objects = []

  for (const match of masked.matchAll(CLI_SPEC_DECLARATION)) {
    const start = match.index + match[0].lastIndexOf('{')
    let depth = 0
    for (let i = start; i < masked.length; i++) {
      if (masked[i] === '{') depth++
      else if (masked[i] === '}' && --depth === 0) {
        objects.push({ source: text.slice(start, i + 1), masked: masked.slice(start, i + 1) })
        break
      }
    }
  }

  return objects
}

// Walked over the masked object, where only real syntax is left, and read out of
// the source at the same offsets — `maskSource` replaces character for character,
// so the two stay aligned.
const readSelectionValues = ({ source, masked }) => {
  const values = []
  let depth = 0

  for (let i = 0; i < masked.length; i++) {
    const char = masked[i]
    if (char === '{') {
      depth++
      continue
    }
    if (char === '}') {
      depth--
      continue
    }
    if (depth !== 1 || !masked.startsWith(SELECTION_KEY, i)) continue
    const after = i + SELECTION_KEY.length
    if (/[A-Za-z0-9_$]/.test(masked[i - 1] || '') || /[A-Za-z0-9_$]/.test(masked[after] || '')) {
      continue
    }

    let cursor = after
    while (/\s/.test(masked[cursor] || '')) cursor++
    if (masked[cursor] !== ':') continue
    cursor++
    while (/\s/.test(masked[cursor] || '')) cursor++
    const delimiter = masked[cursor]
    if (delimiter !== "'" && delimiter !== '"' && delimiter !== '`') continue

    let value = ''
    for (cursor++; cursor < source.length; cursor++) {
      if (source[cursor] === '\\' && source[cursor + 1] !== undefined) {
        value += source[++cursor]
      } else if (source[cursor] === delimiter) {
        break
      } else {
        value += source[cursor]
      }
    }
    if (value.trim()) values.push(value.trim())
    i = cursor
  }

  return values
}

const readDeclaredSelections = (code) =>
  findCliSpecObjects(code).flatMap((cliSpec) => readSelectionValues(cliSpec))

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
  {
    rule: 'batch-failure-guard',
    satisfiedWhen: (code) => hasBatchFailureGuardCall(code),
    appliesWhen: declaresSelection,
    reason:
      'declares a selection but never calls requireNoBatchFailures() with a computed failure count — ' +
      'a missing or hard-coded-zero check could leave caught item failures at exit code 0 (#1655)',
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

// A `/` in code position starts a regex only after something an expression can
// follow — an operator, an opening bracket, a keyword. After a value it is division.
const REGEX_PRECEDERS = '=(:,!&|?{[;'
const startsRegexLiteral = (emitted) => {
  const before = emitted.trimEnd()
  const previous = before.at(-1) || ''
  const tail = before.slice(-8)
  return (
    !previous ||
    REGEX_PRECEDERS.includes(previous) ||
    tail.endsWith('=>') ||
    /\b(?:case|return|throw|typeof|void|yield)$/.test(tail)
  )
}

// The one scanner the whole guard reads through. It blanks what is not
// executable code — comments always, and with `literals: true` the contents of
// string, template and regex literals too — writing one space per hidden
// character and keeping every newline, so offsets and line numbers still match
// the file on disk.
//
// Two readings come out of it, and both rules need their own. Rules that read
// values (`selection: 'rows'`, `require('./lib/seo-cli-contract')`,
// `argv.includes('--all')`) need the literals intact. Rules that look for a call
// need them blanked: `requireNonEmptySelection(` or `requireNoBatchFailures(`
// inside a USAGE template, a regex or any other string is prose about the call,
// not the call — and every
// covered script writes its USAGE as a multi-line template, so that shape is the
// natural one, not a contrived one.
//
// One scanner rather than three is the point. The bypasses closed here were all
// the same defect: three hand-rolled scanners disagreeing about where a literal
// ends, so a mention was code to one of them and prose to another.
//
// Template interpolations stay code — `${…}` is real JavaScript and can hold the
// very call a rule is looking for.
const maskSource = (source, { literals = false } = {}) => {
  const text = String(source || '')
  let out = ''
  let i = 0

  const keep = (count = 1) => {
    out += text.slice(i, i + count)
    i += count
  }
  const hide = (count = 1) => {
    for (let n = 0; n < count && i < text.length; n++, i++) out += text[i] === '\n' ? '\n' : ' '
  }
  // Inside a literal: hidden when the caller asked for the masked reading, kept
  // as written otherwise.
  const step = (count = 1) => (literals ? hide(count) : keep(count))

  // `depth` counts braces open in the current code context. A `}` at depth 0
  // closes the `${…}` that opened this context and hands the scan back to its
  // template.
  const contexts = [{ template: false, depth: 0 }]

  while (i < text.length) {
    const context = contexts[contexts.length - 1]
    const char = text[i]
    const next = text[i + 1]

    if (context.template) {
      if (char === '\\' && next !== undefined) step(2)
      else if (char === '`') {
        contexts.pop()
        keep()
      } else if (char === '$' && next === '{') {
        contexts.push({ template: false, depth: 0 })
        keep(2)
      } else step()
      continue
    }

    if (char === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') hide()
      continue
    }

    if (char === '/' && next === '*') {
      hide(2)
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) hide()
      hide(2)
      continue
    }

    if (char === "'" || char === '"') {
      keep()
      while (i < text.length && text[i] !== char && text[i] !== '\n') {
        if (text[i] === '\\' && text[i + 1] !== undefined) step(2)
        else step()
      }
      if (text[i] === char) keep()
      continue
    }

    if (char === '`') {
      contexts.push({ template: true, depth: 0 })
      keep()
      continue
    }

    if (char === '/' && startsRegexLiteral(out)) {
      keep()
      let characterClass = false
      while (i < text.length && text[i] !== '\n') {
        if (text[i] === '\\' && text[i + 1] !== undefined) {
          step(2)
          continue
        }
        if (text[i] === '[') characterClass = true
        else if (text[i] === ']') characterClass = false
        else if (text[i] === '/' && !characterClass) break
        step()
      }
      if (text[i] === '/') keep()
      continue
    }

    if (char === '{') {
      context.depth++
      keep()
      continue
    }
    if (char === '}') {
      if (context.depth === 0 && contexts.length > 1) contexts.pop()
      else context.depth--
      keep()
      continue
    }

    keep()
  }

  return out
}

// A member call (`contract.requireNonEmptySelection(…)`) is deliberately not
// counted: this family imports the helper by name, and the narrow reading fails
// closed. `/` and `\` are refused for the same reason — they only precede the
// name inside a regex the mask read as division, and a mention in a pattern is
// not a call.
const NOT_A_CALL_BEFORE = './\\'
const hasCallExpression = (code, name) => {
  const masked = maskSource(code, { literals: true })
  for (const match of masked.matchAll(new RegExp(`\\b${name}\\s*\\(`, 'g'))) {
    if (!NOT_A_CALL_BEFORE.includes(masked[match.index - 1] || ' ')) return true
  }
  return false
}

// Return the first argument of every real direct call. This is deliberately a
// small balanced-delimiter scan over the same masked source as
// `hasCallExpression`, not a second opinion about comments/strings/templates.
// It is enough to distinguish a batch-derived counter from the tempting no-op
// `requireNoBatchFailures(0, ...)` without introducing an AST dependency.
const findCallFirstArguments = (code, name) => {
  const masked = maskSource(code, { literals: true })
  const args = []

  for (const match of masked.matchAll(new RegExp(`\\b${name}\\s*\\(`, 'g'))) {
    if (NOT_A_CALL_BEFORE.includes(masked[match.index - 1] || ' ')) continue
    const open = masked.indexOf('(', match.index + name.length)
    let parentheses = 1
    let brackets = 0
    let braces = 0
    let end = -1

    for (let i = open + 1; i < masked.length; i++) {
      const char = masked[i]
      if (char === '(') parentheses++
      else if (char === ')') {
        parentheses--
        if (parentheses === 0) {
          end = i
          break
        }
      } else if (char === '[') brackets++
      else if (char === ']') brackets--
      else if (char === '{') braces++
      else if (char === '}') braces--
      else if (char === ',' && parentheses === 1 && brackets === 0 && braces === 0) {
        end = i
        break
      }
    }

    if (end !== -1) args.push(masked.slice(open + 1, end).trim())
  }

  return args
}

const unwrapParentheses = (value) => {
  let expression = String(value || '').trim()
  while (expression.startsWith('(') && expression.endsWith(')')) {
    expression = expression.slice(1, -1).trim()
  }
  return expression
}

const HARD_CODED_ZERO = /^[+-]?(?:0+(?:\.0*)?(?:e[+-]?\d+)?|\.0+(?:e[+-]?\d+)?|0x0+|0b0+|0o0+|0n)$/i
const hasBatchFailureGuardCall = (code) =>
  findCallFirstArguments(code, 'requireNoBatchFailures').some(
    (argument) => argument && !HARD_CODED_ZERO.test(unwrapParentheses(argument)),
  )

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
  const strippedLines = maskSource(content).split('\n')
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
  findCallFirstArguments,
  findViolationsInSource,
  hasBatchFailureGuardCall,
  hasCallExpression,
  isCoveredFile,
  maskSource,
  readDeclaredSelections,
}
