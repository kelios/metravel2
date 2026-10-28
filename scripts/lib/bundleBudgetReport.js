'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execFileSync } = require('child_process')
const { resolveLockRoot } = require('../build-lock')

const MAX_REPORT_BYTES = 8 * 1024 * 1024
const MAX_REPORTS = 20
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const REPORT_NAME = /^bundle-budget-v1-[0-9a-f]{40}-\d{8}T\d{9}Z-[0-9a-f]{16}\.json$/
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex')
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const integer = (value) => Number.isSafeInteger(value) && value >= 0

function fingerprintFile(file, label, errors) {
  try {
    return fs.existsSync(file) ? hash(fs.readFileSync(file)) : null
  } catch {
    errors.push(`${label} fingerprint unavailable`)
    return null
  }
}

function reportIdentity(root, budgetPath) {
  const errors = []
  let sha = null
  let dirty = null
  try {
    const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    sha = git(['rev-parse', 'HEAD'])
    dirty = Boolean(git(['status', '--porcelain']))
  } catch {
    errors.push('Source identity unavailable')
  }
  const version = (name) => {
    try { return require(require.resolve(`${name}/package.json`, { paths: [root] })).version } catch { return null }
  }
  const versions = {
    node: process.versions.node,
    expo: version('expo'),
    metro: version('metro'),
    zlib: process.versions.zlib || null,
    brotli: process.versions.brotli || null,
  }
  const lockfile = { name: 'yarn.lock', fingerprint: fingerprintFile(path.join(root, 'yarn.lock'), 'Lockfile', errors) }
  return {
    schema_version: 1,
    sha,
    dirty,
    generated_at: new Date().toISOString(),
    config: { fingerprint: fingerprintFile(budgetPath, 'Configuration', errors) },
    toolchain: { versions, lockfile, fingerprint: hash(JSON.stringify({ versions, lockfile })) },
    measurement_status: 'unavailable',
    measurements: null,
    verdict: 'error',
    breaches: [],
    errors,
  }
}

function validateReport(value) {
  const invalid = (label) => { throw new Error(`Invalid bundle budget report: ${label}`) }
  if (!record(value) || value.schema_version !== 1) invalid('unsupported schema_version')
  if (value.sha !== null && !/^[0-9a-f]{40}$/.test(value.sha)) invalid('sha')
  if (value.dirty !== null && typeof value.dirty !== 'boolean') invalid('dirty')
  if (typeof value.generated_at !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.generated_at) || !Number.isFinite(Date.parse(value.generated_at))) invalid('generated_at')
  const fingerprint = (item) => item === null || (typeof item === 'string' && /^[0-9a-f]{64}$/.test(item))
  if (!record(value.config) || !fingerprint(value.config.fingerprint)) invalid('config')
  if (!record(value.toolchain) || !record(value.toolchain.versions) || !record(value.toolchain.lockfile) || !fingerprint(value.toolchain.fingerprint) || !fingerprint(value.toolchain.lockfile.fingerprint)) invalid('toolchain')
  for (const name of ['node', 'expo', 'metro', 'zlib', 'brotli']) {
    if (!(value.toolchain.versions[name] === null || typeof value.toolchain.versions[name] === 'string')) invalid(`toolchain.${name}`)
  }
  if (!['pass', 'fail', 'error'].includes(value.verdict)) invalid('verdict')
  if (!['complete', 'incomplete', 'unavailable'].includes(value.measurement_status)) invalid('measurement_status')
  if (!Array.isArray(value.errors) || value.errors.some((item) => typeof item !== 'string')) invalid('errors')
  if (!Array.isArray(value.breaches)) invalid('breaches')
  for (const breach of value.breaches) {
    if (!record(breach) || typeof breach.label !== 'string' || !['bytes', 'count', 'unavailable'].includes(breach.unit)) invalid('breach')
    if (!(breach.actual === null || integer(breach.actual)) || !(breach.limit === null || integer(breach.limit))) invalid('breach actual/limit')
    if (breach.unit !== 'unavailable' && (breach.actual === null || breach.limit === null)) invalid('breach measurement')
    if (breach.basis !== undefined && !['html_scripts_with_loader_metadata', 'configured_chunks_without_loader_metadata'].includes(breach.basis)) invalid('breach basis')
  }
  if (value.verdict === 'pass' && (value.breaches.length || value.measurement_status !== 'complete' || value.sha === null || value.dirty === null)) invalid('pass without complete evidence')
  if (value.measurements === null) {
    if (value.measurement_status !== 'unavailable' || value.verdict !== 'error') invalid('unavailable measurements')
    return value
  }
  if (value.measurement_status === 'unavailable') invalid('unavailable measurements')
  const sizes = (item, label, nullable = false) => {
    if (!record(item)) invalid(label)
    for (const metric of ['raw', 'gzip', 'brotli']) {
      if (!(integer(item[metric]) || (nullable && item[metric] === null))) invalid(`${label}.${metric}`)
    }
  }
  const measurements = value.measurements
  if (!record(measurements)) invalid('measurements')
  for (const key of ['total', 'all', 'deferred']) sizes(measurements[key], key)
  for (const key of ['files', 'named']) {
    if (!record(measurements[key])) invalid(key)
    for (const [name, item] of Object.entries(measurements[key])) {
      sizes(item, `${key}.${name}`)
      if (key === 'named') {
        if (!record(item.files)) invalid(`named.${name}.files`)
        for (const [file, size] of Object.entries(item.files)) sizes(size, `named.${name}.${file}`)
      }
    }
  }
  const eager = measurements.eager
  if (!record(eager) || !['complete', 'incomplete', 'not_configured'].includes(eager.status)) invalid('eager.status')
  if (!['html_routes', 'configured_chunks', 'not_configured'].includes(eager.source)) invalid('eager.source')
  if ((eager.status === 'not_configured') !== (eager.source === 'not_configured')) invalid('eager configuration status')
  sizes(eager, 'eager', eager.status !== 'complete')
  if (eager.status !== 'complete' && ['raw', 'gzip', 'brotli'].some((metric) => eager[metric] !== null)) invalid('unavailable eager bytes')
  if (eager.status === 'incomplete' && value.measurement_status !== 'incomplete') invalid('incomplete eager status')
  for (const key of ['route', 'requests_route']) if (!(eager[key] === null || typeof eager[key] === 'string')) invalid(`eager.${key}`)
  if (!(eager.requests === null || integer(eager.requests)) || !record(eager.requests_by_route) || !record(eager.payload_routes)) invalid('eager counts')
  for (const item of Object.values(eager.requests_by_route)) {
    if (!record(item) || !integer(item.requests) || !(item.limit === null || integer(item.limit)) || !Array.isArray(item.missing_files) || item.missing_files.some((name) => typeof name !== 'string')) invalid('route requests')
  }
  for (const item of Object.values(eager.payload_routes)) {
    if (!record(item) || !(item.routes === null || integer(item.routes)) || !(item.total === null || integer(item.total))) invalid('payload routes')
  }
  return value
}

function readReport(file) {
  if (fs.statSync(file).size > MAX_REPORT_BYTES) throw new Error(`Bundle budget report exceeds ${MAX_REPORT_BYTES} bytes: ${file}`)
  return validateReport(JSON.parse(fs.readFileSync(file, 'utf8')))
}

function pruneReports(directory, now = Date.now()) {
  const reports = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !REPORT_NAME.test(entry.name)) continue
    const file = path.join(directory, entry.name)
    let report
    try { report = readReport(file) } catch { continue }
    const time = Date.parse(report.generated_at)
    if (now - time > MAX_AGE_MS) fs.unlinkSync(file)
    else reports.push({ file, time })
  }
  reports.sort((a, b) => b.time - a.time || b.file.localeCompare(a.file))
  for (const report of reports.slice(MAX_REPORTS)) fs.unlinkSync(report.file)
}

function persistReport(report, directory) {
  validateReport(report)
  const content = `${JSON.stringify(report, null, 2)}\n`
  if (Buffer.byteLength(content) > MAX_REPORT_BYTES) throw new Error(`Bundle budget report exceeds ${MAX_REPORT_BYTES} bytes; no truncated report written`)
  // Missing Git identity is explicit in JSON, but cannot masquerade as a normal archive name.
  const sha = report.sha || '0'.repeat(40)
  const timestamp = report.generated_at.replace(/[-:.]/g, '')
  const nonce = crypto.randomBytes(8).toString('hex')
  fs.mkdirSync(directory, { recursive: true })
  const target = path.join(directory, `bundle-budget-v1-${sha}-${timestamp}-${nonce}.json`)
  const temporary = `${target}.tmp`
  try {
    fs.writeFileSync(temporary, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
    fs.renameSync(temporary, target)
  } finally {
    fs.rmSync(temporary, { force: true })
  }
  pruneReports(directory)
  return target
}

function createReportContext({ root, budgetPath, persist }) {
  const report = reportIdentity(root, budgetPath)
  if (persist) {
    process.on('uncaughtExceptionMonitor', (error) => {
      report.errors.push(error.message)
      report.verdict = 'error'
    })
    process.on('exit', () => {
      if (report.measurements === null && !report.errors.length) report.errors.push('Guard exited before measurements completed')
      try {
        const directory = process.env.BUNDLE_BUDGET_REPORT_DIR || path.join(resolveLockRoot(root), '.codex-temp', 'deploy')
        console.error(`📊 Bundle budget report: ${persistReport(report, directory)}`)
      } catch (error) {
        console.error(`❌ Bundle budget diagnostics: ${error.message}`)
      }
    })
  }
  return report
}

// check() compares rounded 0.1 KiB. This is its largest passing integer byte count.
function roundedByteLimit(limitKB) {
  return Math.ceil((Math.round(limitKB * 10) + 0.5) * 102.4) - 1
}

module.exports = { MAX_REPORT_BYTES, MAX_REPORTS, MAX_AGE_MS, createReportContext, roundedByteLimit, validateReport, readReport, persistReport, pruneReports }
