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

// #1287: прежний baseline (`…-harzer-hexenstieg-kak-proiti-marshrut-i-kak-eto-…`)
// отвечает 301 — slug статьи переименован. Каждый гейтовый прогон платил лишний
// редирект и мерил цепочку, а не саму страницу. Проверено 2026-08-06: этот URL
// отдаёт 200 напрямую.
const defaultUrl = 'https://metravel.by/travels/tropa-vedm-v-gartse-kak-proiti-hexenstieg'

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

// #1147: раньше режим троттлинга был зашит в `simulate`, хотя
// `config/lighthouse-budget-mobile.json` требует `devtools` (applied) и
// guard-скрипт печатал предупреждение на каждом отчёте. Режимы дают разную
// картину на одном URL (замер прода 2026-07-30, /travels/ourvietnam):
//   simulate → score 47, LCP 10 925 мс, CLS 0.011, TBT 784 мс
//   devtools → score 64, LCP  4 836 мс, CLS 0.161, TBT 230 мс
// `simulate` прячет реальный CLS, `devtools` — поздний LCP-swap; гейтовым
// считается `devtools`, второй режим остаётся доступен явным флагом.
const throttlingRaw = String(
  getArg('--throttlingMethod') || process.env.LIGHTHOUSE_THROTTLING_METHOD || 'devtools',
).toLowerCase()
if (!['devtools', 'simulate', 'provided'].includes(throttlingRaw)) {
  console.error('❌ Invalid --throttlingMethod. Use devtools | simulate | provided')
  process.exit(1)
}
const throttlingMethod = throttlingRaw
if (throttlingMethod !== 'devtools') {
  console.warn(
    `⚠ throttling-method=${throttlingMethod} — это НЕ гейтовый режим. ` +
      'Бюджет config/lighthouse-budget-mobile.json проверяется по devtools (applied).',
  )
}

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

/**
 * #1287: тихо подменённый профиль — самый дорогой вид ошибки измерения, потому
 * что отчёт выглядит нормальным. Проверяем по самому отчёту, что Lighthouse
 * мерил именно то, что запросили, и что URL не увёл нас редиректом на другую
 * страницу (устаревший baseline).
 */
const assertMeasuredProfile = (lhr) => {
  const measured = String(lhr?.configSettings?.formFactor || '').toLowerCase()
  if (measured && measured !== formFactor) {
    throw new Error(
      `Lighthouse измерил form factor "${measured}", а запрошен "${formFactor}". ` +
        'Отчёт невалиден — проверьте флаги профиля.',
    )
  }

  const requested = String(lhr?.requestedUrl || url).replace(/\/+$/, '')
  const final = String(lhr?.finalDisplayedUrl || lhr?.finalUrl || '').replace(/\/+$/, '')
  if (final && requested && final !== requested) {
    console.warn(
      `⚠ Замеряемый URL увёл редиректом: ${requested} → ${final}. ` +
        'В метрику попала лишняя навигация — обновите baseline-URL на финальный.',
    )
  }
}

ensureDir(outputPath)

/**
 * #1287: раньше здесь стоял `--emulated-form-factor=${formFactor}`. В Lighthouse
 * 13.x (та же версия, что крутит PSI) этого флага НЕТ — он удалён, а неизвестный
 * флаг не роняет прогон, а молча игнорируется. То есть `--formFactor desktop`
 * годами мерил мобильную эмуляцию. Замер прода 2026-08-06 по одному и тому же
 * URL, `--throttling-method=simulate`:
 *
 *   скрипт --formFactor desktop → score 53, FCP 7 521 мс, LCP 9 469 мс, 3 707 KiB
 *   скрипт --formFactor mobile  → score 52, FCP 7 325 мс, LCP 9 469 мс, 3 707 KiB
 *   npx lighthouse --preset=desktop → score 80, FCP 0,3 с, LCP 1,7 с, 2 840 KiB
 *
 * Одинаковые LCP и байты у двух «разных» form factor — признак одного профиля;
 * второй маркер в network-requests: у настоящего desktop идут картинки `?w=320`,
 * у мобиля `?w=640`. Ниже — поддерживаемая форма: desktop задаётся пресетом,
 * mobile остаётся дефолтом Lighthouse.
 */
const runOnce = (runOutputPath) =>
  new Promise((resolve, reject) => {
    const lighthouseArgs = [
      'lighthouse',
      url,
      '--only-categories=performance',
      ...(formFactor === 'desktop' ? ['--preset=desktop'] : []),
      `--throttling-method=${throttlingMethod}`,
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
    const lhr = readJson(out)
    assertMeasuredProfile(lhr)
    results.push(extract(lhr))
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
  console.log(`Throttling: ${throttlingMethod}${throttlingMethod === 'devtools' ? ' (gate mode)' : ' (NOT gate mode)'}`)
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
