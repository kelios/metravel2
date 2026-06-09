#!/usr/bin/env node
/**
 * Фикс точек квеста «Полоцк: колыбель Беларуси» (polotsk-ancient) на проде.
 *
 * Что правит (по результатам сверки с OSM/Nominatim, июнь 2026):
 * 1. efrosinia (id 172): координаты указывали на автобусную остановку в 557 м
 *    от монастыря → реальный Спасо-Евфросиниевский монастырь (OSM amenity/monastery,
 *    вул. Еўфрасінні Полацкай 89): 55.504204, 28.781465.
 * 2. sofia (id 168): задание просит число («Сколько башен? Введи число»), а
 *    answer_pattern был any_text(min_length 3) — ответ «2» не проходил.
 *    → exact_any ['2','две','два','дзве']. Подсказка содержала ответ («Две
 *    симметричные башни…») → заменена наводкой без ответа.
 * 3. letter-u (id 170): подсказка называла ответ («Та самая «у» со значком…»)
 *    → заменена наводкой без ответа.
 * 4. Порядок обхода: был зигзаг (центр → восток → монастырь на севере → снова
 *    центр → север). Новый порядок — связный пеший маршрут запад→восток→север:
 *    sofia → boris-stone → collegium → bogoyavlensky → letter-u → cafe → efrosinia.
 *
 * Запуск:
 *   node scripts/fix-polotsk-quest-points.js --dry-run
 *   node scripts/fix-polotsk-quest-points.js --api-url=https://metravel.by
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
const QUEST_ID = 'polotsk-ancient'

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
    console.log(`  [DRY] PATCH ${endpoint}`, JSON.stringify(payload).slice(0, 180))
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

// step_id → контентные правки
const CONTENT_FIXES = {
  efrosinia: {
    lat: '55.504204',
    lng: '28.781465',
    maps_url: 'https://maps.google.com/?q=55.504204,28.781465',
  },
  sofia: {
    answer_pattern: JSON.stringify({
      type: 'exact_any',
      value: JSON.stringify(['2', 'две', 'два', 'дзве']),
    }),
    hint: 'Отойди подальше, чтобы увидеть весь западный фасад целиком, и пересчитай башни над входом.',
  },
  'letter-u': {
    hint: 'Ответ отлит в бронзе прямо на памятнике — рассмотри его внимательно.',
  },
}

// Новый связный пеший порядок: запад → восток → север
const NEW_ORDER = {
  sofia: 1,
  'boris-stone': 2,
  collegium: 3,
  bogoyavlensky: 4,
  'letter-u': 5,
  cafe: 6,
  efrosinia: 7,
}

async function main() {
  console.log(`Фикс квеста ${QUEST_ID} → ${API} (${isDryRun ? 'DRY RUN' : 'LIVE'})\n`)
  const bundle = await apiGet(`/api/quests/by-quest-id/${encodeURIComponent(QUEST_ID)}/`)
  const steps = bundle.steps || []
  const byStepId = new Map(steps.map((s) => [s.step_id, s]))

  // 1. Контентные правки
  for (const [stepId, payload] of Object.entries(CONTENT_FIXES)) {
    const step = byStepId.get(stepId)
    if (!step) {
      console.error(`  !! шаг ${stepId} не найден`)
      continue
    }
    await apiPatch(`/api/quest-steps/${step.id}/`, payload)
    console.log(`  OK ${stepId} (id ${step.id}): ${Object.keys(payload).join(', ')}`)
  }

  // 2. Перестановка порядка — сперва во временные значения, чтобы не словить
  //    конфликт уникальности (quest, order), затем в целевые.
  const reorder = Object.entries(NEW_ORDER)
    .map(([stepId, order]) => ({ step: byStepId.get(stepId), order }))
    .filter(({ step, order }) => step && step.order !== order)
  if (reorder.length) {
    for (const { step, order } of reorder) {
      await apiPatch(`/api/quest-steps/${step.id}/`, { order: 100 + order })
    }
    for (const { step, order } of reorder) {
      await apiPatch(`/api/quest-steps/${step.id}/`, { order })
      console.log(`  OK order ${step.step_id}: ${step.order} -> ${order}`)
    }
  } else {
    console.log('  порядок уже корректный')
  }

  console.log('\nГотово')
}

main().catch((e) => {
  console.error('Fatal:', e.message || e)
  process.exit(1)
})
