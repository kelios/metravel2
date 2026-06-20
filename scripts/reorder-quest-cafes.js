#!/usr/bin/env node
/**
 * Переставляет необязательную точку-кофе-паузу «по ходу маршрута»:
 * вставляет шаг cafe сразу ПОСЛЕ ближайшей к нему (географически) сюжетной
 * точки, а не в самый конец квеста. Порядки остальных шагов пересдвигаются.
 *
 * Срабатывает для всех квестов, где есть шаг с кофе-паузой
 * (step_id='cafe' | 'bonus-cafe' | title с ☕). Квесты без кофе — пропуск.
 *
 * Переиндексация безопасна для unique-constraint (quest, order):
 * фаза 1 — все шаги в временный диапазон (+1000), фаза 2 — в финальные order.
 *
 * Запуск:
 *   node scripts/reorder-quest-cafes.js --dry-run
 *   node scripts/reorder-quest-cafes.js --api-url=https://metravel.by
 * Токен: --token=, env METRAVEL_TOKEN или ~/.metravel_token
 */

const fs = require('fs')
const os = require('os')
const path = require('path')

const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const apiUrlArg = args.find((a) => a.startsWith('--api-url='))
const tokenArg = args.find((a) => a.startsWith('--token='))
const onlyArg = args.find((a) => a.startsWith('--only=')) // CSV quest_id для точечного прогона
const API = apiUrlArg ? apiUrlArg.split('=')[1] : 'https://metravel.by'
const ONLY = onlyArg ? onlyArg.split('=')[1].split(',').map((s) => s.trim()).filter(Boolean) : null

const ALL_QUESTS = [
  'krakow-dragon', 'pakocim-voices', 'barkovshchina-spirits', 'minsk-cmok', 'yerevan-ararat',
  'warsaw-syrenka', 'grodno-royal', 'brest-fortress', 'vitebsk-chagall', 'mogilev-stargazer',
  'lida-castle', 'mir-castle', 'nesvizh-radziwill', 'polotsk-ancient', 'gomel-palace',
  'kossovo-ruzhany-palaces', 'wroclaw-gnomes', 'gdansk-amber', 'poznan-goats', 'torun-copernicus',
  'krakow-kazimierz', 'krakow-podgorze', 'krakow-nowahuta', 'minsk-loshitsa', 'minsk-traktorny',
  'minsk-dvoriki', 'minsk-cipher',
]

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

async function apiGet(endpoint) {
  const headers = { 'Content-Type': 'application/json' }
  if (TOKEN) headers['Authorization'] = `Token ${TOKEN}`
  const r = await fetch(`${API}${endpoint}`, { headers })
  if (!r.ok) throw new Error(`GET ${endpoint}: HTTP ${r.status}`)
  return r.json()
}

async function apiPatch(pk, order) {
  if (isDryRun) return
  const r = await fetch(`${API}/api/quest-steps/${pk}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Token ${TOKEN}` },
    body: JSON.stringify({ order }),
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`PATCH ${pk} order=${order}: HTTP ${r.status} ${t.slice(0, 200)}`)
  }
}

function isCafe(s) {
  return s && (s.step_id === 'cafe' || s.step_id === 'bonus-cafe' || /☕/.test(s.title || ''))
}
function isIntro(s) {
  return s && (s.is_intro === true || s.step_id === 'intro')
}
function haversine(aLat, aLng, bLat, bLng) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

async function processQuest(questId) {
  const bundle = await apiGet(`/api/quests/by-quest-id/${encodeURIComponent(questId)}/`)
  const steps = (typeof bundle.steps === 'string' ? JSON.parse(bundle.steps) : bundle.steps || []).slice()
  const cafe = steps.find(isCafe)
  if (!cafe) {
    return { questId, skip: 'нет кофе-паузы' }
  }
  // Текущий порядок без кафе: intro первым, далее сюжетные точки по order.
  const others = steps.filter((s) => s !== cafe).sort((a, b) => (a.order || 0) - (b.order || 0))
  const route = others.filter((s) => !isIntro(s))
  if (!route.length) return { questId, skip: 'нет точек маршрута' }

  // Ближайшая по координатам сюжетная точка.
  const cLat = Number(cafe.lat)
  const cLng = Number(cafe.lng)
  let nearest = route[0]
  let best = Infinity
  for (const s of route) {
    const d = haversine(cLat, cLng, Number(s.lat), Number(s.lng))
    if (d < best) {
      best = d
      nearest = s
    }
  }

  // Желаемая последовательность: others в текущем порядке, cafe вставлен после nearest.
  const seq = []
  for (const s of others) {
    seq.push(s)
    if (s === nearest) seq.push(cafe)
  }
  // Финальные order: 0,1,2,... в порядке seq.
  const desired = seq.map((s, i) => ({ pk: s.id, order: i, step: s }))
  const changes = desired.filter((d) => (d.step.order || 0) !== d.order)

  const nearestIdx = route.indexOf(nearest) + 1
  const cafeFinal = desired.find((d) => d.step === cafe).order
  const info = {
    questId,
    pk: bundle.id,
    nearest: `${nearestIdx}/${route.length} «${(nearest.title || '').slice(0, 30)}» (${Math.round(best)} м)`,
    cafeFrom: cafe.order,
    cafeTo: cafeFinal,
    changes: changes.length,
  }
  if (!changes.length) return { ...info, skip: 'уже на месте' }

  if (!isDryRun) {
    // Фаза 1: все меняющиеся шаги во временный диапазон (order+1000), от большего к меньшему.
    for (const d of [...changes].sort((a, b) => b.order - a.order)) await apiPatch(d.pk, d.order + 1000)
    // Фаза 2: финальные order.
    for (const d of changes) await apiPatch(d.pk, d.order)
  }
  return info
}

async function main() {
  const list = ONLY || ALL_QUESTS
  console.log(`Перестановка кофе-пауз по маршруту → ${API} (${isDryRun ? 'DRY RUN' : 'LIVE'})\n`)
  let moved = 0
  for (const q of list) {
    try {
      const r = await processQuest(q)
      if (r.skip) {
        console.log(`  · ${q}: ${r.skip}` + (r.cafeFrom !== undefined ? ` (кофе order ${r.cafeFrom}, ближайшая ${r.nearest})` : ''))
      } else {
        console.log(`  ✅ ${q} (pk ${r.pk}): кофе order ${r.cafeFrom} → ${r.cafeTo}, после точки ${r.nearest}; правок ${r.changes}`)
        moved++
      }
    } catch (e) {
      console.error(`  ❌ ${q}: ${e.message}`)
    }
  }
  console.log(`\nПереставлено квестов: ${moved}`)
}

main().catch((e) => {
  console.error('Fatal:', e.message || e)
  process.exit(1)
})
