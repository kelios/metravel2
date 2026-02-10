#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const args = process.argv.slice(2)

const getArg = (name) => {
  const idx = args.indexOf(name)
  if (idx === -1) return undefined
  return args[idx + 1]
}

const formFactorRaw = getArg('--formFactor')
const outputPath = getArg('--output')
const runsRaw = getArg('--runs')

const urlFromEnv = process.env.LIGHTHOUSE_URL
const urlFromArg = getArg('--url')

const defaultUrl =
  'https://metravel.by/travels/tropa-vedm-harzer-hexenstieg-kak-proiti-marshrut-i-kak-eto-vygliadit-na-samom-dele'

const url = urlFromArg || urlFromEnv || defaultUrl

if (!outputPath) {
  console.error('❌ Missing --output <path>')
  process.exit(1)
}

const formFactor = String(formFactorRaw || 'mobile').toLowerCase()
if (formFactor !== 'mobile' && formFactor !== 'desktop') {
  console.error('❌ Invalid --formFactor. Use mobile or desktop')
  process.exit(1)
}

const runs = Math.max(1, Number(runsRaw || process.env.LIGHTHOUSE_RUNS || 1) || 1)

const ensureDir = (filePath) => {
  const dir = path.dirname(path.resolve(filePath))
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

const makeRunOutputPath = (baseOutputPath, idx, total) => {
  const abs = path.resolve(baseOutputPath)
  if (total <= 1) return abs
  const ext = path.extname(abs) || '.json'
  const base = abs.slice(0, abs.length - ext.length)
  return `${base}.run${String(idx).padStart(2, '0')}${ext}`
}

const readJson = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(raw)
}

const extract = (lhrJson) => {
  const score = lhrJson?.categories?.performance?.score
  const perf = typeof score === 'number' ? Math.round(score * 100) : 0
  const audits = lhrJson?.audits || {}

  const metric = (key) => {
    const v = audits?.[key]?.numericValue
    return typeof v === 'number' ? v : null
  }

  return {
    perf,
    lcp: metric('largest-contentful-paint'),
    tbt: metric('total-blocking-time'),
    cls: metric('cumulative-layout-shift'),
    fcp: metric('first-contentful-paint'),
    si: metric('speed-index'),
  }
}

const median = (values) => {
  const arr = values.filter((v) => typeof v === 'number' && Number.isFinite(v)).slice().sort((a, b) => a - b)
  if (arr.length === 0) return null
  const mid = Math.floor(arr.length / 2)
  return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid]
}

const formatMs = (v) => (typeof v === 'number' ? `${Math.round(v)}ms` : 'n/a')
const formatCls = (v) => (typeof v === 'number' ? v.toFixed(3) : 'n/a')

ensureDir(outputPath)

const runOnce = (runOutputPath) =>
  new Promise((resolve, reject) => {
    const lighthouseArgs = [
      'lighthouse',
      url,
      '--only-categories=performance',
      `--emulated-form-factor=${formFactor}`,
      '--throttling-method=simulate',
      '--output=json',
      `--output-path=${runOutputPath}`,
      '--quiet',
      '--chrome-flags=--headless --no-sandbox',
    ]

    const child = spawn('npx', lighthouseArgs, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })

    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Lighthouse failed with exit code ${code}`))
    })
    child.on('error', reject)
  })

;(async () => {
  const outputs = []
  const results = []

  for (let i = 1; i <= runs; i += 1) {
    const out = makeRunOutputPath(outputPath, i, runs)
    outputs.push(out)
    await runOnce(out)
    results.push(extract(readJson(out)))
  }

  const perfValues = results.map((r) => r.perf)
  const minPerf = Math.min(...perfValues)
  const maxPerf = Math.max(...perfValues)
  const medPerf = median(perfValues)

  const medLcp = median(results.map((r) => r.lcp))
  const medTbt = median(results.map((r) => r.tbt))
  const medCls = median(results.map((r) => r.cls))

  console.log('\n================ Lighthouse prod-url summary ================')
  console.log(`URL: ${url}`)
  console.log(`Form factor: ${formFactor}`)
  console.log(`Runs: ${runs}`)
  console.log(`Performance: min=${minPerf} median=${medPerf == null ? 'n/a' : Math.round(medPerf)} max=${maxPerf}`)
  console.log(`Median LCP: ${formatMs(medLcp)} | Median TBT: ${formatMs(medTbt)} | Median CLS: ${formatCls(medCls)}`)
  console.log('Reports:')
  outputs.forEach((p) => console.log(`- ${p}`))
  console.log('============================================================\n')
})().catch((error) => {
  console.error('❌ Failed to run Lighthouse:', error)
  process.exit(1)
})
