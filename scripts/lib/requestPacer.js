/**
 * scripts/lib/requestPacer.js
 * Общий пейсер темпа для сборочных запросов в прод-API.
 *
 * Prod nginx держит `limit_req zone=api rate=30r/s burst=60 nodelay` по IP.
 * Генератор SEO-страниц (#1394) уже ходил не быстрее 8 req/s; пост-деплойный
 * аудит тел статей (#1966) тем же бюджетом не пользовался и выкачивал ~25 r/s —
 * единственный gunicorn-воркер уходил на переработку, аудит ловил 429.
 * Слот резервируется синхронно до await, чтобы параллельные воркеры не
 * прочитали одно и то же «сейчас» и не стартовали вместе.
 */

const BUILD_FETCH_RATE_PER_SEC = 8
const BUILD_FETCH_MIN_INTERVAL_MS = Math.ceil(1000 / BUILD_FETCH_RATE_PER_SEC)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Spread task starts at least `minIntervalMs` apart.
 *
 * The slot is reserved synchronously before the await, so concurrent workers
 * queue up instead of all reading the same "now" and starting together.
 */
function createRequestPacer(minIntervalMs, { now = Date.now, wait = sleep } = {}) {
  if (!minIntervalMs || minIntervalMs <= 0) return async () => {}
  let nextStartAt = 0
  return async () => {
    const current = now()
    const startAt = Math.max(current, nextStartAt)
    nextStartAt = startAt + minIntervalMs
    if (startAt > current) await wait(startAt - current)
  }
}

/**
 * Run async tasks with limited concurrency, an optional start-rate cap and an
 * optional early exit (`shouldStop`) for runs that are already doomed.
 */
async function batchAsync(items, concurrency, fn, { minIntervalMs = 0, now, wait, shouldStop } = {}) {
  const results = new Array(items.length)
  const pace = createRequestPacer(minIntervalMs, { now, wait })
  let idx = 0
  async function worker() {
    while (idx < items.length) {
      if (shouldStop && shouldStop()) break
      const i = idx++
      await pace()
      results[i] = await fn(items[i], i)
    }
  }
  const workers = []
  for (let w = 0; w < Math.min(concurrency, items.length); w++) {
    workers.push(worker())
  }
  await Promise.all(workers)
  return results
}

module.exports = {
  BUILD_FETCH_RATE_PER_SEC,
  BUILD_FETCH_MIN_INTERVAL_MS,
  createRequestPacer,
  batchAsync,
}
