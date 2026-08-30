import type { Page } from '@playwright/test'

export type TravelFooterLayoutShiftSourceGroup = 'footer' | 'upstream'

export type TravelFooterLayoutShiftSource = {
  currentRect: TravelFooterLayoutShiftRect
  group: TravelFooterLayoutShiftSourceGroup | null
  marker: string | null
  node: string
  previousRect: TravelFooterLayoutShiftRect
}

type TravelFooterLayoutShiftRect = {
  height: number
  width: number
  x: number
  y: number
}

export type TravelFooterLayoutShiftEntry = {
  footerSources: TravelFooterLayoutShiftSource[]
  sources: TravelFooterLayoutShiftSource[]
  upstreamSources: TravelFooterLayoutShiftSource[]
  value: number
}

export type TravelFooterLayoutShiftReport = {
  entries: TravelFooterLayoutShiftEntry[]
  footerEntries: TravelFooterLayoutShiftEntry[]
  footerValue: number
  totalValue: number
  upstreamEntries: TravelFooterLayoutShiftEntry[]
  upstreamValue: number
}

export async function installTravelFooterLayoutShiftGuard(page: Page) {
  await page.addInitScript(() => {
    type LayoutShiftSourceLike = {
      currentRect: DOMRectReadOnly
      node?: Node | null
      previousRect: DOMRectReadOnly
    }
    type LayoutShiftEntryLike = PerformanceEntry & {
      hadRecentInput: boolean
      sources?: LayoutShiftSourceLike[]
      value: number
    }

    const footerSelector = [
      '[data-testid^="travel-details-footer-transition"]',
      '[data-testid="travel-details-footer-resolved-frame"]',
      '[data-testid="travel-details-telegram"]',
      '[data-testid="travel-details-share"]',
      '[data-testid="travel-details-cta"]',
      '[data-testid="travel-details-email-subscribe"]',
      '[data-testid="footer-desktop-bar"]',
      '[data-testid="footer-dock-wrapper"]',
    ].join(',')
    const upstreamSelector = [
      '[data-testid^="travel-details-sidebar-transition"]',
      '[data-testid^="travel-details-comments-transition"]',
      '[data-testid="travel-details-near-loaded"]',
      '[data-section-key="comments"]',
    ].join(',')
    const targetSelector = `${footerSelector},${upstreamSelector}`

    // The group comes from the very selector that matched, so adding a surface
    // to `footerSelector`/`upstreamSelector` is enough — a second hand-kept list
    // of markers would silently drop shifts (a guard that fails open).
    const describeSource = (
      node: Node | null | undefined,
    ): { group: TravelFooterLayoutShiftSourceGroup | null; marker: string | null } => {
      const element = node instanceof Element ? node : node?.parentElement
      const marked = element
        ? element.matches(targetSelector)
          ? element
          : element.closest(targetSelector)
        : null
      if (!marked) return { group: null, marker: null }
      return {
        group: marked.matches(footerSelector) ? 'footer' : 'upstream',
        marker:
          marked.getAttribute('data-testid') ?? marked.getAttribute('data-section-key') ?? null,
      }
    }

    const nodeName = (node: Node | null | undefined) => {
      if (!(node instanceof Element)) return 'unknown'
      const testID = node.getAttribute('data-testid')
      return testID
        ? `${node.tagName.toLowerCase()}[data-testid="${testID}"]`
        : node.tagName.toLowerCase()
    }

    const rectSnapshot = (rect: DOMRectReadOnly) => ({
      height: rect.height,
      width: rect.width,
      x: rect.x,
      y: rect.y,
    })

    type GuardState = {
      available: boolean
      entries: TravelFooterLayoutShiftEntry[]
      observer: PerformanceObserver | null
      recordEntries: (entries: LayoutShiftEntryLike[]) => void
      resetAt: number
    }

    const state: GuardState = {
      available: false,
      entries: [],
      observer: null,
      recordEntries: () => undefined,
      resetAt: 0,
    }
    ;(window as typeof window & {
      __travelFooterLayoutShiftGuard?: GuardState
    }).__travelFooterLayoutShiftGuard = state

    state.recordEntries = (rawEntries) => {
      for (const rawEntry of rawEntries) {
        if (
          rawEntry.hadRecentInput ||
          typeof rawEntry.value !== 'number' ||
          rawEntry.startTime < state.resetAt
        ) {
          continue
        }
        const sources: TravelFooterLayoutShiftSource[] = (rawEntry.sources ?? []).map((source) => ({
          currentRect: rectSnapshot(source.currentRect),
          ...describeSource(source.node),
          node: nodeName(source.node),
          previousRect: rectSnapshot(source.previousRect),
        }))
        state.entries.push({
          footerSources: sources.filter((source) => source.group === 'footer'),
          sources,
          upstreamSources: sources.filter((source) => source.group === 'upstream'),
          value: rawEntry.value,
        })
      }
    }

    try {
      const observer = new PerformanceObserver((list) => {
        state.recordEntries(list.getEntries() as LayoutShiftEntryLike[])
      })
      observer.observe({ type: 'layout-shift', buffered: true } as PerformanceObserverInit)
      state.observer = observer
      state.available = true
    } catch {
      state.available = false
    }
  })
}

export async function resetTravelFooterLayoutShiftGuard(page: Page) {
  await page.evaluate(() => {
    const runtime = window as typeof window & {
      __travelFooterLayoutShiftGuard?: {
        available: boolean
        entries: TravelFooterLayoutShiftEntry[]
        observer: PerformanceObserver | null
        resetAt: number
      }
    }
    const guard = runtime.__travelFooterLayoutShiftGuard
    if (!guard?.available || !guard.observer) {
      throw new Error('travel footer Layout Instability observer is unavailable')
    }
    guard.observer.takeRecords()
    guard.entries.length = 0
    guard.resetAt = performance.now()
  })
}

export async function readTravelFooterLayoutShiftReport(
  page: Page,
): Promise<TravelFooterLayoutShiftReport> {
  return page.evaluate(() => {
    const runtime = window as typeof window & {
      __travelFooterLayoutShiftGuard?: {
        available: boolean
        entries: TravelFooterLayoutShiftEntry[]
        observer: PerformanceObserver | null
        recordEntries: (entries: PerformanceEntry[]) => void
      }
    }
    const guard = runtime.__travelFooterLayoutShiftGuard
    if (!guard?.available || !guard.observer) {
      throw new Error('travel footer Layout Instability observer is unavailable')
    }
    guard.recordEntries(guard.observer.takeRecords())

    const entries = guard.entries
    const footerEntries = entries.filter((entry) => entry.footerSources.length > 0)
    const upstreamEntries = entries.filter((entry) => entry.upstreamSources.length > 0)
    return {
      entries,
      footerEntries,
      footerValue: footerEntries.reduce((sum, entry) => sum + entry.value, 0),
      totalValue: entries.reduce((sum, entry) => sum + entry.value, 0),
      upstreamEntries,
      upstreamValue: upstreamEntries.reduce((sum, entry) => sum + entry.value, 0),
    }
  })
}
