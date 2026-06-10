#!/usr/bin/env node
/**
 * Применяет патчи квест-контента (.quest-audit/patches-*.json) на прод.
 * Формат патча: {quest_id, step_db_id, step_id, changes:{task?,hint?,answer_pattern?,lat?,lng?,maps_url?,story?}}
 *
 * node scripts/apply-quest-patches.js --dry-run .quest-audit/patches-*.json
 * node scripts/apply-quest-patches.js .quest-audit/patches-by-west.json
 * Токен: --token=, env METRAVEL_TOKEN или ~/.metravel_token
 */

const fs = require('fs')
const os = require('os')
const path = require('path')

const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const apiUrlArg = args.find((a) => a.startsWith('--api-url='))
const tokenArg = args.find((a) => a.startsWith('--token='))
const API = apiUrlArg ? apiUrlArg.split('=')[1] : 'https://metravel.by'
const files = args.filter((a) => !a.startsWith('--'))

if (!files.length) {
  console.error('Укажи патч-файлы: node scripts/apply-quest-patches.js [--dry-run] <files...>')
  process.exit(1)
}

function resolveToken() {
  if (tokenArg) return tokenArg.split('=').slice(1).join('=')
  if (process.env.METRAVEL_TOKEN) return process.env.METRAVEL_TOKEN
  try {
    const p = path.join(os.homedir(), '.metravel_token')
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim()
  } catch {
    /* ignore */
  }
  return null
}
const TOKEN = resolveToken()
if (!TOKEN && !isDryRun) {
  console.error('Нужен токен: --token=, env METRAVEL_TOKEN или ~/.metravel_token')
  process.exit(1)
}

const ALLOWED = new Set(['task', 'hint', 'answer_pattern', 'lat', 'lng', 'maps_url', 'story', 'order'])
const TYPES = new Set(['any', 'exact', 'exact_any', 'range', 'any_text', 'any_number', 'approx'])

function validate(p, file) {
  if (!p.step_db_id) throw new Error(`${file} ${p.quest_id}/${p.step_id}: нет step_db_id`)
  const payload = {}
  for (const [k, v] of Object.entries(p.changes || {})) {
    if (!ALLOWED.has(k)) throw new Error(`${file} ${p.step_id}: запрещённое поле ${k}`)
    payload[k] = v
  }
  if (!Object.keys(payload).length) throw new Error(`${file} ${p.step_id}: пустые changes`)
  if (payload.answer_pattern !== undefined) {
    const ap = JSON.parse(payload.answer_pattern)
    if (!TYPES.has(ap.type)) throw new Error(`${file} ${p.step_id}: неизвестный type ${ap.type}`)
    if (['exact_any', 'range', 'any_text', 'approx'].includes(ap.type)) JSON.parse(ap.value)
  }
  for (const k of ['lat', 'lng']) {
    if (payload[k] !== undefined && !Number.isFinite(Number(payload[k])))
      throw new Error(`${file} ${p.step_id}: кривое ${k}=${payload[k]}`)
  }
  return payload
}

async function apiPatch(endpoint, payload) {
  if (isDryRun) {
    console.log(`  [DRY] PATCH ${endpoint}`, Object.keys(payload).join(','))
    return {}
  }
  const r = await fetch(`${API}${endpoint}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Token ${TOKEN}` },
    body: JSON.stringify(payload),
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`PATCH ${endpoint}: HTTP ${r.status} ${t.slice(0, 300)}`)
  }
  return r.json()
}

async function main() {
  let ok = 0
  let failed = 0
  for (const file of files) {
    const patches = JSON.parse(fs.readFileSync(file, 'utf8'))
    console.log(`\n=== ${file}: ${patches.length} патчей`)
    for (const p of patches) {
      try {
        const payload = validate(p, file)
        await apiPatch(`/api/quest-steps/${p.step_db_id}/`, payload)
        console.log(`  OK ${p.quest_id}/${p.step_id} (id ${p.step_db_id}): ${Object.keys(payload).join(', ')}`)
        ok++
      } catch (e) {
        console.error(`  FAIL ${p.quest_id}/${p.step_id}: ${e.message}`)
        failed++
      }
    }
  }
  console.log(`\nИтого: OK ${ok}, FAIL ${failed} (${isDryRun ? 'DRY RUN' : 'LIVE'})`)
  if (failed) process.exitCode = 1
}

main().catch((e) => {
  console.error('Fatal:', e.message || e)
  process.exit(1)
})
