#!/usr/bin/env node

/**
 * PERF-017 regression guard: keep `react-native-gesture-handler` and
 * `react-native-reanimated` OUT of the web eager (entry + __common) bundle.
 *
 * Background (see docs/PERF_014_EAGER_BUNDLE_AUDIT.md): on web these two vendor
 * runtimes were pulled into the eager bundle ONLY by entry.js's native-guarded
 * `require('react-native-gesture-handler')`, dragging in reanimated — together
 * ~910KB transformed (~47% of the eager bundle) loaded on every page before any
 * interaction, even though the require never executes on web. PERF-014 removed
 * that weight by resolving the bare specifier to a no-op web stub in
 * metro.config.js. This guard fails CI if that lever is silently reverted.
 *
 * Two modes:
 *
 *   1. STATIC (default, fast, no build) — asserts the regression surface is intact:
 *      - metro.config.js still resolves bare `react-native-gesture-handler` to the
 *        web stub, guarded by `DISABLE_GH_STUB !== '1'`.
 *      - the stub file exists and still exports every symbol first-party code
 *        imports (an incomplete stub crashes at runtime).
 *      - no committed config (package.json / eas.json / app.json) force-enables the
 *        `DISABLE_GH_STUB=1` opt-out for builds.
 *
 *   2. ANALYZE (`--from-analyze`, run on a production export) — reconstructs the
 *      eager module set from the `ANALYZE_BUNDLE=1` metro serializer dumps
 *      (`/tmp/metro-analyze-*.json`) and fails if any forbidden vendor package has
 *      eager bytes, or the eager total exceeds the documented budget.
 *      Produce the dumps with: `ANALYZE_BUNDLE=1 npm run build:web`.
 *
 * Usage:
 *   node scripts/guard-eager-web-bundle.js                 # static report (exit 0)
 *   node scripts/guard-eager-web-bundle.js --fail          # static, exit 1 on breach
 *   node scripts/guard-eager-web-bundle.js --from-analyze --fail
 *   node scripts/guard-eager-web-bundle.js --json
 *
 * Env overrides:
 *   EAGER_BUDGET_KB   eager transformed-byte ceiling (default 1200; baseline ~1008)
 *   METRO_DUMP_DIR    directory holding metro-analyze-*.json (default: os.tmpdir())
 */

const fs = require('fs')
const os = require('os')
const path = require('path')

const repoRoot = path.join(__dirname, '..')
const args = process.argv.slice(2)
const FAIL = args.includes('--fail')
const JSON_OUT = args.includes('--json')
const FROM_ANALYZE = args.includes('--from-analyze')

// Vendor packages that must never reappear in the web eager set.
const FORBIDDEN_EAGER_PACKAGES = [
  'react-native-reanimated',
  'react-native-gesture-handler',
  'react-native-worklets',
  '@egjs/hammerjs',
]

// Symbols first-party code imports from gesture-handler; the web stub must export
// all of them or web pages crash with "X is not a function/component".
const REQUIRED_STUB_EXPORTS = [
  'GestureHandlerRootView',
  'Swipeable',
  'GestureDetector',
  'Gesture',
  'PinchGestureHandler',
  'State',
]

// Baseline eager ≈ 1008KB after PERF-014; ceiling leaves headroom but stays far
// below the 1918KB pre-fix regression.
const EAGER_BUDGET_KB = Number(process.env.EAGER_BUDGET_KB || 1200)

const problems = []
const notes = []

function read(file) {
  return fs.readFileSync(path.join(repoRoot, file), 'utf8')
}
function exists(file) {
  return fs.existsSync(path.join(repoRoot, file))
}

// ─── STATIC checks ───────────────────────────────────────────────────────────

function checkMetroStubWiring() {
  if (!exists('metro.config.js')) {
    problems.push('metro.config.js not found — cannot verify the GH stub lever')
    return
  }
  const src = read('metro.config.js')

  // The resolver branch that redirects bare RNGH → stub on web.
  const hasWebGuard = /platform === 'web'/.test(src)
  const hasModuleMatch = /moduleName === 'react-native-gesture-handler'/.test(src)
  const hasStubPath = /metro-stubs\/react-native-gesture-handler\.js/.test(src)
  const hasOptOutGuard = /DISABLE_GH_STUB !== '1'/.test(src)

  if (!(hasWebGuard && hasModuleMatch && hasStubPath)) {
    problems.push(
      'metro.config.js no longer resolves bare `react-native-gesture-handler` to the web stub — ' +
        'reanimated + gesture-handler (~910KB) will re-enter the web eager bundle (PERF-014 reverted)',
    )
  } else {
    notes.push('metro.config.js: web RNGH→stub resolver present')
  }
  if (hasModuleMatch && !hasOptOutGuard) {
    notes.push('warning: DISABLE_GH_STUB opt-out guard not found next to the stub branch')
  }
}

function checkStubCompleteness() {
  const stub = 'metro-stubs/react-native-gesture-handler.js'
  if (!exists(stub)) {
    problems.push(`${stub} is missing — the web resolver points at a non-existent stub`)
    return
  }
  const src = read(stub)
  const missing = REQUIRED_STUB_EXPORTS.filter(
    (name) => !new RegExp(`export const ${name}\\b`).test(src) && !new RegExp(`\\b${name}\\b`).test(src),
  )
  if (missing.length) {
    problems.push(
      `${stub} is missing exports used by first-party code: ${missing.join(', ')} — web pages would crash`,
    )
  } else {
    notes.push(`stub exports complete (${REQUIRED_STUB_EXPORTS.length} symbols)`)
  }
}

function checkNoCommittedOptOut() {
  for (const file of ['package.json', 'eas.json', 'app.json']) {
    if (!exists(file)) continue
    const src = read(file)
    if (/DISABLE_GH_STUB\s*[=:]\s*['"]?1/.test(src)) {
      problems.push(
        `${file} force-enables DISABLE_GH_STUB=1 — that turns the web stub OFF and reintroduces the eager weight`,
      )
    }
  }
  notes.push('no committed DISABLE_GH_STUB=1 opt-out in package.json/eas.json/app.json')
}

// ─── ANALYZE checks (production export) ──────────────────────────────────────

function bucketOf(p) {
  const i = p.lastIndexOf('node_modules/')
  if (i >= 0) {
    const rest = p.slice(i + 'node_modules/'.length)
    const parts = rest.split('/')
    return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]
  }
  return '(app)'
}

function runAnalyze(result) {
  const dumpDir = process.env.METRO_DUMP_DIR || os.tmpdir()
  let files = []
  try {
    files = fs
      .readdirSync(dumpDir)
      .filter((f) => /^metro-analyze-\d+-\d+\.json$/.test(f))
      .map((f) => path.join(dumpDir, f))
  } catch {
    /* dir unreadable */
  }
  if (!files.length) {
    problems.push(
      `--from-analyze: no metro-analyze-*.json dumps in ${dumpDir}. ` +
        'Run `ANALYZE_BUNDLE=1 npm run build:web` first (or set METRO_DUMP_DIR).',
    )
    return
  }

  // Pick the dump with the most modules — the main client web graph.
  let best = null
  for (const f of files) {
    try {
      const j = JSON.parse(fs.readFileSync(f, 'utf8'))
      if (!best || j.count > best.count) best = { ...j, file: f }
    } catch {
      /* skip corrupt */
    }
  }
  if (!best) {
    problems.push('--from-analyze: all dumps were unreadable/corrupt')
    return
  }

  const size = new Map()
  const deps = new Map()
  for (const [p, s, sd] of best.mods) {
    size.set(p, s)
    deps.set(p, sd || [])
  }
  const entries = String(best.entry).split(',').filter(Boolean)
  const eager = new Set(entries)
  const queue = [...entries]
  while (queue.length) {
    const cur = queue.pop()
    for (const d of deps.get(cur) || []) {
      if (!eager.has(d)) {
        eager.add(d)
        queue.push(d)
      }
    }
  }

  let eagerBytes = 0
  const byPkg = new Map()
  for (const p of eager) {
    const b = size.get(p) || 0
    eagerBytes += b
    const pkg = bucketOf(p)
    byPkg.set(pkg, (byPkg.get(pkg) || 0) + b)
  }

  const eagerKb = eagerBytes / 1024
  result.eagerKb = Math.round(eagerKb)
  result.eagerModules = eager.size

  for (const pkg of FORBIDDEN_EAGER_PACKAGES) {
    const bytes = byPkg.get(pkg) || 0
    if (bytes > 0) {
      problems.push(
        `forbidden vendor package "${pkg}" has ${(bytes / 1024).toFixed(1)}KB in the web eager set — ` +
          'it must stay behind a lazy boundary (PERF-014)',
      )
    }
  }
  if (eagerKb > EAGER_BUDGET_KB) {
    problems.push(
      `web eager bundle ${eagerKb.toFixed(1)}KB exceeds budget ${EAGER_BUDGET_KB}KB ` +
        `(baseline ~1008KB after PERF-014)`,
    )
  } else {
    notes.push(`eager bundle ${eagerKb.toFixed(1)}KB within budget ${EAGER_BUDGET_KB}KB (${eager.size} modules)`)
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

const result = { mode: FROM_ANALYZE ? 'analyze' : 'static' }

checkMetroStubWiring()
checkStubCompleteness()
checkNoCommittedOptOut()
if (FROM_ANALYZE) runAnalyze(result)

result.ok = problems.length === 0
result.problems = problems
result.notes = notes

if (JSON_OUT) {
  console.log(JSON.stringify(result, null, 2))
} else {
  console.log(`PERF-017 eager-web guard (${result.mode} mode)`)
  notes.forEach((n) => console.log(`  ✓ ${n}`))
  if (problems.length) {
    console.log('')
    problems.forEach((p) => console.log(`  ✗ ${p}`))
    console.log(`\n${problems.length} problem(s) found.`)
  } else {
    console.log('\nOK — web eager path protected; reanimated/gesture-handler stay out.')
  }
}

if (FAIL && problems.length) process.exit(1)
