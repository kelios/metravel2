#!/usr/bin/env node

/**
 * Stage 7 regression guard: web bundle size budget.
 *
 * Reads the production web build chunks from `dist/prod/_expo/static/js/web`,
 * groups them by logical chunk name (filename without the content hash), and
 * compares raw + gzip sizes against the committed budget in
 * `config/bundle-budget.json`.
 *
 * Goal: prevent the travel-route performance refactor (see
 * docs/TRAVEL_PERFORMANCE_REFACTOR.md, этап 7) from silently regressing.
 *
 * Usage:
 *   node scripts/guard-bundle-budget.js            # report only (exit 0)
 *   node scripts/guard-bundle-budget.js --fail     # exit 1 on any breach
 *   node scripts/guard-bundle-budget.js --json      # machine-readable output
 *   node scripts/guard-bundle-budget.js --update    # rewrite budget from current build
 */

const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const repoRoot = path.join(__dirname, '..')
const DEFAULT_TOLERANCE_PCT = 5
const DEFAULT_BUDGET_DESCRIPTION =
  'Web bundle size budget (KB). Regression guard: critical path + eager chunks and total JS. Regenerate with `node scripts/guard-bundle-budget.js --update`, then re-curate key chunks. Runs in release:check after build:web:prod.'

function resolveRepoPath(value, fallback) {
  if (!value) return fallback
  return path.isAbsolute(value) ? value : path.join(repoRoot, value)
}

const jsDir = resolveRepoPath(
  process.env.BUNDLE_BUDGET_JS_DIR,
  path.join(repoRoot, 'dist', 'prod', '_expo', 'static', 'js', 'web'),
)
const budgetPath = resolveRepoPath(
  process.env.BUNDLE_BUDGET_CONFIG,
  path.join(repoRoot, 'config', 'bundle-budget.json'),
)

const args = process.argv.slice(2)
const FAIL = args.includes('--fail')
const JSON_OUT = args.includes('--json')
const UPDATE = args.includes('--update')

function die(msg) {
  console.error(msg)
  process.exit(1)
}

if (!fs.existsSync(jsDir)) {
  die(
    `Web build chunks not found at ${path.relative(repoRoot, jsDir)}.\n` +
      `Run "npm run build:web:prod" first.`,
  )
}

// Strip the Metro content hash so chunks are stable across builds.
//   entry-1a2b3c4d5e6f.js        -> entry
//   __common-9f8e7d.js           -> __common
//   TravelDetailsContainer-ab12.js -> TravelDetailsContainer
function logicalName(file) {
  return file.replace(/\.js$/, '').replace(/-[0-9a-f]{6,}$/i, '')
}

const KB = 1024
const toKB = (bytes) => Math.round((bytes / KB) * 10) / 10

const files = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js'))

// Aggregate per logical chunk (a logical name can map to >1 hashed file
// across incremental builds; sum them so the budget stays meaningful).
const chunks = new Map()
let allRaw = 0
let allGzip = 0
for (const file of files) {
  const buf = fs.readFileSync(path.join(jsDir, file))
  const raw = buf.length
  const gzip = zlib.gzipSync(buf).length
  allRaw += raw
  allGzip += gzip
  const name = logicalName(file)
  const prev = chunks.get(name) || { raw: 0, gzip: 0, files: 0 }
  chunks.set(name, { raw: prev.raw + raw, gzip: prev.gzip + gzip, files: prev.files + 1 })
}

if (UPDATE) {
  let existingBudget = {}
  if (fs.existsSync(budgetPath)) {
    try {
      existingBudget = JSON.parse(fs.readFileSync(budgetPath, 'utf-8'))
    } catch {
      existingBudget = {}
    }
  }
  const deferredChunks = existingBudget.deferredChunks || []
  const deferredSet = new Set(deferredChunks)
  const deferredRaw = [...chunks.entries()].reduce(
    (total, [name, chunk]) => total + (deferredSet.has(name) ? chunk.raw : 0),
    0,
  )
  const deferredGzip = [...chunks.entries()].reduce(
    (total, [name, chunk]) => total + (deferredSet.has(name) ? chunk.gzip : 0),
    0,
  )
  const budget = {
    description: existingBudget.description || DEFAULT_BUDGET_DESCRIPTION,
    tolerancePct: DEFAULT_TOLERANCE_PCT,
    deferredChunks,
    total: { maxRawKB: toKB(allRaw - deferredRaw), maxGzipKB: toKB(allGzip - deferredGzip) },
    chunks: {},
  }
  for (const [name, c] of [...chunks.entries()].sort((a, b) => b[1].raw - a[1].raw)) {
    budget.chunks[name] = { maxRawKB: toKB(c.raw), maxGzipKB: toKB(c.gzip) }
  }
  fs.writeFileSync(budgetPath, JSON.stringify(budget, null, 2) + '\n')
  console.log(`Wrote budget for ${chunks.size} chunks to ${path.relative(repoRoot, budgetPath)}`)
  process.exit(0)
}

if (!fs.existsSync(budgetPath)) {
  die(
    `Budget file not found at ${path.relative(repoRoot, budgetPath)}.\n` +
      `Generate it with "node scripts/guard-bundle-budget.js --update".`,
  )
}

const budget = JSON.parse(fs.readFileSync(budgetPath, 'utf-8'))
const tol = 1 + (Number(budget.tolerancePct) || 0) / 100
const deferredSet = new Set(Array.isArray(budget.deferredChunks) ? budget.deferredChunks : [])
const deferredRaw = [...chunks.entries()].reduce(
  (total, [name, chunk]) => total + (deferredSet.has(name) ? chunk.raw : 0),
  0,
)
const deferredGzip = [...chunks.entries()].reduce(
  (total, [name, chunk]) => total + (deferredSet.has(name) ? chunk.gzip : 0),
  0,
)
const totalRaw = allRaw - deferredRaw
const totalGzip = allGzip - deferredGzip

const breaches = []
function check(label, actualKB, maxKB) {
  if (maxKB == null) return
  const limit = Math.round(maxKB * tol * 10) / 10
  if (actualKB > limit) {
    breaches.push({ label, actualKB, maxKB, limitKB: limit })
  }
}

for (const [name, b] of Object.entries(budget.chunks || {})) {
  const c = chunks.get(name)
  if (!c) continue // chunk dropped/renamed — not a size regression
  check(`${name} (raw)`, toKB(c.raw), b.maxRawKB)
  check(`${name} (gzip)`, toKB(c.gzip), b.maxGzipKB)
}
if (budget.total) {
  check('TOTAL (raw)', toKB(totalRaw), budget.total.maxRawKB)
  check('TOTAL (gzip)', toKB(totalGzip), budget.total.maxGzipKB)
}

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        totalRawKB: toKB(totalRaw),
        totalGzipKB: toKB(totalGzip),
        allRawKB: toKB(allRaw),
        allGzipKB: toKB(allGzip),
        deferredRawKB: toKB(deferredRaw),
        deferredGzipKB: toKB(deferredGzip),
        chunkCount: chunks.size,
        breaches,
      },
      null,
      2,
    ),
  )
} else {
  console.log(`Bundle budget check — tolerance ±${budget.tolerancePct || 0}%`)
  console.log(
    `  release total: ${toKB(totalRaw)} KB raw / ${toKB(totalGzip)} KB gzip ` +
      `(${chunks.size} chunks; deferred: ${toKB(deferredRaw)} KB raw / ${toKB(deferredGzip)} KB gzip)`,
  )
  if (breaches.length === 0) {
    console.log('✓ all budgeted chunks within limits')
  } else {
    console.log(`✗ ${breaches.length} budget breach(es):`)
    for (const b of breaches) {
      console.log(`  - ${b.label}: ${b.actualKB} KB > ${b.limitKB} KB (budget ${b.maxKB} KB)`)
    }
  }
}

if (breaches.length > 0 && FAIL) process.exit(1)
process.exit(0)
