/**
 * scripts/lib/concurrency.js
 * Ограниченный по параллелизму обход списка для операторских скриптов.
 *
 * Прод одноядерный: на восьми параллельных запросах он начинает отвечать 503
 * `capacity-rejected` (замер 2026-08-05), то есть проверка роняет саму себя своей
 * же нагрузкой. Потолок задаёт вызывающий, а форма обхода одна на всех — вторая
 * её копия неизбежно разойдётся по обработке ошибок и порядку результатов.
 */

/**
 * Прогон задач с ограничением параллелизма; порядок результатов сохраняется.
 *
 * @param {any[]} items
 * @param {number} limit максимум одновременных задач
 * @param {(item: any, index: number) => Promise<any>} worker
 */
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index], index)
    }
  })
  await Promise.all(runners)
  return results
}

module.exports = { mapWithConcurrency }
