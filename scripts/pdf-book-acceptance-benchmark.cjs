'use strict'

// Read-only production acceptance for #2232. Nothing here reconstructs a
// historical production timing: compare newly observed before/after runs only.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { performance } = require('node:perf_hooks')

const ROOT = path.resolve(__dirname, '..')
const PROD = 'https://metravel.by'
const VIEWPORT = Object.freeze({ width: 1280, height: 900 })
const BYTE_METRIC = 'encoded-response-entity-bytes/content-length-or-visible-resource-timing-v1'
const BOOK_FIELDS = Object.freeze([
  'id', 'name', 'slug', 'url', 'description', 'recommendation', 'plus', 'minus',
  'countryName', 'cityName', 'year', 'monthName', 'number_days', 'travel_image_thumb_url',
  'travel_image_print_url', 'travel_image_url', 'gallery', 'media', 'travelAddress',
  'youtube_link', 'userName',
])

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
  }
  return value
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}

function bookInput(travel) {
  // Explicit generator inputs exclude changing views/access timestamps.
  return Object.fromEntries(BOOK_FIELDS.map((key) => [key, travel[key] ?? null]))
}

function assertSelection(actual, expected) {
  if (!Array.isArray(actual) || !Array.isArray(expected) || expected.length !== 2 || new Set(expected).size !== 2 ||
      actual.length !== 2 || new Set(actual).size !== 2 || hash([...actual].sort()) !== hash([...expected].sort())) {
    throw new Error('Exactly the two requested cards must be selected')
  }
}

function safeUrl(raw) {
  if (raw.startsWith('data:')) return raw.split(',')[0]
  const url = new URL(raw)
  for (const key of [...url.searchParams.keys()]) {
    if (/token|password|secret|signature|credential|authorization|api[_-]?key|access[_-]?key/i.test(key)) url.searchParams.set(key, '[redacted]')
  }
  return url.toString()
}

function galleryAsset(raw) {
  // Print proxy sizing/quality may change while the underlying photograph is
  // the same. Match its host/path, preserving repeated photographs as entries.
  const url = new URL(raw)
  return `${url.host}${url.pathname}`
}

function expectedGallery(snapshots) {
  return snapshots.flatMap((travel) => travel.gallery.map((photo, index) => ({
    travelId: String(travel.id),
    id: String(typeof photo === 'string' ? index : (photo.id ?? index)),
    asset: galleryAsset(typeof photo === 'string' ? photo : (photo.print_url || photo.url)),
  })))
}

function captureNetwork(context, getPhase, formatError) {
  const requests = [], pending = new Map(), details = new Map(), listeners = new Set()
  const notify = () => { for (const listener of listeners) listener() }
  const complete = (request, bytes, source) => {
    const entry = pending.get(request)
    entry.encodedBodyBytes = bytes
    entry.byteSource = source
    entry.networkState = 'complete'
    pending.delete(request)
    notify()
  }
  const onRequest = (request) => {
    const entry = { url: safeUrl(request.url()), method: request.method(), type: request.resourceType(), phase: getPhase(), status: null, networkState: 'in-flight' }
    requests.push(entry)
    pending.set(request, entry)
    let page
    try { page = request.frame().page() } catch { entry.pageUnavailable = true }
    details.set(request, { url: request.url(), page })
  }
  const onResponse = (response) => {
    const request = response.request(), entry = pending.get(request)
    if (entry) {
      entry.status = response.status()
      // The synchronous headers do not depend on Playwright's missing popup
      // raw-header metadata. Retain only the byte evidence, never auth headers.
      details.get(request).contentLength = response.headers()['content-length']
    }
  }
  const onFinished = (request) => {
    const entry = pending.get(request)
    if (!entry) return
    if (entry.method === 'HEAD' || entry.status === 304) {
      entry.sizeError = 'HEAD/304 response byte evidence is unsupported'
      entry.networkState = 'size-error'
      pending.delete(request)
      notify()
      return
    }
    const length = details.get(request).contentLength
    if (length !== undefined) {
      if (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length))) {
        entry.sizeError = 'Invalid Content-Length byte evidence'
        entry.networkState = 'size-error'
        pending.delete(request)
        notify()
      } else complete(request, Number(length), 'content-length')
    } else {
      entry.networkState = 'awaiting-resource-timing'
      notify()
    }
  }
  const onFailed = (request) => {
    const entry = pending.get(request)
    if (!entry) return
    entry.failure = request.failure()?.errorText || 'failed'
    entry.networkState = 'failed'
    pending.delete(request)
    notify()
  }
  const collectTiming = async () => {
    const pages = new Set([...pending.keys()].filter((request) => pending.get(request).networkState === 'awaiting-resource-timing').map((request) => details.get(request).page).filter(Boolean))
    for (const page of pages) {
      const timings = await page.evaluate(() => [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')].map((entry) => ({
        name: entry.name, encodedBodySize: entry.encodedBodySize, responseEnd: entry.responseEnd,
      })))
      for (const [request, entry] of pending) {
        const detail = details.get(request)
        if (detail.page !== page || entry.networkState !== 'awaiting-resource-timing') continue
        const occurrences = [...details.values()].filter((other) => other.page === page && other.url === detail.url).length
        const matches = timings.filter((timing) => timing.name === detail.url && timing.responseEnd > 0)
        // Multiple occurrences cannot be assigned to a particular request by
        // URL alone. Missing/opaque zero sizes never become fabricated bytes.
        if (occurrences !== 1 || matches.length !== 1 || !Number.isSafeInteger(matches[0].encodedBodySize) || matches[0].encodedBodySize <= 0) continue
        complete(request, matches[0].encodedBodySize, 'resource-timing')
      }
    }
  }
  context.on('request', onRequest)
  context.on('response', onResponse)
  context.on('requestfinished', onFinished)
  context.on('requestfailed', onFailed)
  return {
    requests,
    pending: () => [...pending.values()].map((entry) => ({ ...entry })),
    waitForCompletion: (timeoutMs = 30_000) => new Promise((resolve, reject) => {
      let deadline, poll, collecting = false, done = false
      const finish = (error) => {
        if (done) return
        done = true
        clearTimeout(deadline)
        clearTimeout(poll)
        listeners.delete(check)
        if (error) reject(error)
        else resolve()
      }
      const check = () => {
        if (done || collecting) return
        if (!pending.size) {
          finish(requests.some((entry) => entry.failure || entry.sizeError) ? new Error('Network completion failed; see request evidence') : null)
          return
        }
        collecting = true
        collectTiming().then(() => {
          collecting = false
          if (!done) { if (!pending.size) check(); else poll = setTimeout(check, 100) }
        }).catch((error) => finish(new Error(`Resource Timing unavailable: ${formatError(error)}`)))
      }
      listeners.add(check)
      deadline = setTimeout(() => finish(new Error(`Network completion deadline exceeded (${timeoutMs}ms); ${pending.size} requests unfinished or missing unambiguous encoded byte evidence`)), timeoutMs)
      check()
    }),
    stop: () => {
      context.off('request', onRequest)
      context.off('response', onResponse)
      context.off('requestfinished', onFinished)
      context.off('requestfailed', onFailed)
    },
  }
}
function outputPath(file) {
  if (!file || path.extname(file) !== '.json') throw new Error('--output must be a .json file in .codex-temp')
  const absolute = path.resolve(ROOT, file)
  const relative = path.relative(path.join(ROOT, '.codex-temp'), absolute)
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('--output must stay in .codex-temp')
  }
  return absolute
}

function parseArgs(argv) {
  const options = {}
  for (let i = 0; i < argv.length; i += 2) {
    if (!['--ids', '--label', '--output', '--compare', '--noise-ms', '--noise-ratio'].includes(argv[i]) || !argv[i + 1]) {
      throw new Error('Use --ids ID,ID --label before|after --output .codex-temp/path.json; optionally --compare baseline.json')
    }
    options[argv[i].slice(2)] = argv[i + 1]
  }
  const ids = String(options.ids || '').split(',')
  if (ids.length !== 2 || new Set(ids).size !== 2 || ids.some((id) => !/^[1-9]\d*$/.test(id))) {
    throw new Error('--ids requires exactly two distinct positive travel IDs, each with a gallery')
  }
  if (!['before', 'after'].includes(options.label)) throw new Error('--label must be before or after')
  const noiseMs = options['noise-ms'] === undefined ? 500 : Number(options['noise-ms'])
  const noiseRatio = options['noise-ratio'] === undefined ? 0.1 : Number(options['noise-ratio'])
  if (!Number.isFinite(noiseMs) || noiseMs < 0 || !Number.isFinite(noiseRatio) || noiseRatio < 0 || noiseRatio > 1) {
    throw new Error('Timing noise must be nonnegative milliseconds and a ratio from 0 to 1')
  }
  return {
    ids, label: options.label, output: outputPath(options.output),
    compare: options.compare ? outputPath(options.compare) : null, noiseMs, noiseRatio,
  }
}

function compareReports(before, after, { noiseMs = 500, noiseRatio = 0.1 } = {}) {
  if (!Number.isFinite(noiseMs) || noiseMs < 0 || !Number.isFinite(noiseRatio) || noiseRatio < 0 || noiseRatio > 1) {
    throw new Error('Invalid timing noise budget')
  }
  const failures = []
  const conditions = ['schema', 'mode', 'ids', 'inputHash', 'settings', 'expectedGallery', 'viewport', 'browser', 'dpr', 'cache', 'url', 'byteMetric']
  for (const key of conditions) {
    if (before[key] === undefined || after[key] === undefined || hash(before[key]) !== hash(after[key])) {
      failures.push(`incomparable:${key}`)
    }
  }
  if (before.label !== 'before' || after.label !== 'after') failures.push('incomparable:labels')
  for (const [label, report] of [['before', before], ['after', after]]) {
    if (report.byteMetric !== BYTE_METRIC) failures.push(`${label}:invalid-byte-policy`)
    if (report.schema !== 1 || report.mode !== 'desktop-two-travel' || report.accountId !== '104') failures.push(`${label}:invalid-probe`)
    if (!Array.isArray(report.ids) || report.ids.length !== 2 || new Set(report.ids).size !== 2 || report.ids.some((id) => !/^[1-9]\d*$/.test(String(id))) ||
        !/^[a-f0-9]{64}$/.test(String(report.inputHash)) || !report.settings || typeof report.settings !== 'object') failures.push(`${label}:invalid-input`)
    if (!report.source?.sha || report.source.sha !== report.sourceEnd?.sha || report.source.dirty !== false || report.sourceEnd.dirty !== false) {
      failures.push(`${label}:unstable-source`)
    }
    if (!Number.isFinite(report.printReadyMs) || report.printReadyMs <= 0) failures.push(`${label}:invalid-timing`)
    if (!Array.isArray(report.snapshotApi) || report.snapshotApi.length !== 4 || report.snapshotApi.some((entry) => entry.status !== 200) ||
        ['before', 'after'].some((phase) => hash(report.snapshotApi.filter((entry) => entry.phase === phase).map((entry) => entry.id)) !== hash(report.ids))) {
      failures.push(`${label}:invalid-snapshot-api`)
    }
    if (!Array.isArray(report.errors) || report.errors.length) failures.push(`${label}:page-errors`)
    if (!Array.isArray(report.api) || report.api.some((entry) => entry.failure || !Number.isInteger(entry.status) || entry.status >= 400)) failures.push(`${label}:invalid-api-evidence`)
    if (!Array.isArray(report.requests) || !report.requests.length) failures.push(`${label}:missing-network-evidence`)
    else if (report.requests.some((request) => request.failure || !Number.isInteger(request.status) || request.status >= 400)) failures.push(`${label}:network-errors`)
    else if (report.requests.some((request) => request.sizeError || (request.networkState && request.networkState !== 'complete') ||
      !['content-length', 'resource-timing'].includes(request.byteSource) || !Number.isSafeInteger(request.encodedBodyBytes) ||
      request.encodedBodyBytes < 0 || (request.encodedBodyBytes === 0 && request.byteSource !== 'content-length'))) failures.push(`${label}:missing-byte-evidence`)
    if (!Array.isArray(report.images) || !report.images.length || report.images.some((image) => image.complete !== true ||
      !Number.isFinite(image.naturalWidth) || !Number.isFinite(image.naturalHeight) || image.naturalWidth <= 0 || image.naturalHeight <= 0)) {
      failures.push(`${label}:broken-images`)
    }
    const expected = report.expectedGallery
    const gallery = report.galleryImages
    if (report.settings?.includeGallery !== true || !Array.isArray(expected) || !Array.isArray(gallery) ||
        !Array.isArray(report.ids) || report.ids.some((id) => !expected.some((photo) => photo.travelId === id)) ||
        gallery.length !== expected.length ||
        gallery.some((image) => image.complete !== true || !Number.isFinite(image.naturalWidth) || !Number.isFinite(image.naturalHeight) ||
          image.naturalWidth <= 0 || image.naturalHeight <= 0 || typeof image.objectFit !== 'string' || !image.objectFit ||
          !Number.isFinite(image.width) || !Number.isFinite(image.height) || image.width <= 0 || image.height <= 0) ||
        hash(expected.map((photo) => photo.asset).sort()) !== hash(gallery.map((image) => image.asset).sort())) {
      failures.push(`${label}:invalid-gallery-coverage`)
    }
  }
  if (Array.isArray(before.galleryImages) && Array.isArray(after.galleryImages) &&
      (before.galleryImages.length !== after.galleryImages.length || before.galleryImages.some((image, index) => {
        const next = after.galleryImages[index]
        return !next || image.asset !== next.asset || image.naturalWidth !== next.naturalWidth || image.naturalHeight !== next.naturalHeight ||
          image.objectFit !== next.objectFit || Math.abs(image.width - next.width) > 1 || Math.abs(image.height - next.height) > 1
      }))) failures.push('regression:gallery-output')
  const count = (report, printOnly) => (report.requests || []).filter((request) => request.type === 'image' && (!printOnly || request.phase === 'print')).length
  const bytes = (report, predicate = () => true) => (report.requests || []).filter(predicate).reduce((sum, request) => sum + (request.encodedBodyBytes || 0), 0)
  const apiCount = (report) => (report.requests || []).filter((request) => /^https:\/\/metravel\.by\/api\//.test(request.url)).length + (report.snapshotApi || []).length
  for (const printOnly of [false, true]) {
    if (count(after, printOnly) > count(before, printOnly)) failures.push(printOnly ? 'regression:print-image-count' : 'regression:page-image-count')
    if (bytes(after, (request) => request.type === 'image' && (!printOnly || request.phase === 'print')) >
        bytes(before, (request) => request.type === 'image' && (!printOnly || request.phase === 'print'))) failures.push(printOnly ? 'regression:print-image-bytes' : 'regression:page-image-bytes')
  }
  if (bytes(after) > bytes(before)) failures.push('regression:page-encoded-bytes')
  if (apiCount(after) > apiCount(before)) failures.push('regression:api-count')
  const allowedIncreaseMs = Math.max(noiseMs, before.printReadyMs * noiseRatio)
  if (after.printReadyMs > before.printReadyMs + allowedIncreaseMs) failures.push('regression:print-ready-time')
  return {
    pass: failures.length === 0, failures,
    printReadyMs: { before: before.printReadyMs, after: after.printReadyMs, delta: after.printReadyMs - before.printReadyMs, allowedIncreaseMs },
    images: { pageBefore: count(before, false), pageAfter: count(after, false), printBefore: count(before, true), printAfter: count(after, true) },
    encodedBytes: { pageBefore: bytes(before), pageAfter: bytes(after), allowedIncrease: 0 },
    api: { before: apiCount(before), after: apiCount(after), allowedIncrease: 0 },
    qualification: 'Observed current production runs; timing tolerance is noise budget, not evidence of historical speedup.',
  }
}

async function run(options) {
  // Lazy import keeps the pure comparator usable without starting Playwright.
  const { openProdProbe, captureRequests, buildSource, formatProbeError } = require('../e2e/prod-probe/prodProbe')
  if (fs.existsSync(options.output)) throw new Error('Output already exists; preserve the previous evidence with a new filename')
  fs.mkdirSync(path.dirname(options.output), { recursive: true })
  if (!fs.realpathSync(path.dirname(options.output)).startsWith(`${fs.realpathSync(path.join(ROOT, '.codex-temp'))}${path.sep}`) &&
      fs.realpathSync(path.dirname(options.output)) !== fs.realpathSync(path.join(ROOT, '.codex-temp'))) throw new Error('Output directory escapes .codex-temp through a symlink')
  const lock = path.join(ROOT, '.codex-temp', 'ops', 'pdf-export-web.lock')
  fs.mkdirSync(path.dirname(lock), { recursive: true })
  fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), scope: '#2232 production PDF benchmark' }), { flag: 'wx', mode: 0o600 })
  let probe, book, network
  let stage = 'source'
  const progressPath = options.output.replace(/\.json$/, '.progress.json')
  const advance = (next) => {
    stage = next
    fs.writeFileSync(progressPath, JSON.stringify({ pid: process.pid, stage, updatedAt: new Date().toISOString(), pendingRequests: network?.pending() || [] }, null, 2), { mode: 0o600 })
  }
  try {
    advance('source')
    const source = await buildSource()
    if (!source.sha || source.dirty !== false) throw new Error('Production source must have a SHA and dirty=false')
    advance('account-and-snapshots')
    probe = await openProdProbe({ viewport: VIEWPORT, contextOptions: { deviceScaleFactor: 1, serviceWorkers: 'block' } })
    if (probe.userId !== '104') throw new Error('Probe must use account 104')
    // A fresh isolated context starts without an HTTP cache. Restore only the
    // authenticated cookies/storage; let real catalog/print requests run freely.
    // Routing every request can stall document.write at external head styles.
    const snapshots = []
    const snapshotApi = []
    for (const id of options.ids) {
      const response = await probe.context.request.get(`${PROD}/api/travels/${id}/`)
      snapshotApi.push({ id, phase: 'before', status: response.status() })
      if (response.status() !== 200) throw new Error(`Travel ${id}: HTTP ${response.status()}`)
      const travel = await response.json()
      if (String(travel.id) !== id || String(travel.user?.id) !== '104' || !Array.isArray(travel.gallery) || !travel.gallery.length) throw new Error(`Travel ${id} must belong to account 104 and have a nonempty gallery`)
      snapshots.push(travel)
    }
    const errors = [], captures = []
    let phase = 'page'
    network = captureNetwork(probe.context, () => phase, formatProbeError)
    const requests = network.requests
    const observe = (page) => {
      page.on('pageerror', (error) => errors.push(formatProbeError(error)))
      captures.push(captureRequests(page, '/api/travels/'))
    }
    observe(probe.page)
    probe.context.on('page', observe)
    advance('catalog')
    await probe.goto('/export')
    advance('selection')
    for (const travel of snapshots) {
      const card = probe.page.getByTestId(`travel-card-selectable-${String(travel.slug || travel.id)}`)
      await card.getByTestId('selection-checkbox').click()
    }
    // UnifiedTravelCard strips checkbox semantics from its outer visual shell;
    // selection belongs to the actual nested selection-checkbox control.
    const selectedCardTestIds = await probe.page.getByTestId('selection-checkbox').evaluateAll((nodes) =>
      nodes.filter((node) => node.getAttribute('aria-checked') === 'true')
        .map((node) => node.closest('[data-testid^="travel-card-selectable-"]')?.getAttribute('data-testid') || null),
    )
    assertSelection(selectedCardTestIds, snapshots.map((travel) => `travel-card-selectable-${String(travel.slug || travel.id)}`))
    advance('settings')
    await probe.page.getByRole('button', { name: /^Настройки(?: экспорта)?$/ }).click()
    const save = probe.page.getByRole('dialog').getByRole('button', { name: 'Сохранить и создать PDF', exact: true })
    const popup = probe.page.waitForEvent('popup', { timeout: 120_000 })
    phase = 'print'
    const started = performance.now()
    advance('save')
    await save.click()
    book = await popup
    advance('print-ready')
    await book.locator('.pdf-page.final-page').waitFor({ timeout: 120_000 })
    const printReadyMs = performance.now() - started
    advance('image-health')
    await book.waitForFunction(() => Array.from(document.images).every((image) => image.complete), null, { timeout: 60_000 })
    advance('network-completion')
    await network.waitForCompletion()
    network.stop()
    const settings = await probe.page.evaluate(() => JSON.parse(localStorage.getItem('metravel_pdf_settings') || 'null'))
    if (!settings) throw new Error('The actual saved book settings were not recorded')
    const images = await book.locator('img').evaluateAll((nodes) => nodes.map((image) => ({
      src: image.currentSrc || image.src, complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
      width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height,
    })))
    for (const image of images) image.src = safeUrl(image.src)
    // Each photo has a blurred aria-hidden background copy. Only the foreground
    // image proves actual gallery coverage; covers and TOC thumbnails do not.
    const galleryImages = await book.locator('.gallery-page .gallery-photo-frame img:not([aria-hidden="true"])').evaluateAll((nodes) => nodes.map((image) => ({
      src: image.currentSrc || image.src, complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
      width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height, objectFit: getComputedStyle(image).objectFit,
    })))
    for (const image of galleryImages) {
      image.asset = galleryAsset(image.src)
      image.src = safeUrl(image.src)
    }
    // Re-read the same API inputs: changing content during generation cannot be
    // silently compared with a different book. View counters are not hashed.
    advance('snapshot-validation')
    for (let i = 0; i < options.ids.length; i++) {
      const response = await probe.context.request.get(`${PROD}/api/travels/${options.ids[i]}/`)
      snapshotApi.push({ id: options.ids[i], phase: 'after', status: response.status() })
      if (response.status() !== 200 || hash(bookInput(await response.json())) !== hash(bookInput(snapshots[i]))) throw new Error('Book input changed during the probe')
    }
    const sourceEnd = await buildSource()
    if (source.sha !== sourceEnd.sha || sourceEnd.dirty !== false) throw new Error('Production source changed during the probe')
    const report = {
      schema: 1, mode: 'desktop-two-travel', byteMetric: BYTE_METRIC, label: options.label, recordedAt: new Date().toISOString(),
      accountId: probe.userId, ids: options.ids, selectedCardTestIds, inputHash: hash(snapshots.map(bookInput)),
      settings, expectedGallery: expectedGallery(snapshots), galleryImages,
      viewport: VIEWPORT, browser: probe.browser.version(), dpr: await probe.page.evaluate(() => devicePixelRatio),
      cache: 'fresh-isolated-context-initially-empty-http-cache-serviceworkers-blocked', url: `${PROD}/export`,
      source, sourceEnd, printReadyMs, timingDefinition: 'Save click to the actual .pdf-page.final-page in the print popup; image health is awaited separately',
      snapshotApi, api: captures.flatMap((capture) => capture.summary()), requests, images, errors,
      timingNoiseBudget: { noiseMs: options.noiseMs, noiseRatio: options.noiseRatio },
    }
    if (options.compare) report.comparison = compareReports(JSON.parse(fs.readFileSync(options.compare, 'utf8')), report, options)
    advance('persisted')
    fs.writeFileSync(options.output, JSON.stringify(report, null, 2), { flag: 'wx', mode: 0o600 })
    await book.screenshot({ path: options.output.replace(/\.json$/, '.book.png'), fullPage: true })
    fs.writeFileSync(options.output.replace(/\.json$/, '.book.html'), await book.content(), { flag: 'wx', mode: 0o600 })
    const health = compareReports({ ...report, label: 'before' }, { ...report, label: 'after' }, options)
    if (!health.pass || report.comparison?.pass === false) throw new Error(`Benchmark evidence failed: ${[...health.failures, ...(report.comparison?.failures || [])].join(', ')}`)
    return { output: path.relative(ROOT, options.output), sha: source.sha, printReadyMs, comparison: report.comparison || null }
  } catch (error) {
    // Keep the failing phase and even a head-only pending document. A timeout
    // is never a benchmark receipt; these files are explicitly failure evidence.
    const failureBase = options.output.replace(/\.json$/, `.failure-${Date.now()}`)
    advance(stage)
    fs.writeFileSync(`${failureBase}.json`, JSON.stringify({ stage, error: formatProbeError(error), pendingRequests: network?.pending() || [], requests: network?.requests || [] }, null, 2), { flag: 'wx', mode: 0o600 })
    if (book && !book.isClosed()) {
      try { fs.writeFileSync(`${failureBase}.html`, await book.content(), { flag: 'wx', mode: 0o600 }) } catch { /* retain the phase receipt */ }
    }
    throw error
  } finally {
    network?.stop()
    try { await probe?.close() } finally { fs.unlinkSync(lock) }
  }
}

if (require.main === module) {
  ;(async () => {
    try { console.log(JSON.stringify(await run(parseArgs(process.argv.slice(2))))) }
    catch (error) {
      const { formatProbeError } = require('../e2e/prod-probe/prodProbe')
      console.error(formatProbeError(error))
      process.exitCode = 1
    }
  })()
}

module.exports = { BYTE_METRIC, bookInput, hash, assertSelection, galleryAsset, expectedGallery, captureNetwork, outputPath, parseArgs, compareReports, run }
