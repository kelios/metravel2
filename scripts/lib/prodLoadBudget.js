/**
 * scripts/lib/prodLoadBudget.js
 * Общий бюджет нагрузки операторских проверок на прод (#3160).
 *
 * Прод — один vCPU: SSR-рендер страниц, gunicorn API и nginx делят одно ядро.
 * Проверка, которая открывает больше параллельных запросов, чем ядро способно
 * обслужить, не ускоряется — она удлиняет очередь. Живые посетители и
 * Googlebot стоят в той же очереди, а сама проверка ловит 503 собственной
 * нагрузки.
 *
 * Потолок задаётся здесь, по классу запроса, а не числом в каждом скрипте:
 * так пост-деплойные проверки (`post-deploy-seo-check`, `post-deploy-media-check`,
 * `audit-article-body-media`) не могут разойтись, а флаг `--concurrency` не
 * поднимает нагрузку на прод выше бюджета. Для dev/локальных origin флаг
 * действует как есть.
 */

const PRODUCTION_HOSTS = new Set(['metravel.by', 'www.metravel.by'])

const PROD_LOAD_CEILINGS = Object.freeze({
  // Страница с SSR-рендером. Замер 09.11.2026 на 30 холодных статьях:
  // 3 потока — 4,7 с, p90 1,1 с; 12 потоков — 4,8 с, p90 4,1 с. Пропускная
  // способность та же, растёт только очередь; сразу после выката холодный
  // рендерер упирал очередь из 12 в `proxy_read_timeout 15s` nginx, и статьи
  // отдавались 503 (49 таймаутов 03–08.11.2026, UA пост-деплойной проверки).
  page: 3,
  // API и медиа-трансформации. На 8 прод отвечал 503 `capacity-rejected`
  // (замер 2026-08-05); 4 — проверенный потолок медиа-проверок.
  api: 4,
})

/** Прод ли это: потолок применяется только к нему. */
function isProductionOrigin(origin) {
  try {
    return PRODUCTION_HOSTS.has(new URL(String(origin)).hostname.toLowerCase())
  } catch {
    return false
  }
}

/**
 * Параллельность запросов класса `kind` к `origin`: запрошенное число, но для
 * прода не выше потолка класса.
 *
 * @param {string} origin
 * @param {number} requested
 * @param {'page' | 'api'} kind
 */
function prodSafeConcurrency(origin, requested, kind) {
  const ceiling = PROD_LOAD_CEILINGS[kind]
  if (!ceiling) throw new Error(`prodLoadBudget: unknown request kind "${kind}"`)
  const parsed = Math.floor(Number(requested))
  const value = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1
  return isProductionOrigin(origin) ? Math.min(value, ceiling) : value
}

module.exports = { PROD_LOAD_CEILINGS, isProductionOrigin, prodSafeConcurrency }
