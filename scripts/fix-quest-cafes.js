#!/usr/bin/env node
/**
 * Массовая замена/правка необязательных точек-кафе в квестах metravel.by.
 *
 * Основание — аудит существования кафе (июнь 2026, веб-проверка Яндекс/Google
 * Maps/2GIS/TripAdvisor, сверка координат по листингам):
 *  - ЗАКРЫТЫ: Славянское (Витебск, с 2023), Vashi Guli (Лида, 11.2024),
 *    Fuego (Познань).
 *  - НЕ НАЙДЕНЫ под исходным именем: Чёрная кошка белый кот (Минск),
 *    Территория директ (Могилёв), кавярня у парка (Прокоцим).
 *  - Устарело имя: Cafe Panorama (Вроцлав) → Bulwar Bistro & Cafe (та же точка).
 *  - Опечатка: Гданьск «Caffee» → «Caffe» (заведение работает, координаты те же).
 *  - Функционально не подходит: Мята Lounge (Гомель) — кальянная с 17:00 →
 *    дневная кофейня Coffee&Toast.
 *
 * Каждая замена — действующее кафе у нужной точки, координаты из карт-листингов.
 *
 * Запуск:
 *   node scripts/fix-quest-cafes.js --dry-run
 *   node scripts/fix-quest-cafes.js --api-url=https://metravel.by
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

async function apiPatch(endpoint, payload) {
  if (isDryRun) {
    console.log(`  [DRY] PATCH ${endpoint}`, JSON.stringify(payload).slice(0, 160))
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

const INTRO =
  'Необязательная остановка — для удовольствия, а не для загадок. Лучшие открытия в путешествии часто случаются за чашкой кофе.\n\n'
const OUTRO = '\n\nЗагляни, переведи дух, обсуди увиденное — а потом продолжай маршрут (или заверши прогулку здесь).'
const TASK = 'Необязательная точка ☕. Просто сделай паузу: выпей кофе и отметься, когда будешь готов. Можно и пропустить.'

function maps(lat, lng) {
  return `https://maps.google.com/?q=${lat},${lng}`
}

// pk → правки. lat/lng строками (как принимает бэк).
const FIXES = {
  // Витебск — закрылось «Славянское» → «Кофейня» у Ратуши (с 2006)
  219: {
    title: '☕ Кофейня (по желанию)',
    location: 'Кофейня, ул. Суворова, 2 (у Ратуши)',
    story:
      INTRO +
      'Рядом, у старой витебской Ратуши, работает «Кофейня» — одна из старейших в городе (с 2006 года), с фирменными десертами и хорошим кофе.' +
      OUTRO,
    task: TASK,
    lat: '55.195291',
    lng: '30.205635',
    maps_url: maps('55.195291', '30.205635'),
  },
  // Лида — закрылось «Vashi Guli» → «Central Coffee House» (Советская, 19)
  222: {
    title: '☕ Central Coffee House (по желанию)',
    location: 'Central Coffee House, ул. Советская, 19',
    story:
      INTRO +
      'Недалеко, на улице Советской в центре Лиды, тебя ждёт «Central Coffee House» — уютная дневная кофейня (9:00–23:00) со свежей выпечкой.' +
      OUTRO,
    task: TASK,
    lat: '53.893820',
    lng: '25.302487',
    maps_url: maps('53.893820', '25.302487'),
  },
  // Минск — «Чёрная кошка, белый кот» не найдено → «Перспектива.кофе» (Зыбицкая, 2)
  215: {
    title: '☕ Перспектива.кофе (по желанию)',
    location: 'Перспектива.кофе, ул. Зыбицкая, 2',
    story:
      INTRO +
      'В двух шагах, на Зыбицкой в Верхнем городе, работает спешелти-кофейня «Перспектива.кофе» — отличное место перевести дух в самом сердце старого Минска.' +
      OUTRO,
    task: TASK,
    lat: '53.905684',
    lng: '27.560300',
    maps_url: maps('53.905684', '27.560300'),
  },
  // Могилёв — «Территория директ» не найдено → «FamCoffee» (Ленинская, 38)
  220: {
    title: '☕ FamCoffee (по желанию)',
    location: 'FamCoffee, ул. Ленинская, 38',
    story:
      INTRO +
      'На пешеходной Ленинской работает «FamCoffee» — приятная городская кофейня со свежей выпечкой и хорошим кофе.' +
      OUTRO,
    task: TASK,
    lat: '53.901000',
    lng: '30.339200',
    maps_url: maps('53.901000', '30.339200'),
  },
  // Гомель — «Мята Lounge» (кальянная с 17:00) → дневная «Coffee&Toast» (просп. Ленина, 10)
  227: {
    title: '☕ Coffee&Toast (по желанию)',
    location: 'Coffee&Toast, просп. Ленина, 10',
    story:
      INTRO +
      'Рядом с площадью Ленина и дворцом Румянцевых-Паскевичей работает «Coffee&Toast» — дневная кофейня, открыта с самого утра (с 7:00).' +
      OUTRO,
    task: TASK,
    lat: '52.425111',
    lng: '31.008199',
    maps_url: maps('52.425111', '31.008199'),
  },
  // Познань — закрылось «Fuego» → «LAGACCA Cafe» (Woźna 21, у Старого Рынка)
  231: {
    title: '☕ LAGACCA Cafe (по желанию)',
    location: 'LAGACCA Cafe, ul. Woźna 21',
    story:
      INTRO +
      'Прямо у Старого Рынка, на улице Woźna, работает «LAGACCA Cafe» — одна из лучших кофеен Познани с собственной обжаркой кофе.' +
      OUTRO,
    task: TASK,
    lat: '52.407940',
    lng: '16.935571',
    maps_url: maps('52.407940', '16.935571'),
  },
  // Вроцлав — «Cafe Panorama» устарело → «Bulwar Bistro & Cafe» (та же набережная)
  228: {
    title: '☕ Bulwar Bistro & Cafe (по желанию)',
    location: 'Bulwar Bistro & Cafe, bulwar Xawerego Dunikowskiego',
    story:
      INTRO +
      'На бульваре Дуниковского, у самой воды напротив Тумского острова, работает «Bulwar Bistro & Cafe» — кофе и завтраки с видом на Одру (открыто с 11:00, летняя терраса).' +
      OUTRO,
    task: TASK,
    lat: '51.112330',
    lng: '17.042900',
    maps_url: maps('51.112330', '17.042900'),
  },
  // Гданьск — только опечатка в названии: «Caffee» → «Caffe». Координаты не трогаем.
  229: {
    title: '☕ Ratuszowa Caffe Cocktails (по желанию)',
    location: 'Ratuszowa Caffe Cocktails',
  },
  // Прокоцим (Краков) — нет кафе у точки в парке → «Społeczna Kaffka» (Na Kozłówce 25).
  // Старый формат точки (bonus-cafe, «Сладкая пауза») — сохраняем тон.
  92: {
    title: 'Сладкая пауза',
    location: 'Społeczna Kaffka, ul. Na Kozłówce 25',
    story:
      'Иногда история проявляется не в камне или деревьях, а в простых радостях. У западного края парка работает «Społeczna Kaffka» — маленькая социальная кофейня, где трудятся люди с синдромом Дауна. Здесь варят хороший кофе и пекут домашние сладости (будни, 10:00–17:00).',
    task: 'Никаких загадок — просто сделай паузу, выпей кофе и насладись моментом.',
    lat: '50.018920',
    lng: '19.982364',
    maps_url: maps('50.018920', '19.982364'),
  },
}

async function main() {
  console.log(`Правка точек-кафе в квестах → ${API} (${isDryRun ? 'DRY RUN' : 'LIVE'})\n`)
  let ok = 0
  for (const [pk, payload] of Object.entries(FIXES)) {
    try {
      await apiPatch(`/api/quest-steps/${pk}/`, payload)
      console.log(`  OK pk ${pk} → «${payload.title}»` + (payload.lat ? ` @ ${payload.lat},${payload.lng}` : ' (только текст)'))
      ok++
    } catch (e) {
      console.error(`  ❌ pk ${pk}: ${e.message}`)
    }
  }
  console.log(`\nГотово: ${ok}/${Object.keys(FIXES).length}`)
}

main().catch((e) => {
  console.error('Fatal:', e.message || e)
  process.exit(1)
})
