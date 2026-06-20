#!/usr/bin/env node
/**
 * Добавляет необязательную точку-кофе-паузу в квесты, у которых её не было.
 *
 * До правки кофе-паузы НЕ было у 3 квестов (удалённые/мемориальные локации):
 *   - barkovshchina-spirits (pk 3)      — д. Вашково, Ушачский р-н
 *   - brest-fortress       (pk 8)       — Брестская крепость
 *   - kossovo-ruzhany-palaces (pk 16)   — Коссово / Ружаны
 *
 * Кафе — реально работающие на 2026 (веб-сверка Яндекс/Google Maps/OSM/2GIS,
 * координаты из карт-листингов):
 *   - «Ландыш» при санатории «Лесные озёра», д. Вашково 5А — в самой деревне,
 *     ~0.3–0.8 км от точек маршрута.
 *   - «Цитадель» на территории Брестской крепости (ул. Героев Обороны, 58П) —
 *     в стенах казарм, между Главным входом и собором.
 *   - «Касцюшка» в Коссово, рядом с дворцом Пусловских и усадьбой-музеем
 *     Костюшко (~250–300 м), открыто ежедневно.
 *
 * Формат точки — единое соглашение проекта: step_id='cafe', title с ☕ и
 * «(по желанию)», answer_pattern {type:'any'} (отметиться без ответа),
 * order — после последней сюжетной точки (см. scripts/fix-quest-cafes.js).
 *
 * Запуск:
 *   node scripts/add-quest-cafes.js --dry-run
 *   node scripts/add-quest-cafes.js --api-url=https://metravel.by
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

async function apiPost(endpoint, payload) {
  if (isDryRun) {
    console.log(`  [DRY] POST ${endpoint}`, JSON.stringify(payload).slice(0, 180))
    return { id: 0 }
  }
  const r = await fetch(`${API}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Token ${TOKEN}` },
    body: JSON.stringify(payload),
  })
  if (!r.ok) {
    const t = await r.text()
    throw new Error(`POST ${endpoint}: HTTP ${r.status} ${t.slice(0, 300)}`)
  }
  return r.json()
}

const INTRO =
  'Необязательная остановка — для удовольствия, а не для загадок. Лучшие открытия в путешествии часто случаются за чашкой кофе.\n\n'
const OUTRO = '\n\nЗагляни, переведи дух, обсуди увиденное — а потом продолжай маршрут (или заверши прогулку здесь).'
const TASK = 'Необязательная точка ☕. Просто сделай паузу: выпей кофе и отметься, когда будешь готов. Можно и пропустить.'

function dec(value) {
  const num = Number(value)
  return Number(num.toFixed(6)).toString()
}
function maps(lat, lng) {
  return `https://maps.google.com/?q=${lat},${lng}`
}

// quest_id → данные кафе. order проставляется автоматически (после последней точки).
const CAFES = {
  'barkovshchina-spirits': {
    title: '☕ Ландыш (по желанию)',
    location: 'Кафе «Ландыш», санаторий «Лесные озёра», д. Вашково, 5А',
    story:
      INTRO +
      'Кафе при санатории «Лесные озёра» — единственное место в Вашково, где можно сесть с чашкой кофе у самой воды. Белорусская кухня, щедрые порции и тишина озёрного края: идеальная пауза между лесными загадками.' +
      OUTRO,
    lat: 55.107128,
    lng: 28.603782,
  },
  'brest-fortress': {
    title: '☕ Цитадель (по желанию)',
    location: 'Кафе «Цитадель», ул. Героев Обороны Брестской крепости, 58П',
    story:
      INTRO +
      '«Цитадель» — кафе прямо на территории крепости, в стенах старых казарм. Здесь можно перевести дух с тарелкой драников или солянки, не выходя за бастионы, прежде чем двинуться дальше по местам обороны.' +
      OUTRO,
    lat: 52.084751,
    lng: 23.659666,
  },
  'kossovo-ruzhany-palaces': {
    title: '☕ Касцюшка (по желанию)',
    location: 'Кафе «Касцюшка», Коссово (у дворца Пусловских и усадьбы Костюшко)',
    story:
      INTRO +
      'В двух шагах от дворца Пусловских и усадьбы-музея Костюшко работает кафе «Касцюшка» — простая белорусская кухня и кофе, открыто ежедневно. Удобно перевести дух между двумя дворцами.' +
      OUTRO,
    lat: 52.766448,
    lng: 25.124869,
  },
  'krakow-kazimierz': {
    title: '☕ Bazaar Bistro (по желанию)',
    location: 'Bazaar Bistro, Plac Nowy 6, Краков',
    story:
      INTRO +
      'На самом Plac Nowy, в угловом доме, спрячься от суеты в Bazaar Bistro — кофе с видом на легендарный круглый рынок-«okrąglak», сердце еврейского Казимежа.' +
      OUTRO,
    lat: 50.051573,
    lng: 19.944431,
  },
  'krakow-podgorze': {
    title: '☕ Cafe Lukier (по желанию)',
    location: 'Cafe Lukier, Rynek Podgórski 4, Краков',
    story:
      INTRO +
      'У костёла Святого Иосифа на Rynek Podgórski загляни в Cafe Lukier — тихий уголок старого Подгужа перед спуском к площади Героев Гетто.' +
      OUTRO,
    lat: 50.043761,
    lng: 19.949897,
  },
  'krakow-nowahuta': {
    title: '☕ Stylowa (по желанию)',
    location: 'Restauracja Stylowa, os. Centrum C 3 (al. Róż), Краков',
    story:
      INTRO +
      'На Аллее Роз стоит «Stylowa» — кафе-ресторан, работающий с 1956 года в духе соцреализма. Здесь пили кофе строители первого квартала Новой Хуты; зайди и ты.' +
      OUTRO,
    lat: 50.074697,
    lng: 20.037878,
  },
  'minsk-loshitsa': {
    title: '☕ Лошицкий Фольварок (по желанию)',
    location: 'Кафе «Лошицкий Фольварок», проезд Чижевских, 8, Минск',
    story:
      INTRO +
      'Прямо в исторической усадьбе работает кафе «Лошицкий Фольварок» — передохни здесь между прудом и старым домом Любанских.' +
      OUTRO,
    lat: 53.850882,
    lng: 27.578785,
  },
  'minsk-traktorny': {
    title: '☕ Кофеёк (по желанию)',
    location: 'Кофейня «Кофеёк», Партизанский проспект, 49, Минск',
    story:
      INTRO +
      'На Партизанском проспекте, в сталинской застройке соцгорода МТЗ, спрячься от заводского гула в кофейне «Кофеёк» — кофе с собой по дороге к бульвару Тракторостроителей.' +
      OUTRO,
    lat: 53.879538,
    lng: 27.607146,
  },
  'minsk-dvoriki': {
    title: '☕ Американо (по желанию)',
    location: 'Кофейня «Американо», ул. Интернациональная, 5, Минск',
    story:
      INTRO +
      'В двух шагах от Красного дворика, на Интернациональной, выпей кофе в «Американо» — короткая пауза в самом сердце старого Минска перед муралами Октябрьской.' +
      OUTRO,
    lat: 53.901049,
    lng: 27.552468,
  },
  'minsk-cipher': {
    title: '☕ Золотой Гребешок (по желанию)',
    location: 'Кафе «Золотой Гребешок» (La Crête D’Or), просп. Независимости, 37, Минск',
    story:
      INTRO +
      'У площади Победы, на проспекте Независимости, работает «Золотой Гребешок» (La Crête D’Or) — историческая кофейня-кондитерская; идеальная точка-передышка в центре.' +
      OUTRO,
    lat: 53.909313,
    lng: 27.575446,
  },
}

async function main() {
  console.log(`Добавление кофе-пауз в квесты → ${API} (${isDryRun ? 'DRY RUN' : 'LIVE'})\n`)
  let ok = 0
  for (const [questId, cafe] of Object.entries(CAFES)) {
    try {
      const bundle = await apiGet(`/api/quests/by-quest-id/${encodeURIComponent(questId)}/`)
      const questDbId = bundle.id
      const steps = typeof bundle.steps === 'string' ? JSON.parse(bundle.steps) : bundle.steps || []
      if (steps.some((s) => s?.step_id === 'cafe')) {
        console.log(`  ℹ️ ${questId}: кофе-пауза уже есть — пропуск`)
        continue
      }
      const maxOrder = steps.reduce((m, s) => Math.max(m, Number(s?.order) || 0), 0)
      const order = maxOrder + 1
      await apiPost('/api/quest-steps/', {
        quest: questDbId,
        step_id: 'cafe',
        title: cafe.title,
        location: cafe.location,
        story: cafe.story,
        task: TASK,
        hint: null,
        answer_pattern: JSON.stringify({ type: 'any', value: '' }),
        lat: dec(cafe.lat),
        lng: dec(cafe.lng),
        maps_url: maps(dec(cafe.lat), dec(cafe.lng)),
        input_type: 'text',
        order,
        is_intro: false,
      })
      console.log(`  ✅ ${questId} (pk ${questDbId}): «${cafe.title}» @ ${dec(cafe.lat)},${dec(cafe.lng)} order ${order}`)
      ok++
    } catch (e) {
      console.error(`  ❌ ${questId}: ${e.message}`)
    }
  }
  console.log(`\nГотово: ${ok}/${Object.keys(CAFES).length}`)
}

main().catch((e) => {
  console.error('Fatal:', e.message || e)
  process.exit(1)
})
