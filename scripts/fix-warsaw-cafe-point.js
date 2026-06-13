#!/usr/bin/env node
/**
 * Замена необязательной точки-кафе в квесте «Варшава» (warsaw-syrenka) на проде.
 *
 * Почему: исходное «Vita Cafe» (id 217, 52.2448983, 21.013754) закрылось.
 * Замена — легендарное «Café Bristol» при отеле Bristol (Krakowskie
 * Przedmieście 42/44), сверено с OSM/Nominatim: 52.2421169, 21.0158980.
 * Это ~250 м южнее старой точки, прямо по Королевскому тракту на пути к финалу
 * (Дворец культуры), между Костёлом Святой Анны и памятником Копернику.
 *
 * Запуск:
 *   node scripts/fix-warsaw-cafe-point.js --dry-run
 *   node scripts/fix-warsaw-cafe-point.js --api-url=https://metravel.by
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
const QUEST_ID = 'warsaw-syrenka'

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
  const r = await fetch(`${API}${endpoint}`)
  if (!r.ok) throw new Error(`GET ${endpoint}: HTTP ${r.status}`)
  return r.json()
}

async function apiPatch(endpoint, payload) {
  if (isDryRun) {
    console.log(`  [DRY] PATCH ${endpoint}`, JSON.stringify(payload).slice(0, 200))
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

const CAFE_FIX = {
  title: '☕ Café Bristol (по желанию)',
  location: 'Café Bristol, Krakowskie Przedmieście 42/44',
  story:
    'Необязательная остановка — для удовольствия, а не для загадок. Лучшие открытия в путешествии часто случаются за чашкой кофе.\n\n' +
    'По дороге к финалу, на Краковском предместье, тебя ждёт легендарное «Café Bristol» при отеле Bristol. Отель открылся в 1901 году, и среди его совладельцев был сам Игнаций Падеревский — великий пианист и будущий премьер-министр Польши. Кафе в духе венских кофеен пережило войну и работает до сих пор: мрамор, зеркала, витрина с пирожными.\n\n' +
    'Загляни, переведи дух, выпей кофе и обсуди увиденное — а потом продолжай маршрут к Дворцу культуры (или заверши прогулку здесь).',
  task: 'Необязательная точка ☕. Просто сделай паузу: выпей кофе и отметься, когда будешь готов. Можно и пропустить.',
  lat: '52.2421169',
  lng: '21.0158980',
  maps_url: 'https://maps.google.com/?q=52.2421169,21.0158980',
}

async function main() {
  console.log(`Замена кафе в квесте ${QUEST_ID} → ${API} (${isDryRun ? 'DRY RUN' : 'LIVE'})\n`)
  const bundle = await apiGet(`/api/quests/by-quest-id/${encodeURIComponent(QUEST_ID)}/`)
  let steps = bundle.steps || []
  if (typeof steps === 'string') steps = JSON.parse(steps)
  const cafe = steps.find((s) => s.step_id === 'cafe')
  if (!cafe) {
    console.error('  !! точка cafe не найдена')
    process.exit(1)
  }
  console.log(`  Текущая: «${cafe.title}» (id ${cafe.id}) @ ${cafe.lat},${cafe.lng}`)
  await apiPatch(`/api/quest-steps/${cafe.id}/`, CAFE_FIX)
  console.log(`  OK cafe (id ${cafe.id}) → «${CAFE_FIX.title}» @ ${CAFE_FIX.lat},${CAFE_FIX.lng}`)
  console.log('\nГотово')
}

main().catch((e) => {
  console.error('Fatal:', e.message || e)
  process.exit(1)
})
