'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { gunzipSync } = require('node:zlib')
const { TextDecoder } = require('node:util')
const { APP_STORE_APP_ID, ANDROID_APP_PACKAGE } = require('../../constants/appIdentity')

const DEFAULT_REPORTS_DIR = path.resolve(__dirname, '../../.codex-temp/store-reports')
const MAX_FILE_BYTES = 16 * 1024 * 1024
const MAX_TEXT_BYTES = 64 * 1024 * 1024
const REPORT_CALENDAR = 'America/Los_Angeles'
const SOURCES = {
  'apple-sales-summary': ['firstTimeDownloads', 'redownloads'],
  'google-play-installs': ['deviceInstalls', 'userInstalls'],
}
const APPLE_EXCLUDED_TYPES = new Set(['7', '7F', '7T', 'F7', 'FI1', 'IA1', 'IA1-M', 'IA3', 'IA9', 'IA9-M', 'IAY', 'IAY-M'])
const DIAGNOSTICS = {
  MISSING_REPORT: 'официальная выгрузка не получена',
  INVALID_MANIFEST: 'неподдерживаемый manifest.json',
  INVALID_ENTRY: 'неподдерживаемое описание выгрузки',
  UNSAFE_PATH: 'файл выходит за границы каталога отчётов',
  FILE_UNAVAILABLE: 'файл выгрузки недоступен',
  SIZE_LIMIT: 'превышен предел размера выгрузки',
  INVALID_FORMAT: 'неподдерживаемый формат, кодировка или схема выгрузки',
  INVALID_DATE: 'даты выгрузки не соответствуют заявленному окну',
  INVALID_METRIC: 'счётчики некорректны или содержат отрицательные корректировки',
  APP_MISMATCH: 'не подтверждено нужное приложение',
  INCOMPLETE: 'полнота выгрузки не подтверждена',
  UNSUPPORTED_DIMENSION: 'нужен единственный разрез Country без общих итогов',
  DUPLICATE_ROW: 'повторяется строка выгрузки или пара Date/Country',
  OVERLAPPING_PERIOD: 'окна одного магазина пересекаются',
  UNSUPPORTED_CALENDAR: 'для официальных выгрузок нужен календарь America/Los_Angeles (PT)',
}
const fail = (code) => { throw Object.assign(new Error(code), { code }) }
const safeCode = (error) => Object.hasOwn(DIAGNOSTICS, error?.code) ? error.code : 'INVALID_FORMAT'
const emptyMetrics = (source) => Object.fromEntries(SOURCES[source].map((metric) => [metric, null]))
const zeroMetrics = (source) => Object.fromEntries(SOURCES[source].map((metric) => [metric, 0]))
const endOfMonth = (month) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10)
const nextDay = (day) => new Date(Date.parse(`${day}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)

function date(value, apple = false) {
  if (apple && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) value = `${value.slice(6)}-${value.slice(0, 2)}-${value.slice(3, 5)}`
  if (typeof value !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])-\d{2}$/.test(value)) fail('INVALID_DATE')
  const stamp = Date.parse(`${value}T00:00:00Z`)
  if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== value) fail('INVALID_DATE')
  return value
}

function readFile(root, file, limit = MAX_FILE_BYTES) {
  if (typeof file !== 'string' || !file || file.length > 240 || path.isAbsolute(file) || file.includes('\0')) fail('UNSAFE_PATH')
  const contained = (name) => {
    const relative = path.relative(root, name)
    return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
  }
  const requested = path.resolve(root, file)
  if (!contained(requested)) fail('UNSAFE_PATH')
  let fd
  try {
    const resolved = fs.realpathSync(requested)
    if (!contained(resolved)) fail('UNSAFE_PATH')
    if (!fs.statSync(resolved).isFile()) fail('INVALID_FORMAT')
    fd = fs.openSync(resolved, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW)
    const stat = fs.fstatSync(fd)
    if (!stat.isFile()) fail('INVALID_FORMAT')
    if (stat.size > limit) fail('SIZE_LIMIT')
    const buffer = Buffer.alloc(Math.min(stat.size + 1, limit + 1))
    const length = fs.readSync(fd, buffer, 0, buffer.length, 0)
    if (length > limit || length !== stat.size) fail('SIZE_LIMIT')
    return buffer.subarray(0, length)
  } catch (error) {
    if (Object.hasOwn(DIAGNOSTICS, error?.code)) throw error
    fail('FILE_UNAVAILABLE')
  } finally {
    if (fd !== undefined) fs.closeSync(fd)
  }
}

function decode(buffer, google, budget) {
  let bytes = buffer
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    try { bytes = gunzipSync(bytes, { maxOutputLength: MAX_TEXT_BYTES }) } catch (error) { fail(error.code === 'ERR_BUFFER_TOO_LARGE' ? 'SIZE_LIMIT' : 'INVALID_FORMAT') }
  }
  budget.bytes += bytes.length
  if (budget.bytes > MAX_TEXT_BYTES) fail('SIZE_LIMIT')
  let encoding = 'utf-8'
  if (google && bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le'
  if (google && bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be'
  let text
  try { text = new TextDecoder(encoding, { fatal: true }).decode(bytes) } catch { fail('INVALID_FORMAT') }
  if (text.includes('\0')) fail('INVALID_FORMAT')
  return text
}

// A small strict CSV/TSV reader: quoted commas, escaped quotes and CRLF are
// supported; malformed quotes and inconsistent columns fail closed.
function table(text, separator) {
  const rows = []
  let row = [], value = '', quoted = false, closed = false
  const field = () => { row.push(value); value = ''; closed = false; if (row.length > 128) fail('SIZE_LIMIT') }
  const record = () => { field(); if (row.some((v) => v !== '')) rows.push(row); row = []; if (rows.length > 200000) fail('SIZE_LIMIT') }
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { value += '"'; i++ }
      else if (char === '"') { quoted = false; closed = true }
      else value += char
    } else if (char === separator) field()
    else if (char === '\n' || char === '\r') { record(); if (char === '\r' && text[i + 1] === '\n') i++ }
    else if (char === '"' && !value && !closed) quoted = true
    else { if (closed || char === '"') fail('INVALID_FORMAT'); value += char }
  }
  if (quoted) fail('INVALID_FORMAT')
  if (value || row.length || closed) record()
  const headers = rows.shift()
  if (!headers?.length || new Set(headers).size !== headers.length || rows.some((r) => r.length !== headers.length)) fail('INVALID_FORMAT')
  return { headers, rows }
}

function count(value, apple = false) {
  if (!(apple ? /^\d+(?:\.0{1,2})?$/ : /^\d+$/).test(value) || !Number.isSafeInteger(Number(value))) fail('INVALID_METRIC')
  return Number(value)
}

function add(metrics, key, value) {
  metrics[key] += value
  if (!Number.isSafeInteger(metrics[key])) fail('INVALID_METRIC')
}

function parseReport(entry, buffer, budget) {
  const apple = entry.source === 'apple-sales-summary'
  const { headers, rows } = table(decode(buffer, !apple, budget), apple ? '\t' : ',')
  budget.rows += rows.length
  if (budget.rows > 200000) fail('SIZE_LIMIT')
  const required = apple ? ['Apple Identifier', 'Product Type Identifier', 'Units', 'Begin Date', 'End Date']
    : ['Date', 'Package Name', 'Country', 'Daily Device Installs', 'Daily User Installs']
  if (required.some((name) => !headers.includes(name))) fail('INVALID_FORMAT')
  if (!apple) {
    const allowed = [...required, 'Current Device Installs', 'Installs on active devices', 'Daily Device Uninstalls', 'Daily Device Upgrades', 'Current User Installs', 'Total User Installs', 'Daily User Uninstalls']
    if (headers.some((header) => !allowed.includes(header))) fail('UNSUPPORTED_DIMENSION')
  }
  const totals = zeroMetrics(entry.source), contributions = [], seen = new Set()
  let target = rows.length === 0 // A header-only complete export relies on the explicit manifest identity/coverage.
  for (const row of rows) {
    const get = (key) => row[headers.indexOf(key)]
    const from = date(get(apple ? 'Begin Date' : 'Date'), apple)
    const to = apple ? date(get('End Date'), true) : from
    if (from > to || from < entry.from || to > entry.to) fail('INVALID_DATE')
    if (apple && (from !== entry.from || to !== entry.to)) fail('INVALID_DATE') // Apple dates declare the complete report window, not a transaction day.
    if (apple && get('Apple Identifier') !== APP_STORE_APP_ID) continue // Portfolio exports include other apps and IAP identifiers.
    if (!apple && get('Package Name') !== ANDROID_APP_PACKAGE) fail('APP_MISMATCH')
    target = true
    const metrics = zeroMetrics(entry.source)
    if (apple) {
      const type = get('Product Type Identifier')
      const key = ['1', '1F', '1T'].includes(type) ? 'firstTimeDownloads' : ['3', '3F'].includes(type) ? 'redownloads' : null
      if (!key && !APPLE_EXCLUDED_TYPES.has(type)) fail('INVALID_FORMAT')
      const signature = JSON.stringify(row)
      if (seen.has(signature)) fail('DUPLICATE_ROW')
      seen.add(signature)
      if (key) metrics[key] = count(get('Units'), true)
    } else {
      const country = get('Country')
      if (!/^[A-Z]{2}$/.test(country)) fail('UNSUPPORTED_DIMENSION')
      const signature = `${from}/${country}`
      if (seen.has(signature)) fail('DUPLICATE_ROW')
      seen.add(signature)
      metrics.deviceInstalls = count(get('Daily Device Installs'))
      metrics.userInstalls = count(get('Daily User Installs'))
    }
    for (const key of SOURCES[entry.source]) add(totals, key, metrics[key])
    contributions.push({ from, to, metrics })
  }
  if (!target) fail('APP_MISMATCH')
  return { totals, contributions }
}

function metadata(raw) {
  if (!raw || !Object.hasOwn(SOURCES, raw.source)) fail('INVALID_ENTRY')
  const from = date(raw.from), to = date(raw.to)
  if (from > to) fail('INVALID_ENTRY')
  if (raw.calendar !== REPORT_CALENDAR) fail('UNSUPPORTED_CALENDAR')
  if (!['complete', 'partial'].includes(raw.coverage)) fail('INVALID_ENTRY')
  if (raw.source === 'apple-sales-summary' ? raw.appId !== APP_STORE_APP_ID : raw.packageName !== ANDROID_APP_PACKAGE) fail('APP_MISMATCH')
  if (raw.source === 'google-play-installs' && raw.dimension !== 'country') fail('UNSUPPORTED_DIMENSION')
  return { source: raw.source, from, to, calendar: raw.calendar, coverage: raw.coverage }
}

function monthlyTotals(records) {
  const monthly = {}
  for (const source of Object.keys(SOURCES)) {
    const valid = records.filter((r) => r.period.source === source && r.period.status === 'collected').sort((a, b) => a.period.from.localeCompare(b.period.from))
    const months = new Set(valid.flatMap((r) => r.contributions.flatMap((c) => [c.from.slice(0, 7), c.to.slice(0, 7)])))
    // Include measured-zero months as well, including header-only exports.
    for (const record of valid) {
      let day = record.period.from
      while (day <= record.period.to) { months.add(day.slice(0, 7)); day = nextDay(endOfMonth(day.slice(0, 7))) }
    }
    for (const month of months) {
      const start = `${month}-01`, end = endOfMonth(month)
      const covering = valid.filter((r) => r.period.from <= end && r.period.to >= start)
      let cursor = start
      for (const record of covering) {
        if (record.period.from > cursor) break
        if (record.period.to >= cursor) cursor = nextDay(record.period.to)
      }
      if (cursor <= end) continue
      const contributions = covering.flatMap((r) => r.contributions).filter((c) => c.from <= end && c.to >= start)
      if (contributions.some((c) => c.from < start || c.to > end)) continue // Summary rows cannot be split by guessing daily values.
      const metrics = zeroMetrics(source)
      for (const contribution of contributions) for (const key of SOURCES[source]) add(metrics, key, contribution.metrics[key])
      monthly[month] ||= {}
      monthly[month][source] = { metrics, calendar: covering[0].period.calendar, coverage: 'complete' }
    }
  }
  return monthly
}

function readStoreReports(directory = DEFAULT_REPORTS_DIR) {
  const gaps = [], records = [], sources = {}
  const issue = (source, code) => gaps.push(`${source}: ${DIAGNOSTICS[code]} (${code})`)
  let root, manifest
  try {
    root = fs.realpathSync(directory)
    if (!fs.statSync(root).isDirectory()) fail('INVALID_MANIFEST')
    const bytes = readFile(root, 'manifest.json', 256 * 1024)
    try { manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) } catch { fail('INVALID_MANIFEST') }
    if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.reports) || manifest.reports.length > 100) fail('INVALID_MANIFEST')
  } catch (error) {
    const code = error.code === 'ENOENT' ? 'MISSING_REPORT' : safeCode(error)
    for (const source of Object.keys(SOURCES)) { sources[source] = { status: 'unavailable', reason: code }; issue(source, code) }
    return { periods: [], monthly: {}, sources, gaps }
  }
  const budgets = Object.fromEntries(Object.keys(SOURCES).map((source) => [source, { bytes: 0, rows: 0 }]))
  for (const raw of manifest.reports) {
    const source = Object.hasOwn(SOURCES, raw?.source) ? raw.source : null
    try {
      const period = { ...metadata(raw), status: 'unavailable', metrics: emptyMetrics(source) }
      const record = { period, contributions: [] }
      records.push(record)
      try {
        if (period.coverage !== 'complete') fail('INCOMPLETE')
        const parsed = parseReport(period, readFile(root, raw.file), budgets[source])
        period.metrics = parsed.totals
        period.status = 'collected'
        record.contributions = parsed.contributions
      } catch (error) { period.reason = safeCode(error) }
    } catch (error) { issue(source || 'store reports', safeCode(error)) }
  }
  for (const source of Object.keys(SOURCES)) {
    const same = records.filter((r) => r.period.source === source)
    for (let i = 0; i < same.length; i++) {
      const period = same[i].period
      if (same.some((r, j) => i !== j && r.period.from <= period.to && r.period.to >= period.from)) period.reason = 'OVERLAPPING_PERIOD'
      if (period.reason) { period.status = 'unavailable'; period.metrics = emptyMetrics(source); issue(source, period.reason) }
    }
    try {
      const sums = zeroMetrics(source)
      for (const record of same.filter((r) => r.period.status === 'collected')) for (const key of SOURCES[source]) add(sums, key, record.period.metrics[key])
    } catch {
      for (const record of same) { record.period.status = 'unavailable'; record.period.reason = 'INVALID_METRIC'; record.period.metrics = emptyMetrics(source) }
      issue(source, 'INVALID_METRIC')
    }
    const collected = same.filter((r) => r.period.status === 'collected').length
    const hasIssue = gaps.some((gap) => gap.startsWith(`${source}:`))
    if (!same.length && !hasIssue) issue(source, 'MISSING_REPORT')
    sources[source] = { status: collected ? collected === same.length && !hasIssue ? 'collected' : 'partial' : 'unavailable' }
    if (!collected) sources[source].reason = same[0]?.period.reason || (hasIssue ? 'INVALID_ENTRY' : 'MISSING_REPORT')
  }
  return { periods: records.map((r) => r.period), monthly: monthlyTotals(records), sources, gaps: [...new Set(gaps)] }
}

module.exports = { readStoreReports, DEFAULT_REPORTS_DIR }
