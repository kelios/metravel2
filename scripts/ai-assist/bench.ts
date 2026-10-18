/**
 * Замер metravel-assist: латентность POST /ai/search (p50/p95/max по клиенту и по took_ms),
 * RSS после прогона из /ai/health, доля 503 busy при параллельных запросах.
 *
 *   npm run ai:assist:bench -- --url http://127.0.0.1:8787 --n 1000            # один поток, мимо кэша
 *   npm run ai:assist:bench -- --n 20 --concurrency 20                          # очередь и busy
 *
 * Запросы уникальны (суффикс-номер), поэтому кэш ответов не срабатывает и измеряется модель.
 */
import { percentile } from '../ai-index/query.ts'

const BASE_QUERIES = [
  'однодневная вылазка из Кракова с собакой',
  'замки под Краковом на день',
  'куда поехать с детьми на выходные под Минском',
  'квест по Гродно для семьи',
  'горы в Польше без толп осенью',
  'маршрут по Татрам на два дня',
  'термальные источники рядом с Закопане',
  'что посмотреть в Вильнюсе за выходные',
  'рождественские ярмарки в Польше',
  'велосипедный маршрут вдоль Немана',
  'тихое озеро для палатки в Беларуси',
  'пешеходный квест по Бресту',
  'средневековые города Словакии',
  'зимний поход в Карпаты',
  'где увидеть зубров',
  'Беловежская пуща с детьми',
  'соляная шахта Величка советы',
  'смотровые площадки Кракова',
  'куда съездить из Варшавы на один день',
  'пещеры и скалы Ойцувского парка',
  'квесты для детей в Минске',
  'замки Беларуси за два дня на машине',
  'путешествие по Европе на машине с собакой',
  'старинные усадьбы под Гродно',
  'лучшее время для поездки в Татры',
  'бюджетный отдых на Балтике',
  'что посмотреть в Гданьске',
  'маршрут выходного дня из Белостока',
  'монастыри и костёлы Полесья',
  'треккинг для новичков рядом с Краковом',
]

interface Flags {
  url: string
  n: number
  concurrency: number
  locale: string
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { url: 'http://127.0.0.1:8787', n: 1000, concurrency: 1, locale: 'ru' }
  for (let i = 0; i < argv.length; i += 1) {
    const [name, inline] = argv[i].replace(/^--/, '').split('=')
    const value = inline ?? argv[++i]
    if (name === 'url') flags.url = value
    else if (name === 'n') flags.n = Number(value)
    else if (name === 'concurrency') flags.concurrency = Number(value)
    else if (name === 'locale') flags.locale = value
  }
  return flags
}

async function health(url: string): Promise<Record<string, unknown>> {
  return (await (await fetch(`${url}/ai/health`)).json()) as Record<string, unknown>
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2))
  const before = await health(flags.url)
  const clientMs: number[] = []
  const tookMs: number[] = []
  const statuses = new Map<number, number>()
  let degraded = 0
  let next = 0
  const started = Date.now()

  const worker = async () => {
    for (;;) {
      const i = next++
      if (i >= flags.n) return
      const q = `${BASE_QUERIES[i % BASE_QUERIES.length]} ${i}`
      const t0 = process.hrtime.bigint()
      const response = await fetch(`${flags.url}/ai/search`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ q, locale: flags.locale }),
      })
      const body = (await response.json()) as { took_ms?: number; degraded?: boolean }
      statuses.set(response.status, (statuses.get(response.status) ?? 0) + 1)
      if (response.status === 200) {
        clientMs.push(Number(process.hrtime.bigint() - t0) / 1e6)
        if (typeof body.took_ms === 'number') tookMs.push(body.took_ms)
        if (body.degraded) degraded += 1
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, flags.concurrency) }, worker))
  const after = await health(flags.url)

  const summary = {
    url: flags.url,
    requests: flags.n,
    concurrency: flags.concurrency,
    wall_s: Math.round((Date.now() - started) / 100) / 10,
    statuses: Object.fromEntries(statuses),
    degraded,
    client_ms: { p50: Math.round(percentile(clientMs, 50)), p95: Math.round(percentile(clientMs, 95)), max: Math.round(percentile(clientMs, 100)) },
    took_ms: { p50: Math.round(percentile(tookMs, 50)), p95: Math.round(percentile(tookMs, 95)), max: Math.round(percentile(tookMs, 100)) },
    rss_mb: { before: before.rss_mb, after: after.rss_mb },
    heap_mb: { before: before.heap_mb, after: after.heap_mb },
  }
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error))
  process.exit(1)
})
