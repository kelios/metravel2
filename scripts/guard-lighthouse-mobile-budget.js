#!/usr/bin/env node

/**
 * Regression guard: production mobile travel-details Lighthouse budget (#816).
 *
 * Consumes a machine-readable Lighthouse JSON report and fails when the mobile
 * travel-details performance budget is breached. Complements the byte-level
 * guards (guard:bundle-budget, guard:eager-web) with runtime metric checks so
 * Sorapis-style regressions (late title/backdrop LCP, high CLS, oversized early
 * images inflating TBT, low perf score) are caught, not just bundle growth.
 *
 * IMPORTANT — measurement method (see #814):
 * The Lighthouse `simulate` (lantern) throttling model inflates CLS attribution
 * to the hero block and produces a phantom ~0.15 "hero shift" that does not
 * happen on a real throttled device (real applied-throttling CLS ~0.07-0.10).
 * Produce the report this guard consumes with APPLIED throttling
 * (`--throttling-method=devtools`) so the budget checks real user-facing metrics
 * and not a lantern artifact. The budget file records the required method.
 *
 * This guard is report-consuming (deterministic): given a report it always
 * produces the same verdict, so it is unit-tested against committed fixtures
 * (bad Sorapis baseline -> fail, good baseline -> pass) and that self-test runs
 * inside `test:run` (release:check). Producing a fresh live report is an
 * environment-dependent post-deploy step, documented in docs/RELEASE.md.
 *
 * Usage:
 *   node scripts/guard-lighthouse-mobile-budget.js --report <path>          # report only (exit 0)
 *   node scripts/guard-lighthouse-mobile-budget.js --report <path> --fail   # exit 1 on any breach
 *   node scripts/guard-lighthouse-mobile-budget.js --report <path> --json   # machine-readable output
 *
 * Report path resolution: --report <path> | LIGHTHOUSE_REPORT env |
 *   ./lighthouse-report.produrl.mobile.json (default, matches lighthouse:produrl:travel:mobile).
 */

const fs = require('fs')
const path = require('path')

const repoRoot = path.join(__dirname, '..')

function resolveRepoPath(value, fallback) {
  if (!value) return fallback
  return path.isAbsolute(value) ? value : path.join(repoRoot, value)
}

const args = process.argv.slice(2)
const FAIL = args.includes('--fail')
const JSON_OUT = args.includes('--json')

function argValue(flag) {
  const i = args.indexOf(flag)
  if (i === -1 || i + 1 >= args.length) return ''
  return String(args[i + 1]).trim()
}

const reportPath = resolveRepoPath(
  argValue('--report') || process.env.LIGHTHOUSE_REPORT,
  path.join(repoRoot, 'lighthouse-report.produrl.mobile.json'),
)
const budgetPath = resolveRepoPath(
  argValue('--budget') || process.env.LIGHTHOUSE_BUDGET_CONFIG,
  path.join(repoRoot, 'config', 'lighthouse-budget-mobile.json'),
)

function die(msg) {
  console.error(msg)
  process.exit(1)
}

if (!fs.existsSync(budgetPath)) {
  die(`Lighthouse budget file not found at ${path.relative(repoRoot, budgetPath)}.`)
}
if (!fs.existsSync(reportPath)) {
  die(
    `Lighthouse report not found at ${path.relative(repoRoot, reportPath)}.\n` +
      `Produce one first, e.g.:\n` +
      `  npm run lighthouse:produrl:travel:mobile -- --url <prod-url>\n` +
      `(use APPLIED throttling / --throttling-method=devtools; see docs/RELEASE.md).`,
  )
}

let report
try {
  report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'))
} catch (error) {
  die(`Failed to parse Lighthouse report ${path.relative(repoRoot, reportPath)}: ${error}`)
}

const budget = JSON.parse(fs.readFileSync(budgetPath, 'utf-8'))
const b = budget.budget || {}

// Extract the metrics we budget. Report shape is the standard Lighthouse LHR.
const rawScore = report?.categories?.performance?.score
const score = typeof rawScore === 'number' ? Math.round(rawScore * 100) : null
const numeric = (auditId) => {
  const v = report?.audits?.[auditId]?.numericValue
  return typeof v === 'number' ? v : null
}
const metrics = {
  score,
  lcpMs: numeric('largest-contentful-paint'),
  clsValue: numeric('cumulative-layout-shift'),
  tbtMs: numeric('total-blocking-time'),
  fcpMs: numeric('first-contentful-paint'),
}

const breaches = []
function checkMin(label, actual, min) {
  if (min == null || actual == null) return
  if (actual < min) breaches.push({ label, actual, budget: min, kind: 'min' })
}
function checkMax(label, actual, max) {
  if (max == null || actual == null) return
  if (actual > max) breaches.push({ label, actual, budget: max, kind: 'max' })
}

checkMin('performance score', metrics.score, b.minPerformanceScore)
checkMax('LCP (ms)', metrics.lcpMs, b.maxLcpMs)
checkMax('CLS', metrics.clsValue, b.maxClsValue)
checkMax('TBT (ms)', metrics.tbtMs, b.maxTbtMs)
checkMax('FCP (ms)', metrics.fcpMs, b.maxFcpMs)

if (JSON_OUT) {
  console.log(
    JSON.stringify(
      {
        report: path.relative(repoRoot, reportPath),
        throttlingMethod: report?.configSettings?.throttlingMethod ?? null,
        metrics,
        budget: b,
        breaches,
        pass: breaches.length === 0,
      },
      null,
      2,
    ),
  )
} else {
  const tm = report?.configSettings?.throttlingMethod
  console.log(`Lighthouse mobile budget check — ${path.relative(repoRoot, reportPath)}`)
  if (tm && tm !== 'devtools' && tm !== 'provided') {
    console.log(
      `  ⚠ throttlingMethod="${tm}" — budget expects APPLIED throttling (devtools). ` +
        `simulate inflates CLS hero attribution (#814).`,
    )
  }
  const fmt = (v, unit) => (v == null ? 'n/a' : unit ? `${Math.round(v)}${unit}` : String(v))
  console.log(
    `  score ${fmt(metrics.score)} | LCP ${fmt(metrics.lcpMs, 'ms')} | ` +
      `CLS ${metrics.clsValue == null ? 'n/a' : metrics.clsValue.toFixed(3)} | ` +
      `TBT ${fmt(metrics.tbtMs, 'ms')} | FCP ${fmt(metrics.fcpMs, 'ms')}`,
  )
  if (breaches.length === 0) {
    console.log('✓ within mobile travel budget')
  } else {
    console.log(`✗ ${breaches.length} budget breach(es):`)
    for (const br of breaches) {
      const op = br.kind === 'min' ? '<' : '>'
      console.log(`  - ${br.label}: ${br.actual} ${op} budget ${br.budget}`)
    }
  }
}

if (breaches.length > 0 && FAIL) process.exit(1)
process.exit(0)
