#!/usr/bin/env node
'use strict'

// Actual Expo SSR memory gate on a local fixture API. Each concurrency runs in
// a fresh Node process capped at 384 MiB. GC/snapshot control uses private IPC,
// never publicly reachable diagnostic HTTP endpoints.
// node scripts/ssr-memory-probe.cjs --build dist/ssr --api http://127.0.0.1:8097 \
//   --paths .codex-temp/ssr/paths.txt [--requests 5000 --concurrency 1,4 --snapshots]
// Fixture API must expose GET /__stats with {travelRequests: number}: article
// fetches only. A total of all API calls also counts per-page side requests
// (quest discovery) and cannot prove one article fetch per render.
const fs = require('node:fs')
const path = require('node:path')
const { fork } = require('node:child_process')
const { once } = require('node:events')
const { htmlToPlainText } = require('../utils/seoText')

const MIB = 1024 * 1024

function positiveInteger(value, name) {
  const result = Number(value)
  if (!Number.isSafeInteger(result) || result < 1) throw new Error(`${name} must be a positive integer`)
  return result
}

function parseOptions(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i]
    if (key === '--snapshots') args.snapshots = true
    else if (['--build', '--api', '--paths', '--requests', '--warmup', '--concurrency', '--max-drift-mib'].includes(key)) {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`Missing value for ${key}`)
      args[key.slice(2)] = argv[++i]
    } else throw new Error(`Unknown option: ${key}`)
  }
  if (!args.build || !args.api || !args.paths) throw new Error('--build, --api and --paths are required')
  const api = new URL(args.api)
  if (api.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(api.hostname)
      || api.username || api.password || api.search || api.hash || !/^\/(?:api\/?)?$/.test(api.pathname)) {
    throw new Error('--api must be a loopback HTTP fixture API, never production')
  }
  const build = path.resolve(args.build)
  if (!fs.existsSync(path.join(build, 'server', '_expo', 'routes.json'))) {
    throw new Error('--build must contain an Expo output:server export')
  }
  const paths = fs.readFileSync(args.paths, 'utf8').trim().split(/\r?\n/).filter(Boolean)
  if (!paths.length || paths.some((route) => !route.startsWith('/') || route.startsWith('//') || /[\r\n\\#]/.test(route))) {
    throw new Error('--paths must contain local absolute URL paths, one per line')
  }
  const requests = positiveInteger(args.requests ?? 5000, '--requests')
  const warmup = positiveInteger(args.warmup ?? 400, '--warmup')
  if (requests <= warmup) throw new Error('--requests must exceed --warmup')
  return {
    build, api: api.href.replace(/\/$/, ''), paths, requests, warmup,
    concurrencies: String(args.concurrency ?? '1,4').split(',').map((v) => positiveInteger(v, '--concurrency')),
    maxDrift: positiveInteger(args['max-drift-mib'] ?? 30, '--max-drift-mib') * MIB,
    snapshots: Boolean(args.snapshots),
  }
}

async function serve(build) {
  const { createSsrServer } = require('./serve-web-ssr')
  const server = createSsrServer({ buildDir: build })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  process.on('message', async (message) => {
    if (message?.type !== 'measure') return
    await new Promise(setImmediate)
    global.gc()
    await new Promise(setImmediate)
    global.gc()
    const heapUsed = process.memoryUsage().heapUsed
    const timers = process.getActiveResourcesInfo().filter((type) => type === 'Timeout').length
    const snapshot = message.snapshot ? require('node:v8').writeHeapSnapshot(message.snapshot) : undefined
    process.send({ type: 'measure', id: message.id, heapUsed, timers, snapshot })
  })
  process.send({ type: 'ready', port: server.address().port })
}

function receive(child, expected, send) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error(`SSR child did not respond: ${expected}`)), 30_000)
    const finish = (error, value) => {
      clearTimeout(timer)
      child.off('message', onMessage)
      child.off('exit', onExit)
      child.off('error', onError)
      if (error) reject(error)
      else resolve(value)
    }
    const onMessage = (value) => { if (value?.type === expected) finish(null, value) }
    const onExit = (code, signal) => finish(new Error(`SSR child exited (${code ?? signal})`))
    const onError = (error) => finish(error)
    child.on('message', onMessage)
    child.once('exit', onExit)
    child.once('error', onError)
    send?.()
  })
}

function bodyWords(html) {
  return new Set(htmlToPlainText(html).toLocaleLowerCase('ru').match(/[\p{L}\p{N}]+/gu) ?? [])
}

function assertArticleHtml(html, expected, route) {
  const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/gi)]
    .map((match) => htmlToPlainText(match[1]))
  const body = bodyWords(html)
  const covered = [...expected.words].filter((word) => body.has(word)).length
  if (!html.includes('</html>') || !headings.includes(expected.name)
      || !/data-seo-jsonld=["']travel-article["']/.test(html)
      || !/data-ssr-html-island=["']description["']/.test(html)
      || !expected.words.size || covered / expected.words.size < 0.9) {
    throw new Error(`SSR article content missing or mismatched for ${route}`)
  }
}

async function readExpectations(options) {
  const expectations = new Map()
  const apiRoot = /\/api$/.test(options.api) ? options.api : `${options.api}/api`
  for (const route of new Set(options.paths)) {
    const match = new URL(route, 'http://localhost').pathname.match(/^\/travels\/([^/]+)\/?$/)
    if (!match) throw new Error(`SSR memory probe requires travel article routes: ${route}`)
    const segment = decodeURIComponent(match[1])
    const endpoint = /^\d+$/.test(segment) ? `${segment}/` : `by-slug/${encodeURIComponent(segment)}/`
    const response = await fetch(`${apiRoot}/travels/${endpoint}`, { signal: AbortSignal.timeout(10_000), redirect: 'error' })
    if (!response.ok) throw new Error(`Fixture article is unavailable for ${route}: ${response.status}`)
    const travel = await response.json()
    const words = bodyWords(travel?.rich_text?.description?.safe_html || travel?.description)
    if (typeof travel?.name !== 'string' || !travel.name.trim() || !words.size) {
      throw new Error(`Fixture article needs a name and nonempty body: ${route}`)
    }
    expectations.set(route, { name: htmlToPlainText(travel.name), words })
  }
  return expectations
}

async function readApiCount(api) {
  const response = await fetch(new URL('/__stats', api), { signal: AbortSignal.timeout(10_000), redirect: 'error' })
  if (!response.ok) throw new Error('Fixture API must expose /__stats for independent request counting')
  const stats = await response.json()
  if (Number.isSafeInteger(stats.travelRequests) && stats.travelRequests >= 0) return stats.travelRequests
  throw new Error('Fixture /__stats needs a travelRequests counter')
}

function fixtureEnvironment(api) {
  const env = { ...process.env }
  // Pin server transport to the fixture. An immutable packaged artifact still
  // owns its compiled public config; SSR_API_ORIGIN always wins for API fetches.
  delete env.SPIKE_LOADER_API
  env.SSR_API_ORIGIN = api
  env.EXPO_PUBLIC_API_URL = api
  env.EXPO_PUBLIC_WEB_RUNTIME_SSR = 'true'
  env.METRAVEL_WEB_OUTPUT = 'server'
  return env
}

async function load(base, paths, expectations, start, count, concurrency) {
  let next = 0
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < count) {
      const index = start + next++
      const route = paths[index % paths.length]
      const response = await fetch(base + route, { signal: AbortSignal.timeout(30_000), redirect: 'error' })
      const html = await response.text()
      if (!response.ok) throw new Error(`Invalid SSR response for ${route}: ${response.status}`)
      assertArticleHtml(html, expectations.get(route), route)
    }
  }))
}

async function runProbe(options) {
  const output = path.resolve('.codex-temp', 'ssr-memory-probe', new Date().toISOString().replace(/[:.]/g, '-'))
  fs.mkdirSync(output, { recursive: true })
  const expectations = await readExpectations(options)
  const results = []
  for (const concurrency of options.concurrencies) {
    const child = fork(__filename, ['--serve', options.build], {
      execArgv: ['--expose-gc', '--max-old-space-size=384'],
      env: fixtureEnvironment(options.api),
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
    })
    const interrupt = () => { child.kill('SIGTERM'); process.exit(130) }
    const terminate = () => { child.kill('SIGTERM'); process.exit(143) }
    process.once('SIGINT', interrupt)
    process.once('SIGTERM', terminate)
    try {
      const { port } = await receive(child, 'ready')
      const base = `http://127.0.0.1:${port}`
      const apiBaseline = await readApiCount(options.api)
      await load(base, options.paths, expectations, 0, options.warmup, concurrency)
      const measure = (stage) => receive(child, 'measure', () => child.send({
        type: 'measure',
        snapshot: options.snapshots ? path.join(output, `c${concurrency}-${stage}.heapsnapshot`) : undefined,
      }))
      const baseline = await measure('baseline')
      await load(base, options.paths, expectations, options.warmup, options.requests - options.warmup, concurrency)
      const final = await measure('final')
      const apiFinal = await readApiCount(options.api)
      const apiRequests = apiFinal - apiBaseline
      const drift = final.heapUsed - baseline.heapUsed
      const result = {
        concurrency, requests: options.requests, warmup: options.warmup,
        baselineMiB: +(baseline.heapUsed / MIB).toFixed(2),
        finalMiB: +(final.heapUsed / MIB).toFixed(2),
        driftMiB: +(drift / MIB).toFixed(2),
        baselineTimers: baseline.timers, finalTimers: final.timers,
        apiRequests,
        pass: drift <= options.maxDrift && apiRequests === options.requests,
      }
      results.push(result)
      fs.writeFileSync(path.join(output, `c${concurrency}.json`), JSON.stringify(result, null, 2) + '\n')
      console.log(JSON.stringify(result))
    } finally {
      child.kill('SIGTERM')
      process.off('SIGINT', interrupt)
      process.off('SIGTERM', terminate)
    }
  }
  if (results.some((result) => !result.pass)) throw new Error(`SSR memory or fixture request-count gate failed; evidence: ${output}`)
  console.log(`SSR memory gate passed; evidence: ${output}`)
  return results
}

if (require.main === module) {
  const operation = process.argv[2] === '--serve' ? serve(path.resolve(process.argv[3])) : Promise.resolve().then(async () => {
    const options = parseOptions(process.argv.slice(2))
    const { acquireQualityGateLock, releaseQualityGateLock, isQualityGateBusyError, formatQualityGateSkipMessage } = require('./quality-gate-lock')
    try {
      acquireQualityGateLock({ name: 'ssr-memory-probe' })
    } catch (error) {
      if (!isQualityGateBusyError(error)) throw error
      console.log(formatQualityGateSkipMessage(error))
      return
    }
    process.once('exit', releaseQualityGateLock)
    try { await runProbe(options) } finally { releaseQualityGateLock() }
  })
  operation.catch((error) => { console.error(error.message); process.exitCode = 1 })
}

module.exports = { parseOptions, runProbe, assertArticleHtml, fixtureEnvironment }
