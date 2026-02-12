#!/usr/bin/env node

/**
 * Lighthouse performance testing script for multiple pages.
 * Runs Mobile + Desktop audits per path and enforces thresholds.
 */

const fs = require('fs')
const path = require('path')
const net = require('net')
const { spawn } = require('child_process')

const OUTPUT_DIR = path.join(__dirname, '../lighthouse-reports')

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

function parseArgs(argv) {
  const args = {}
  const list = Array.isArray(argv) ? argv : []

  for (let i = 0; i < list.length; i += 1) {
    const token = String(list[i] ?? '')
    if (!token.startsWith('--')) continue

    const stripped = token.slice(2)
    if (!stripped) continue

    const eqIndex = stripped.indexOf('=')
    if (eqIndex !== -1) {
      const key = stripped.slice(0, eqIndex)
      const value = stripped.slice(eqIndex + 1)
      args[key] = value
      continue
    }

    const next = list[i + 1]
    if (next != null && !String(next).startsWith('--')) {
      args[stripped] = String(next)
      i += 1
      continue
    }

    args[stripped] = '1'
  }

  return args
}

function normalizePathname(input) {
  const raw = String(input || '').trim()
  if (!raw) return '/'
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      return new URL(raw).pathname || '/'
    } catch {
      return '/'
    }
  }
  return raw.startsWith('/') ? raw : `/${raw}`
}

function splitPaths(input) {
  const raw = String(input || '').trim()
  if (!raw) return []
  return raw
    .split(',')
    .map((p) => normalizePathname(p))
    .filter(Boolean)
}

function numberFromEnv(key, fallback) {
  const raw = process.env[key]
  if (raw == null) return fallback
  const str = String(raw).trim()
  if (!str) return fallback
  const num = Number(str)
  return Number.isFinite(num) ? num : fallback
}

async function findAvailablePort(startPort) {
  const start = Number(startPort) || 4173

  const tryPort = (port) =>
    new Promise((resolve) => {
      const server = net.createServer()
      server.unref()
      server.on('error', () => resolve(null))
      server.listen({ port, host: '127.0.0.1' }, () => {
        const actualPort = server.address().port
        server.close(() => resolve(actualPort))
      })
    })

  for (let i = 0; i < 25; i += 1) {
    const candidate = start + i
    const ok = await tryPort(candidate)
    if (ok) return ok
  }
  return start
}

async function runLighthouseViaScript({ url, formFactor, port, reportPath, env }) {
  const flags = [
    '--only-categories=performance,accessibility,best-practices,seo',
    `--emulated-form-factor=${formFactor}`,
    `--throttling-method=${env.throttlingMethod}`,
  ]

  return new Promise((resolve, reject) => {
    const child = spawn('node', [path.join(__dirname, 'run-lighthouse.js')], {
      stdio: 'inherit',
      env: {
        ...process.env,
        LIGHTHOUSE_HOST: '127.0.0.1',
        LIGHTHOUSE_PORT: String(port),
        LIGHTHOUSE_URL: url,
        LIGHTHOUSE_REPORT: reportPath,
        LIGHTHOUSE_FLAGS: flags.join(' '),
        LIGHTHOUSE_API_INSECURE: process.env.LIGHTHOUSE_API_INSECURE || '1',
        LIGHTHOUSE_API_STUB: env.apiStub,
        LIGHTHOUSE_API_ORIGIN: env.apiOrigin,
        LIGHTHOUSE_BUILD_DIR: env.buildDir,
      },
    })

    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Lighthouse failed with exit code ${code}`))
    })

    child.on('error', (error) => reject(error))
  })
}

function extractMetrics(lhr) {
  const { categories, audits } = lhr

  return {
    performance: Math.round(categories.performance.score * 100),
    accessibility: Math.round(categories.accessibility.score * 100),
    bestPractices: Math.round(categories['best-practices'].score * 100),
    seo: Math.round(categories.seo.score * 100),
    metrics: {
      fcp: audits['first-contentful-paint'].numericValue,
      lcp: audits['largest-contentful-paint'].numericValue,
      tbt: audits['total-blocking-time'].numericValue,
      cls: audits['cumulative-layout-shift'].numericValue,
      si: audits['speed-index'].numericValue,
    },
  }
}

function assertThresholds(label, results, thresholds) {
  const failed = []

  if (results.performance < thresholds.minPerf) failed.push(`${label}: Performance < ${thresholds.minPerf}`)
  if (results.accessibility < thresholds.minA11y) failed.push(`${label}: Accessibility < ${thresholds.minA11y}`)
  if (results.bestPractices < thresholds.minBest) failed.push(`${label}: Best Practices < ${thresholds.minBest}`)
  if (results.seo < thresholds.minSeo) failed.push(`${label}: SEO < ${thresholds.minSeo}`)

  if (results.metrics.lcp > thresholds.maxLcpMs) failed.push(`${label}: LCP > ${thresholds.maxLcpMs}ms`)
  if (results.metrics.cls > thresholds.maxCls) failed.push(`${label}: CLS > ${thresholds.maxCls}`)
  if (results.metrics.tbt > thresholds.maxTbtMs) failed.push(`${label}: TBT > ${thresholds.maxTbtMs}ms`)
  if (results.metrics.fcp > thresholds.maxFcpMs) failed.push(`${label}: FCP > ${thresholds.maxFcpMs}ms`)
  if (results.metrics.si > thresholds.maxSiMs) failed.push(`${label}: SI > ${thresholds.maxSiMs}ms`)

  return failed
}

function formatMetric(value, unit = 'ms') {
  if (unit === 'ms') return `${Math.round(value)}ms`
  return value.toFixed(3)
}

function scoreDot(score) {
  if (score >= 90) return '🟢'
  if (score >= 50) return '🟠'
  return '🔴'
}

function printResults(pathname, formFactor, results) {
  console.log(`\n${'='.repeat(72)}`)
  console.log(`📊 ${formFactor.toUpperCase()} — ${pathname}`)
  console.log(`${'='.repeat(72)}\n`)

  console.log('SCORES:')
  console.log(`  Performance:     ${scoreDot(results.performance)} ${results.performance}/100`)
  console.log(`  Accessibility:   ${scoreDot(results.accessibility)} ${results.accessibility}/100`)
  console.log(`  Best Practices:  ${scoreDot(results.bestPractices)} ${results.bestPractices}/100`)
  console.log(`  SEO:             ${scoreDot(results.seo)} ${results.seo}/100\n`)

  console.log('CORE WEB VITALS:')
  console.log(`  FCP: ${formatMetric(results.metrics.fcp)} | LCP: ${formatMetric(results.metrics.lcp)} | TBT: ${formatMetric(results.metrics.tbt)}`)
  console.log(`  CLS: ${formatMetric(results.metrics.cls, 'score')} | SI: ${formatMetric(results.metrics.si)}`)
}

async function auditPath(pathname, env, thresholds) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
  const port = await findAvailablePort(env.preferredPort)
  const localUrl = `http://127.0.0.1:${port}${pathname}`

  const mobileJsonPath = path.join(OUTPUT_DIR, `mobile-${timestamp}-${pathname.replace(/\W+/g, '_')}.json`)
  await runLighthouseViaScript({
    url: localUrl,
    formFactor: 'mobile',
    port,
    reportPath: mobileJsonPath,
    env,
  })
  const mobileMetrics = extractMetrics(JSON.parse(fs.readFileSync(mobileJsonPath, 'utf8')))

  const desktopJsonPath = path.join(OUTPUT_DIR, `desktop-${timestamp}-${pathname.replace(/\W+/g, '_')}.json`)
  await runLighthouseViaScript({
    url: localUrl,
    formFactor: 'desktop',
    port,
    reportPath: desktopJsonPath,
    env,
  })
  const desktopMetrics = extractMetrics(JSON.parse(fs.readFileSync(desktopJsonPath, 'utf8')))

  printResults(pathname, 'Mobile', mobileMetrics)
  printResults(pathname, 'Desktop', desktopMetrics)

  const failures = [
    ...assertThresholds(`${pathname} Mobile`, mobileMetrics, thresholds),
    ...assertThresholds(`${pathname} Desktop`, desktopMetrics, thresholds),
  ]

  return { pathname, mobile: mobileMetrics, desktop: desktopMetrics, failures }
}

async function main() {
  const argv = parseArgs(process.argv.slice(2))

  const paths =
    splitPaths(argv.paths) ||
    []

  const finalPaths = paths.length ? paths : ['/', '/search', '/map']

  const env = {
    apiStub: String(argv['api-stub'] ?? argv.apiStub ?? process.env.LIGHTHOUSE_API_STUB ?? '0') === '1' ? '1' : '0',
    apiOrigin: String(argv['api-origin'] || argv.apiOrigin || process.env.LIGHTHOUSE_API_ORIGIN || 'https://metravel.by').trim(),
    buildDir: String(argv['build-dir'] || argv.buildDir || process.env.LIGHTHOUSE_BUILD_DIR || '').trim() || path.join(__dirname, '..', 'dist', 'prod'),
    throttlingMethod: String(argv['throttling-method'] || argv.throttlingMethod || process.env.LIGHTHOUSE_THROTTLING_METHOD || 'simulate').trim(),
    preferredPort: Number(argv.port || process.env.LIGHTHOUSE_PORT || '4173'),
  }

  if (!fs.existsSync(env.buildDir)) {
    console.error(`❌ Build directory not found: ${env.buildDir}`)
    process.exit(1)
  }

  const thresholds = {
    minPerf: numberFromEnv('LIGHTHOUSE_MIN_PERF', 50),
    minA11y: numberFromEnv('LIGHTHOUSE_MIN_A11Y', 90),
    minBest: numberFromEnv('LIGHTHOUSE_MIN_BEST', 89),
    minSeo: numberFromEnv('LIGHTHOUSE_MIN_SEO', 90),
    maxLcpMs: numberFromEnv('LIGHTHOUSE_MAX_LCP_MS', 10000),
    maxCls: numberFromEnv('LIGHTHOUSE_MAX_CLS', 0.1),
    maxTbtMs: numberFromEnv('LIGHTHOUSE_MAX_TBT_MS', 800),
    maxFcpMs: numberFromEnv('LIGHTHOUSE_MAX_FCP_MS', 8000),
    maxSiMs: numberFromEnv('LIGHTHOUSE_MAX_SI_MS', 8000),
  }

  console.log(`\n🚀 Testing performance for pages:`)
  finalPaths.forEach((p) => console.log(`  - ${p}`))
  console.log(`\nBuild dir: ${env.buildDir}`)
  console.log(`API: ${env.apiStub === '1' ? 'stubbed' : env.apiOrigin}`)
  console.log(`Throttling: ${env.throttlingMethod}\n`)

  const summary = []
  const failures = []

  for (const pathname of finalPaths) {
    const result = await auditPath(pathname, env, thresholds)
    summary.push(result)
    failures.push(...result.failures)
  }

  const report = {
    timestamp: new Date().toISOString(),
    buildDir: env.buildDir,
    api: env.apiStub === '1' ? 'stub' : env.apiOrigin,
    throttlingMethod: env.throttlingMethod,
    thresholds,
    pages: summary.map((r) => ({ pathname: r.pathname, mobile: r.mobile, desktop: r.desktop })),
    failures,
  }

  const outFile = path.join(OUTPUT_DIR, `performance-pages-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.json`)
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2))
  console.log(`\n📄 Summary report saved to: ${outFile}`)

  if (failures.length === 0) {
    console.log('\n🎉 EXCELLENT! All thresholds passed.')
    process.exit(0)
  }

  console.log('\n⚠️  Some thresholds failed:')
  failures.forEach((line) => console.log(`   - ${line}`))
  process.exit(1)
}

main().catch((error) => {
  console.error('❌ Error running Lighthouse:', error)
  process.exit(1)
})
