#!/usr/bin/env node
/**
 * Добавляет в квесты необязательные точки «классное место» (✨) — атмосферные
 * рестораны/бары/кофейни рядом с маршрутом, прошедшие порог TripAdvisor
 * (рейтинг ≥ 4.5 И ≥ 100 отзывов; веб-сверка по TripAdvisor + картам, июнь 2026).
 *
 * Точка создаётся как необязательная (answer_pattern {type:'any'} — отметиться
 * без ответа) и сразу ставится «по ходу маршрута»: сразу ПОСЛЕ ближайшей к ней
 * по координатам существующей точки (а не в конец). Порядки пересдвигаются
 * безопасно для unique-constraint (quest, order) через временный диапазон.
 *
 * Запуск:
 *   node scripts/add-quest-spots.js --dry-run
 *   node scripts/add-quest-spots.js --api-url=https://metravel.by
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
    console.log(`    [DRY] POST ${endpoint}`, JSON.stringify(payload).slice(0, 120))
    return { id: -Math.floor(Math.random() * 1e6) }
  }
  const r = await fetch(`${API}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Token ${TOKEN}` },
    body: JSON.stringify(payload),
  })
  if (!r.ok) throw new Error(`POST ${endpoint}: HTTP ${r.status} ${(await r.text()).slice(0, 250)}`)
  return r.json()
}
async function apiPatchOrder(pk, order) {
  if (isDryRun) return
  const r = await fetch(`${API}/api/quest-steps/${pk}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Token ${TOKEN}` },
    body: JSON.stringify({ order }),
  })
  if (!r.ok) throw new Error(`PATCH ${pk} order=${order}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`)
}

const SPOT_INTRO =
  'Необязательная точка — не загадка, а рекомендация. Рядом с маршрутом есть место, ради которого стоит сделать небольшой крюк.\n\n'
const SPOT_TASK =
  'Необязательная точка ✨. Хочешь — загляни и отметься, хочешь — иди дальше. Это просто подсказка для приятной паузы.'

function dec(v) {
  return Number(Number(v).toFixed(6)).toString()
}
function maps(lat, lng) {
  return `https://maps.google.com/?q=${lat},${lng}`
}
function haversine(aLat, aLng, bLat, bLng) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}
function isIntro(s) {
  return s && (s.is_intro === true || s.step_id === 'intro')
}

// quest_id → массив атмосферных мест (порядок step_id: первый 'spot', далее 'spot-2'…).
const SPOTS = {
  'krakow-dragon': [{ name: 'Szara Gęś', loc: 'Rynek Główny 17, Краков', lat: 50.060541, lng: 19.937249, rating: 4.5, reviews: 1332, desc: 'Изысканная польская кухня прямо на Главном рынке: готический зал с видом на площадь, фирменные гусиные блюда и эффектные авторские десерты.' }],
  'krakow-kazimierz': [{ name: 'Starka', loc: 'ul. Józefa 14, Краков (Казимеж)', lat: 50.05066, lng: 19.944398, rating: 4.7, reviews: 8934, desc: 'Легендарная корчма в сердце Казимежа: тёплый ретро-интерьер, живая музыка и настойки собственного производства. Намоленное место в паре минут от Plac Nowy.' }],
  'krakow-podgorze': [{ name: 'Kuchnia Polska Gąska', loc: 'ul. Limanowskiego 1, Краков (Подгуже)', lat: 50.045057, lng: 19.950205, rating: 4.7, reviews: 1360, desc: 'Душевная польская кухня напротив Рыночной площади Подгужа: гусятина, драники и домашняя атмосфера.' }],
  'warsaw-syrenka': [{ name: 'Stolica', loc: 'Szeroki Dunaj 1/3, Варшава (Старый город)', lat: 52.249508, lng: 21.010415, rating: 4.7, reviews: 2539, desc: 'Польская кухня в интерьере межвоенной Варшавы — старые афиши, патефонная музыка, спрятано в переулке у самой Рыночной площади Старого города.' }],
  'wroclaw-gnomes': [{ name: 'Jadka', loc: 'ul. Rzeźnicza 24/25, Вроцлав', lat: 51.111956, lng: 17.028578, rating: 4.5, reviews: 497, desc: 'Современная польская кухня под готическими кирпичными сводами в историческом доме в паре шагов от Рынка. Элегантно и камерно.' }],
  'gdansk-amber': [{ name: 'Literacka Wine Bar', loc: 'ul. Mariacka 50/52, Гданьск', lat: 54.349901, lng: 18.654134, rating: 4.7, reviews: 1980, desc: 'Винный бар прямо на самой красивой улице Гданьска — Мариацкой, с её каменными террасами и янтарными лавками. Уютный полумрак под старой кладкой.' }],
  'poznan-goats': [{ name: 'Ratuszova', loc: 'Stary Rynek 55, Познань', lat: 52.407491, lng: 16.934031, rating: 4.6, reviews: 1484, desc: 'Региональная кухня в историческом интерьере прямо на Старом Рынке, с видом на ратушу и её знаменитых козликов.' }],
  'torun-copernicus': [{ name: 'Restauracja Luizjana (Dwór Artusa)', loc: 'Rynek Staromiejski 6, Торунь', lat: 53.009841, lng: 18.604492, rating: 4.5, reviews: 113, desc: 'Атмосферное место в историческом Дворе Артуса на самом Рынке, в нескольких шагах от ратуши и дома Коперника. Продуманный интерьер с живой музыкой.' }],
  'minsk-cipher': [{ name: 'Charlie Restaurant & Bar', loc: 'ул. Коммунистическая, 4, Минск', lat: 53.908647, lng: 27.571291, rating: 4.7, reviews: 263, desc: 'Камерный fine-dining с французской кухней и морепродуктами в доме, где когда-то жил Ли Харви Освальд. Тихая улочка в паре шагов от площади Победы.' }],
  'gomel-palace': [{ name: 'Старое время', loc: 'ул. Крестьянская, 14, Гомель', lat: 52.428406, lng: 31.013679, rating: 4.5, reviews: 227, desc: 'Тематический ресторан в духе советского кино — ламповый интерьер с предметами эпохи и сытная кухня. В паре минут от парка Румянцевых-Паскевичей.' }],
  'yerevan-ararat': [
    { name: 'Lavash', loc: 'ул. Туманяна 21, Ереван', lat: 40.183065, lng: 44.516254, rating: 4.8, reviews: 5269, desc: 'Современная армянская кухня в самом сердце центра: светлый зал, открытая кухня и фирменный лаваш — одно из самых атмосферных мест города.' },
    { name: 'Tavern Yerevan', loc: 'ул. Амиряна 5, Ереван', lat: 40.178966, lng: 44.510163, rating: 4.7, reviews: 2957, desc: 'Уютная таверна с традиционной армянской кухней и национальной музыкой рядом с площадью Республики. Колоритный интерьер и большие порции.' },
  ],
  // Малые города Беларуси: TripAdvisor пуст, рейтинг по Яндекс.Картам.
  'grodno-royal': [{ name: 'Boboli', loc: 'ул. Замковая, 10, Гродно', lat: 53.6781, lng: 23.8274, rating: 5.0, reviews: 1838, source: 'yandex', desc: 'Необистро в историческом «Доме рыбака» прямо у Старого замка: европейская кухня с итальянским акцентом, уютный интерьер — одно из самых высокооценённых мест центра Гродно.' }],
  'vitebsk-chagall': [{ name: 'Золотой лев', loc: 'ул. Суворова, 20, Витебск', lat: 55.197297, lng: 30.204459, rating: 4.9, reviews: 2457, source: 'yandex', desc: 'Ресторан в историческом здании прямо на пешеходной Суворова, с видом на старый город и сытной национальной кухней; выдержанный стиль и уютная атмосфера.' }],
  'lida-castle': [{ name: 'Корчма Кумпяк', loc: 'Замковая ул., 1, Лида', lat: 53.8873, lng: 25.302361, rating: 5.0, reviews: 484, source: 'yandex', desc: 'Аутентичная белорусская корчма в нескольких шагах от Лидского замка: старинный деревенский интерьер и традиционные блюда с эффектной подачей.' }],
  'mogilev-stargazer': [{ name: 'Bellagio', loc: 'Ленинская ул., 21, Могилёв', lat: 53.896738, lng: 30.33537, rating: 4.7, reviews: 124, source: 'yandex', desc: 'Атмосферный ресторан прямо на пешеходной Ленинской рядом с ратушей: элегантный интерьер, итальянско-средиземноморская кухня и летняя терраса.' }],
  'mir-castle': [{ name: 'Княжеский двор', loc: 'ул. Красноармейская, 2 (территория Мирского замка)', lat: 53.451195, lng: 26.473324, rating: 5.0, reviews: 610, source: 'yandex', desc: 'Замковый ресторан белорусской кухни прямо на территории Мирского замка, со средневековым интерьером, фирменными драниками и настойками. Лучшая точка передохнуть у самих стен.' }],
  'nesvizh-radziwill': [{ name: 'Гетман', loc: 'ул. Замковая, 2 (Несвижский замок)', lat: 53.222859, lng: 26.69246, rating: 4.8, reviews: 570, source: 'yandex', desc: 'Ресторан внутри дворцового комплекса Радзивиллов со сводчатыми залами и видом на замковый двор. Белорусская и европейская кухня в по-настоящему замковой атмосфере.' }],
  'polotsk-ancient': [{ name: 'Дамиан', loc: 'Нижне-Покровская ул., 41Б, Полоцк', lat: 55.48348, lng: 28.778743, rating: 4.9, reviews: 838, source: 'yandex', desc: 'Уютное атмосферное место в историческом центре над Двиной: дерево, лён, глиняная посуда и современная белорусская кухня. Между Софийским собором и проспектом Скорины.' }],
  // Культовые/исторические места: добавлены ради истории, с предупреждением о рейтинге (порог не действует).
  'minsk-cmok': [{ name: 'Старовиленская корчма', loc: 'ул. Старовиленская, 2, Троицкое предместье, Минск', lat: 53.907776, lng: 27.555059, why: 'Корчма работает в Троицком предместье с 1982 года, в здании-памятнике XIX века — одно из первых заведений воссозданного предместья, с батлейкой и живой белорусской фолк-музыкой; визитная карточка старого Минска.', rating_note: 'Рейтинг средний и противоречивый (≈4.3 на relax.by, ниже на других площадках) — идём сюда ради истории места и атмосферы, а не ради кухни.' }],
  'minsk-dvoriki': [{ name: 'Бар «Чердак»', loc: 'ул. Зыбицкая, 9, Минск', lat: 53.905585, lng: 27.559298, why: 'Старейший бар Зыбицкой: открылся в 2013-м и фактически запустил превращение «Зыбы» в главную бар-стрит Минска — культовая точка местной барной культуры.', rating_note: 'Рейтинг неоднороден (4.5 на TripAdvisor, ниже на других) — это шумный бар Зыбицкой; ценность здесь историческая, а не гастрономическая.' }],
  'kossovo-ruzhany-palaces': [{ name: 'Ресторан «Граф Пусловский»', loc: 'ул. Т. Костюшко, 108 (дворец Пусловских), Коссово', lat: 52.765774, lng: 25.121096, why: 'Ресторан в стенах самого дворца Пусловских (правое крыло), названный в честь его владельцев — возможность пообедать прямо в «рыцарской мечте» Коссово.', rating_note: 'Честно: это не вековая легенда, а ресторан при дворце, открытый в 2020 году, отзывов немного. Берём ради того, что он буквально в стенах дворца.' }],
}

function buildStory(s) {
  // Культовое/историческое место: добавляем ради истории, с честным предупреждением о рейтинге.
  if (s.why) {
    const note = s.rating_note ? `\n\n⚠️ ${s.rating_note}` : ''
    return `${SPOT_INTRO}${s.why}${note}`
  }
  const src = s.source === 'yandex' ? 'Яндекс.Карты' : s.source === 'google' ? 'Google' : 'TripAdvisor'
  return `${SPOT_INTRO}${s.desc}\n\n★ ${src} ${s.rating} (${s.reviews}+ отзывов).`
}

async function processQuest(questId, spots) {
  const bundle = await apiGet(`/api/quests/by-quest-id/${encodeURIComponent(questId)}/`)
  const questDbId = bundle.id
  const existing = (typeof bundle.steps === 'string' ? JSON.parse(bundle.steps) : bundle.steps || []).slice()
  const existingIds = new Set(existing.map((s) => s.step_id))
  const candidates = existing.filter((s) => !isIntro(s)) // куда крепить (по близости)

  // 1) Создаём недостающие точки (временный order в диапазоне 5000+).
  const created = []
  let tmp = 5000
  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i]
    const stepId = i === 0 ? 'spot' : `spot-${i + 1}`
    if (existingIds.has(stepId)) {
      console.log(`  · ${questId}: «${spot.name}» (${stepId}) уже есть — пропуск`)
      continue
    }
    // ближайшая существующая точка
    let nearest = candidates[0]
    let best = Infinity
    for (const c of candidates) {
      const d = haversine(spot.lat, spot.lng, Number(c.lat), Number(c.lng))
      if (d < best) {
        best = d
        nearest = c
      }
    }
    const res = await apiPost('/api/quest-steps/', {
      quest: questDbId,
      step_id: stepId,
      title: `✨ ${spot.name} (по желанию)`,
      location: spot.loc,
      story: buildStory(spot),
      task: SPOT_TASK,
      hint: null,
      answer_pattern: JSON.stringify({ type: 'any', value: '' }),
      lat: dec(spot.lat),
      lng: dec(spot.lng),
      maps_url: maps(dec(spot.lat), dec(spot.lng)),
      input_type: 'text',
      order: tmp++,
      is_intro: false,
    })
    created.push({ stepId, pk: res.id, spot, nearestPk: nearest && nearest.id, dist: Math.round(best), nearestTitle: (nearest && nearest.title) || '' })
  }
  if (!created.length) return { questId, added: 0 }

  // 2) Желаемая последовательность: существующие по order, после каждой —
  //    созданные точки, чья ближайшая == она (несколько — по возрастанию dist).
  const base = existing.slice().sort((a, b) => (a.order || 0) - (b.order || 0))
  const seq = []
  for (const s of base) {
    seq.push({ pk: s.id, cur: s.order || 0 })
    const attach = created.filter((c) => c.nearestPk === s.id).sort((a, b) => a.dist - b.dist)
    for (const c of attach) seq.push({ pk: c.pk, cur: null, isNew: true })
  }
  // 3) Переиндексация через временный диапазон (+10000), затем финальные order.
  const finals = seq.map((x, i) => ({ pk: x.pk, order: i, cur: x.cur }))
  const changed = finals.filter((f) => f.cur !== f.order)
  for (const f of [...changed].sort((a, b) => b.order - a.order)) await apiPatchOrder(f.pk, f.order + 10000)
  for (const f of changed) await apiPatchOrder(f.pk, f.order)

  for (const c of created) {
    const fin = finals.find((f) => f.pk === c.pk)
    console.log(`  ✅ ${questId}: «${spot_label(c.spot)}» order ${fin.order}, после «${c.nearestTitle.slice(0, 28)}» (${c.dist} м)`)
  }
  return { questId, added: created.length }
}
function spot_label(s) {
  return s.rating ? `✨ ${s.name} ★${s.rating}/${s.reviews}` : `✨ ${s.name} (культовое/историческое)`
}

async function main() {
  console.log(`Добавление атмосферных точек → ${API} (${isDryRun ? 'DRY RUN' : 'LIVE'})\n`)
  let total = 0
  for (const [questId, spots] of Object.entries(SPOTS)) {
    try {
      const r = await processQuest(questId, spots)
      total += r.added
    } catch (e) {
      console.error(`  ❌ ${questId}: ${e.message}`)
    }
  }
  console.log(`\nДобавлено точек: ${total}`)
}

main().catch((e) => {
  console.error('Fatal:', e.message || e)
  process.exit(1)
})
