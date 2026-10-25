#!/usr/bin/env node
/**
 * Массовая правка точек каталога /places одним запросом: название
 * (`travel_address.address`) и категории точки.
 *
 * Зачем: у сотен точек название не говорит, что это за объект, —
 * «Старый дворец», «Усадебный дом», «Парковая улица», «Шершунский сельский
 * Совет» (остаток нормализации #1735, когда первый сегмент геокодера оказался
 * улицей или сельсоветом). Такие точки не найти поиском и не понять в карточке.
 * Категории тоже неполные: «Башня замка» без «Замок», «Руины костёла» без
 * «Руины церкви», точка в национальном парке только с «Лес».
 *
 * Как работает: план правок лежит в JSON-файле (см. `scripts/data/places-bulk-update-*.json`),
 * скрипт валидирует его локально и отправляет ОДНИМ запросом на бэкенд
 * `POST /api/places/bulk-update/` (staff-only). По умолчанию режим dry-run:
 * бэкенд отвечает планом «было → стало» и `plan_sha256`. Применение требует
 * `--apply --expected-plan-sha256 <sha>` с отревьюенным digest — тот же
 * контракт, что у backend-команды `normalize_travel_address_titles` (#1735):
 * применить можно только тот план, который кто-то прочитал.
 *
 * Формат плана:
 *   {
 *     "version": 1,
 *     "items": [
 *       {
 *         "id": 2985,                       // travel_address.id (= `id` в /api/places/catalog/)
 *         "expected_address": "Старый дворец", // текущее название; бэкенд откажет, если точка уже переименована
 *         "address": "Дворец Монюшко-Ваньковичей в Смиловичах", // новое название (опционально)
 *         "add_category_ids": [33, 118],    // категории, которые добавить (опционально)
 *         "remove_category_ids": [],        // категории, которые снять (опционально)
 *         "reason": "…"                     // для ревью, на бэкенд не уходит
 *       }
 *     ]
 *   }
 *
 * Ответ бэкенда (оба режима): { mode, inspected, changed, unchanged, conflicts,
 *   plan_sha256, items: [{ id, travel_id, status: changed|unchanged|conflict|not_found|invalid,
 *   address_before, address_after, categories_before, categories_after, error? }] }.
 * При любом conflict/not_found/invalid бэкенд не применяет НИЧЕГО (одна транзакция).
 *
 * Токен: bodyMaintenanceSession — по умолчанию владелец (METRAVEL_ACTOR_ID=1,
 * ~/.metravel_token.owner, staff); METRAVEL_ACTOR_ID=104 даёт qa104 без staff-прав → 403.
 *
 * Примеры:
 *   METRAVEL_ACTOR_ID=1 node scripts/places-bulk-update.js --plan scripts/data/places-bulk-update-2026-10.json
 *   METRAVEL_ACTOR_ID=1 node scripts/places-bulk-update.js --plan … --apply --expected-plan-sha256 <sha из dry-run>
 *   METRAVEL_API=http://localhost:8000 node scripts/places-bulk-update.js --plan … (локальный бэкенд)
 */
'use strict'

const fs = require('fs')
const path = require('path')

const { bodyMaintenanceSession, parseResponseJson } = require('./lib/metravel-tool-session')
const { ExpectedFailureError, UsageError, parseCliArgs, runCli } = require('./lib/cli-contract')

const API_BASE = (process.env.METRAVEL_API || 'https://metravel.by').replace(/\/+$/, '') + '/api'
const ENDPOINT = '/places/bulk-update/'
const REPORT_DIR = path.join(__dirname, '..', '.codex-temp', 'places-bulk-update')
const MAX_ADDRESS_LENGTH = 255
const MAX_ITEMS = 3000

const USAGE = `Массовая правка названий и категорий точек каталога /places — одним запросом

Usage:
  node scripts/places-bulk-update.js --plan <path> [--apply --expected-plan-sha256 <sha>]

Options:
  --plan <path>                  JSON-план правок (обязателен)
  --apply                        применить план; без флага — dry-run, бэкенд ничего не пишет
  --expected-plan-sha256 <sha>   digest из отревьюенного dry-run; обязателен с --apply
  --help, -h                     эта справка

Environment:
  METRAVEL_ACTOR_ID     1 (по умолчанию) — токен владельца (staff); 104 — qa104, получит 403
  METRAVEL_API          origin бэкенда (по умолчанию https://metravel.by)`

const CLI_SPEC = {
  name: 'places-bulk-update',
  usage: USAGE,
  flags: {
    plan: { type: 'string', valueName: 'a path' },
    apply: { type: 'boolean' },
    'expected-plan-sha256': { type: 'string', valueName: 'a sha256 hex digest' },
  },
}

const SHA256_RE = /^[0-9a-f]{64}$/i

function isPositiveInt(value) {
  return Number.isSafeInteger(value) && value > 0
}

function normalizeIdList(value, field, index) {
  if (value == null) return []
  if (!Array.isArray(value)) throw new UsageError(`items[${index}].${field} must be an array of category ids`)
  const ids = value.map((id) => {
    if (!isPositiveInt(id)) throw new UsageError(`items[${index}].${field} contains a non-integer id: ${JSON.stringify(id)}`)
    return id
  })
  return Array.from(new Set(ids)).sort((a, b) => a - b)
}

/**
 * Читает и валидирует план. Возвращает items в форме, которую ждёт бэкенд
 * (без `reason`/`source` — это комментарии для ревью, не данные).
 */
function loadPlan(filePath) {
  let raw
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    throw new UsageError(`cannot read plan ${filePath}: ${error.message}`)
  }
  const items = Array.isArray(raw) ? raw : raw && raw.items
  if (!Array.isArray(items) || items.length === 0) throw new UsageError(`plan ${filePath} has no items`)
  if (items.length > MAX_ITEMS) throw new UsageError(`plan has ${items.length} items, limit is ${MAX_ITEMS}`)

  const seen = new Set()
  return items.map((item, index) => {
    if (!item || typeof item !== 'object') throw new UsageError(`items[${index}] is not an object`)
    if (!isPositiveInt(item.id)) throw new UsageError(`items[${index}].id must be a positive integer`)
    if (seen.has(item.id)) throw new UsageError(`items[${index}].id ${item.id} is listed twice`)
    seen.add(item.id)

    const out = { id: item.id }
    if (item.expected_address != null) {
      if (typeof item.expected_address !== 'string') throw new UsageError(`items[${index}].expected_address must be a string`)
      out.expected_address = item.expected_address
    }
    if (item.address != null) {
      if (typeof item.address !== 'string') throw new UsageError(`items[${index}].address must be a string`)
      const address = item.address.replace(/\s+/g, ' ').trim()
      if (!address) throw new UsageError(`items[${index}].address is empty`)
      if (address.length > MAX_ADDRESS_LENGTH) throw new UsageError(`items[${index}].address is longer than ${MAX_ADDRESS_LENGTH} chars`)
      // Равенство с expected_address допустимо: для точек с каноническим Place бэкенд
      // по такому элементу пересинхронизирует Place.address (его показывает каталог).
      out.address = address
    }
    const add = normalizeIdList(item.add_category_ids, 'add_category_ids', index)
    const remove = normalizeIdList(item.remove_category_ids, 'remove_category_ids', index)
    const both = add.filter((id) => remove.includes(id))
    if (both.length) throw new UsageError(`items[${index}] adds and removes the same category ${both.join(', ')}`)
    if (add.length) out.add_category_ids = add
    if (remove.length) out.remove_category_ids = remove
    if (out.address === undefined && !add.length && !remove.length) {
      throw new UsageError(`items[${index}] (id ${item.id}) changes nothing: no address and no categories`)
    }
    return out
  })
}

function buildRequestBody(items, { apply, expectedPlanSha256 }) {
  const body = { items, apply: Boolean(apply) }
  if (apply) body.expected_plan_sha256 = expectedPlanSha256.toLowerCase()
  return body
}

/**
 * Ответ 2xx ещё не значит, что бэкенд разобрал план: конверт без `items`,
 * без digest или без части отправленных точек — сломанный контракт, а не
 * «0 отклонено» с зелёным выходом. В --apply digest ответа обязан совпасть
 * с отревьюенным: иначе применён не тот план, который читали.
 */
function validateReport(report, sentItems, { apply, expectedPlanSha256 }) {
  if (!report || !Array.isArray(report.items) || !report.items.every((item) => item && typeof item === 'object')) {
    throw new ExpectedFailureError('backend response has no items[] of objects — unexpected envelope, refusing to report success')
  }
  if (typeof report.plan_sha256 !== 'string' || !SHA256_RE.test(report.plan_sha256)) {
    throw new ExpectedFailureError('backend response has no valid plan_sha256 — refusing to report success')
  }
  const expectedMode = apply ? 'apply' : 'dry-run'
  if (report.mode !== expectedMode) {
    throw new ExpectedFailureError(`backend answered mode=${report.mode} to a ${expectedMode} request — refusing to report success`)
  }
  if (apply && report.plan_sha256.toLowerCase() !== expectedPlanSha256.toLowerCase()) {
    throw new ExpectedFailureError(`backend plan_sha256 ${report.plan_sha256} differs from the reviewed --expected-plan-sha256`)
  }
  const reported = new Set(report.items.map((item) => item.id))
  const missing = sentItems.filter((item) => !reported.has(item.id)).map((item) => item.id)
  if (missing.length) {
    throw new ExpectedFailureError(`backend response omits ${missing.length} of ${sentItems.length} items (ids ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ', …' : ''})`)
  }
}

function summarize(report) {
  const counts = {}
  for (const item of report.items) counts[item.status] = (counts[item.status] || 0) + 1
  return counts
}

function writeReport(report, { apply }) {
  fs.mkdirSync(REPORT_DIR, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const file = path.join(REPORT_DIR, `${stamp}-${apply ? 'apply' : 'dry-run'}.json`)
  fs.writeFileSync(file, JSON.stringify(report, null, 2), 'utf8')
  return file
}

async function sendPlan(body, { session } = {}) {
  const client = session || bodyMaintenanceSession({ origin: API_BASE })
  const response = await client.request(`${API_BASE}${ENDPOINT}`, { method: 'POST', json: body })
  const text = await response.text()
  if (response.status === 403) {
    throw new ExpectedFailureError('403: bulk-update требует staff-токен — запускать с METRAVEL_ACTOR_ID=1')
  }
  if (response.status === 404) {
    throw new ExpectedFailureError(`404: ${ENDPOINT} ещё не выкачен на ${API_BASE} — см. карточку area=back`)
  }
  // 409 (чужой digest) и 422 (conflict/not_found/invalid) по контракту #2728 несут тот же
  // отчёт с per-item статусами, что и 200: его надо сохранить и показать, а не обрезать.
  if (response.status === 409 || response.status === 422) {
    try {
      const report = parseResponseJson(text)
      if (report && Array.isArray(report.items)) return { ...report, http_status: response.status }
    } catch {
      // не JSON — падаем в общий отказ ниже
    }
  }
  if (response.status < 200 || response.status >= 300) {
    throw new ExpectedFailureError(`HTTP ${response.status}: ${text.slice(0, 500)}`)
  }
  return parseResponseJson(text)
}

async function main() {
  const args = parseCliArgs(process.argv, CLI_SPEC)
  if (!args.plan) throw new UsageError('--plan <path> is required')
  const apply = Boolean(args.apply)
  const expectedPlanSha256 = args.expectedPlanSha256
  if (apply && !(typeof expectedPlanSha256 === 'string' && SHA256_RE.test(expectedPlanSha256))) {
    throw new UsageError('--apply requires --expected-plan-sha256 <64 hex> from a reviewed dry-run')
  }
  if (!apply && expectedPlanSha256) throw new UsageError('--expected-plan-sha256 only makes sense with --apply')

  const items = loadPlan(path.resolve(args.plan))
  const body = buildRequestBody(items, { apply, expectedPlanSha256 })
  console.log(`[places-bulk-update] ${apply ? 'APPLY' : 'dry-run'}: ${items.length} items → ${API_BASE}${ENDPOINT}`)

  const report = await sendPlan(body)
  const file = writeReport(report, { apply })
  console.log(`[places-bulk-update] report: ${file}`)
  validateReport(report, items, { apply, expectedPlanSha256 })
  const counts = summarize(report)
  console.log(`[places-bulk-update] mode=${report.mode} inspected=${report.inspected} changed=${report.changed} ` +
    `statuses=${JSON.stringify(counts)} plan_sha256=${report.plan_sha256}`)
  const bad = report.items.filter((item) => !['changed', 'unchanged'].includes(item.status))
  if (report.http_status && !bad.length) {
    throw new ExpectedFailureError(`backend answered HTTP ${report.http_status} without rejected items — nothing was applied, see ${file}`)
  }
  if (bad.length) {
    for (const item of bad.slice(0, 30)) console.log(`  ${item.status} id=${item.id}: ${item.error || ''}`)
    throw new ExpectedFailureError(`${bad.length} items rejected — the backend applied nothing; fix the plan and rerun`)
  }
  if (!apply) {
    console.log(`[places-bulk-update] next: review ${file}, then rerun with --apply --expected-plan-sha256 ${report.plan_sha256}`)
  }
}

if (require.main === module) {
  runCli(main, CLI_SPEC)
}

module.exports = { CLI_SPEC, ENDPOINT, MAX_ITEMS, buildRequestBody, loadPlan, sendPlan, summarize, validateReport }
