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

import { preacceptCookies } from './navigation'

export function envNum(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const v = Number(raw)
  return Number.isFinite(v) ? v : fallback
}

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
                  return `${tag}${tid ? `[testid=${tid}]` : ''}${aria ? `[aria=${aria.slice(0, 40)}]` : ''}${cls ? `.${cls}` : ''}${move}`
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
  jsRequests: number
  imgRequests: number
  largestResources: Array<{ url: string; sizeKB: number; type: string }>
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

export function createNetworkTracker(page: any): { getStats: () => NetworkStats } {
  const resources: Array<{ url: string; size: number; type: string }> = []
  let allRequestCount = 0
  let requestCount = 0
  let ignoredThirdPartyRequestCount = 0

  page.on('response', (response: any) => {
    allRequestCount++
    try {
      const req = response.request()
      const type = req.resourceType()
      const url = req.url()
      if (shouldCountForRequestBudget(url)) {
        requestCount++
      } else {
        ignoredThirdPartyRequestCount++
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
        jsRequests,
        imgRequests,
        largestResources,
      }
    },
  }
}
