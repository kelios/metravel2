/**
 * Reusable performance-budget collectors for Playwright perf specs.
 *
 * Extracted so multiple page specs (travel, home, search, map, places) can
 * measure Core Web Vitals and network transfer the same way. Mirrors the
 * measurement approach used in `e2e/travel-details-perf-budget.spec.ts`.
 *
 * Metrics via the browser Performance API + PerformanceObserver:
 *   - LCP (Largest Contentful Paint)
 *   - FCP (First Contentful Paint)
 *   - CLS (Cumulative Layout Shift)
 *   - TBT proxy (sum of long-task time over 50ms)
 */

import { isMediaRequestWithoutWidth } from './mediaRequestWidth'
import { preacceptCookies } from './navigation'

export { isMediaRequestWithoutWidth }

/** Inject PerformanceObserver collectors before page load + pre-accept cookies. */
export async function injectPerfObservers(page: any) {
  await preacceptCookies(page)
  await page.addInitScript(() => {
    const w = window as any
    w.__perfBudget = {
      lcp: null as number | null,
      fcp: null as number | null,
      cls: 0,
      clsAfterReady: 0,
      clsPhase: 'total',
      longTasks: [] as number[],
    }

    w.__perfBudget.clsSources = []
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (entry && !entry.hadRecentInput && typeof entry.value === 'number') {
            w.__perfBudget.cls += entry.value
            if (w.__perfBudget.clsPhase === 'afterReady') {
              w.__perfBudget.clsAfterReady += entry.value
            }
            try {
              const sources = Array.isArray(entry.sources) ? entry.sources : []
              const fingerprints = sources
                .map((s: any) => {
                  const el = s?.node as Element | null
                  if (!el || !el.tagName) return null
                  const tag = el.tagName.toLowerCase()
                  const tid = (el as any).getAttribute?.('data-testid') || ''
                  // #1287/#1298: RNW-классы вида `r-1otgn73` генерируются сборкой
                  // и меняются от билда к билду, поэтому запрещённые узлы шапки
                  // опознаём по стабильным data-хукам, а не по классу.
                  const markers = ['data-header-logo-image', 'data-header-logo-wordmark']
                    .filter((name) => (el as any).getAttribute?.(name))
                    .map((name) => `[${name}]`)
                    .join('')
                  const cls = ((el as any).getAttribute?.('class') || '')
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .join('.')
                  const aria = (el as any).getAttribute?.('aria-label') || ''
                  const pr = s?.previousRect
                  const cr = s?.currentRect
                  const move =
                    pr && cr ? ` (y ${Math.round(pr.y)}→${Math.round(cr.y)}, h ${Math.round(cr.height)})` : ''
                  return `${tag}${tid ? `[testid=${tid}]` : ''}${markers}${aria ? `[aria=${aria.slice(0, 40)}]` : ''}${cls ? `.${cls}` : ''}${move}`
                })
                .filter(Boolean)
              w.__perfBudget.clsSources.push({ value: entry.value, sources: fingerprints })
            } catch {
              /* ignore source extraction */
            }
          }
        }
      }).observe({ type: 'layout-shift', buffered: true } as any)
    } catch {
      /* unsupported */
    }

    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const last = entries[entries.length - 1] as any
        if (last && typeof last.startTime === 'number') {
          w.__perfBudget.lcp = last.startTime
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true } as any)
    } catch {
      /* unsupported */
    }

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            w.__perfBudget.longTasks.push(entry.duration)
          }
        }
      }).observe({ type: 'longtask', buffered: true } as any)
    } catch {
      /* unsupported */
    }
  })
}

export async function beginPostReadyClsCollection(page: any) {
  await page
    .evaluate(() => {
      const w = window as any
      if (!w.__perfBudget) return
      w.__perfBudget.clsPhase = 'afterReady'
      w.__perfBudget.clsAfterReady = 0
    })
    .catch(() => null)
}

export type PerfMetrics = {
  lcp: number | null
  fcp: number | null
  cls: number
  clsAfterReady: number
  tbt: number
  longTaskCount: number
  clsSources: Array<{ value: number; sources: string[] }>
}

export async function collectMetrics(page: any): Promise<PerfMetrics> {
  await page.waitForLoadState('networkidle').catch(() => null)

  return page.evaluate(() => {
    const w = window as any
    const pb = w.__perfBudget || {}

    const paintEntries = performance.getEntriesByType('paint')
    const fcpEntry = paintEntries.find((e: any) => e.name === 'first-contentful-paint')
    const fcp = fcpEntry ? (fcpEntry as any).startTime : null

    const longTasks: number[] = pb.longTasks || []
    const tbt = longTasks.reduce((sum: number, d: number) => sum + Math.max(0, d - 50), 0)

    const clsSources = Array.isArray(pb.clsSources)
      ? pb.clsSources
          .filter((e: any) => e && typeof e.value === 'number')
          .sort((a: any, b: any) => b.value - a.value)
          .slice(0, 5)
      : []

    return {
      lcp: typeof pb.lcp === 'number' ? pb.lcp : null,
      fcp: typeof fcp === 'number' ? fcp : null,
      cls: typeof pb.cls === 'number' ? pb.cls : 0,
      clsAfterReady: typeof pb.clsAfterReady === 'number' ? pb.clsAfterReady : 0,
      tbt,
      longTaskCount: longTasks.length,
      clsSources,
    }
  })
}

export type ObservedProfile = {
  viewportWidth: number
  viewportHeight: number
  devicePixelRatio: number
  hasTouch: boolean
  coarsePointer: boolean
  mobileUserAgent: boolean
}

/**
 * Что браузер на самом деле показал. Прежний гейт «делал мобильный» через
 * `setViewportSize`, то есть мерил desktop-характеристики в узком боксе — это
 * и есть класс дефекта #1287. Отчёт обязан назвать наблюдаемый профиль, чтобы
 * запрошенный и фактический нельзя было перепутать.
 */
export async function collectObservedProfile(page: any): Promise<ObservedProfile> {
  return page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    mobileUserAgent: /Android|Mobile/i.test(navigator.userAgent),
  }))
}

/**
 * Элементы, чей бокс пересекает первый экран на момент готовности и до любого
 * скролла. Нулевые и нерисуемые боксы не считаются: они ничего не стоят
 * ни рендереру, ни пользователю.
 */
export async function collectFirstScreenElements(page: any): Promise<{
  firstScreenElements: number
  documentElements: number
}> {
  return page.evaluate(() => {
    const all = document.querySelectorAll('*')
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth
    let firstScreen = 0

    for (const element of Array.from(all)) {
      const rect = element.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) continue
      if (rect.bottom <= 0 || rect.top >= viewportHeight) continue
      if (rect.right <= 0 || rect.left >= viewportWidth) continue
      firstScreen += 1
    }

    return { firstScreenElements: firstScreen, documentElements: all.length }
  })
}

export type NetworkStats = {
  totalKB: number
  jsKB: number
  imgKB: number
  cssKB: number
  fontKB: number
  otherKB: number
  requestCount: number
  allRequestCount: number
  ignoredThirdPartyRequestCount: number
  ignoredBudgetRequestCount: number
  jsRequests: number
  imgRequests: number
  largestResources: Array<{ url: string; sizeKB: number; type: string }>
  /**
   * #1161: медиа-запросы, ушедшие без параметра `w`. Прокси на такой запрос отдаёт
   * мастер целиком — замер прода 2026-07-30 на
   * `travel-image/682/conversions/10f0a8f2….webp`: 132 344 B без параметров против
   * 2 582 B на `?w=96`. Должно быть пусто на всех страницах.
   */
  mediaRequestsWithoutWidth: string[]
}

export type NetworkTrackerOptions = {
  ignoreBudgetRequest?: (url: string) => boolean
}

const REQUEST_BUDGET_HOSTS = new Set(
  (process.env.PERF_REQUEST_BUDGET_HOSTS ??
    '127.0.0.1,localhost,images.weserv.nl,metravellocal.s3.amazonaws.com,metravelprod.s3.eu-north-1.amazonaws.com')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
)

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

function isPrivateOrLocalHost(host: string): boolean {
  if (!host) return false
  if (host === 'localhost' || host === '::1' || host.endsWith('.local')) return true
  if (/^127\.\d+\.\d+\.\d+$/.test(host)) return true
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return true
  return false
}

function shouldCountForRequestBudget(url: string): boolean {
  const host = hostFromUrl(url)
  if (!host) return true
  if (REQUEST_BUDGET_HOSTS.has(host)) return true
  if (isPrivateOrLocalHost(host)) return true
  return false
}

export function createNetworkTracker(page: any, options: NetworkTrackerOptions = {}): { getStats: () => NetworkStats } {
  const resources: Array<{ url: string; size: number; type: string }> = []
  const mediaRequestsWithoutWidth = new Set<string>()
  let allRequestCount = 0
  let requestCount = 0
  let ignoredThirdPartyRequestCount = 0
  let ignoredBudgetRequestCount = 0

  page.on('response', (response: any) => {
    allRequestCount++
    try {
      const req = response.request()
      const type = req.resourceType()
      const url = req.url()
      if (options.ignoreBudgetRequest?.(url)) {
        ignoredBudgetRequestCount++
      } else if (shouldCountForRequestBudget(url)) {
        requestCount++
      } else {
        ignoredThirdPartyRequestCount++
      }

      if (isMediaRequestWithoutWidth(url)) {
        mediaRequestsWithoutWidth.add(url)
      }

      const contentLength = response.headers()['content-length']
      const size = contentLength ? parseInt(contentLength, 10) : 0
      if (size > 0) {
        resources.push({ url, size, type })
      }
    } catch {
      /* ignore */
    }
  })

  return {
    getStats(): NetworkStats {
      let jsKB = 0,
        imgKB = 0,
        cssKB = 0,
        fontKB = 0,
        otherKB = 0
      let jsRequests = 0,
        imgRequests = 0

      for (const r of resources) {
        const kb = r.size / 1024
        switch (r.type) {
          case 'script':
            jsKB += kb
            jsRequests++
            break
          case 'image':
            imgKB += kb
            imgRequests++
            break
          case 'stylesheet':
            cssKB += kb
            break
          case 'font':
            fontKB += kb
            break
          default:
            otherKB += kb
        }
      }

      const totalKB = jsKB + imgKB + cssKB + fontKB + otherKB
      const sorted = [...resources].sort((a, b) => b.size - a.size)
      const largestResources = sorted.slice(0, 10).map((r) => ({
        url: r.url.length > 120 ? r.url.slice(0, 117) + '...' : r.url,
        sizeKB: Math.round(r.size / 1024),
        type: r.type,
      }))

      return {
        totalKB: Math.round(totalKB),
        jsKB: Math.round(jsKB),
        imgKB: Math.round(imgKB),
        cssKB: Math.round(cssKB),
        fontKB: Math.round(fontKB),
        otherKB: Math.round(otherKB),
        requestCount,
        allRequestCount,
        ignoredThirdPartyRequestCount,
        ignoredBudgetRequestCount,
        jsRequests,
        imgRequests,
        largestResources,
        mediaRequestsWithoutWidth: [...mediaRequestsWithoutWidth],
      }
    },
  }
}

/* ------------------------------------------------------------------ */
/*  Mobile emulation profile (#1499)                                    */
/* ------------------------------------------------------------------ */

/**
 * Единственное определение «мобильного профиля» для перф-гейтов.
 *
 * До #1499 каждый гейт эмулировал мобиль по-своему: travel-details менял только
 * вьюпорт и не троттлил вовсе, pages-гейт включал CPU ×4 без сети. Числа TBT из
 * разных гейтов были несравнимы, а «мобильный» бюджет travel-details мерил
 * скорость десктопа и показывал 53 мс там, где прод отдавал 1116/517 мс.
 *
 * Значения — mobile-профиль Lighthouse (devtools throttling): CPU ×4, Slow-4G.
 * Стенд гейта (`scripts/serve-web-build.js`) отдаёт `.js/.css/.html` gzip'ом,
 * поэтому занижать троттлинг «под несжатый dist» не нужно — байты на проводе
 * того же порядка, что на проде.
 */
export const MOBILE_THROTTLE_PROFILE = {
  cpuRate: 4,
  downloadMbit: 1.6,
  uploadKbit: 750,
  latencyMs: 150,
} as const

export type ThrottleProfile = typeof MOBILE_THROTTLE_PROFILE

/** CPU-троттлинг без сетевой эмуляции — для гейтов, меряющих только главный поток. */
export async function applyCpuThrottling(page: any, rate: number) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate })
  return cdp
}

/** CPU + сеть по мобильному профилю. */
export async function applyMobileThrottling(
  page: any,
  profile: ThrottleProfile = MOBILE_THROTTLE_PROFILE,
) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: profile.latencyMs,
    downloadThroughput: (profile.downloadMbit * 1024 * 1024) / 8,
    uploadThroughput: (profile.uploadKbit * 1024) / 8,
  })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuRate })
  return cdp
}

/**
 * Позитивный контроль: троттлинг действительно применён к ЭТОЙ странице.
 *
 * Без него гейт вырождается в вечнозелёный ровно тем же способом, каким это
 * уже случилось в #1499: если эмуляция перестанет доезжать до рендерера (смена
 * версии Chromium/Playwright, отвалившаяся CDP-сессия), TBT вернётся к
 * десктопным десяткам миллисекунд и ни один ассерт этого не заметит.
 *
 * Меряем фиксированный busy-loop сначала без троттлинга, затем с ним, и
 * возвращаем наблюдаемое отношение. Абсолютные числа зависят от машины,
 * отношение — нет.
 */
export async function measureCpuThrottlingRatio(
  page: any,
  cdp: any,
  rate: number,
): Promise<number> {
  // Сессию обязан передать вызывающий — ТУ ЖЕ, через которую троттлинг включён.
  // Отдельная `newCDPSession` эмуляцию первой не переопределяет: замер тогда
  // идёт при уже включённом троттлинге в обеих фазах и даёт отношение ≈1,
  // то есть контроль ложно объявляет троттлинг сломанным (проверено 2026-08-23:
  // ratio 1.11 при заведомо работающей эмуляции).
  // 40M итераций, а не 4M: на коротком цикле замер тонет в JIT-разогреве и
  // накладных расходах протокола — проверено 2026-08-23, 4M давали отношение
  // 0.62 при заведомо работающей эмуляции, 40M дают 4.12 при rate=4.
  const bench = () =>
    page.evaluate(() => {
      const started = performance.now()
      let sink = 0
      for (let i = 0; i < 40_000_000; i += 1) sink += Math.sqrt(i)
      return { ms: performance.now() - started, sink }
    })

  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  const free = await bench()
  await cdp.send('Emulation.setCPUThrottlingRate', { rate })
  const throttled = await bench()

  return free.ms > 0 ? throttled.ms / free.ms : 0
}

/**
 * Медиана. Пустой набор — ошибка вызова, а не `NaN` в ассерте: гейт обязан
 * падать с внятной причиной, а не с «TBT NaNms exceeds budget».
 */
export function median(values: number[]): number {
  if (!values.length) throw new Error('median() got an empty sample — nothing was measured')
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}
