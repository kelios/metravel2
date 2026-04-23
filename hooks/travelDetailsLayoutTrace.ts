type TdTrace = (event: string, data?: unknown) => void

export function startTravelDetailsLayoutTrace(tdTrace: TdTrace) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {}
  }

  const selectors = [
    ['skeleton', '[data-testid="travel-details-skeleton-overlay"]'],
    ['sidebar', '[data-testid="travel-details-side-menu"]'],
    ['hero', '[data-testid="travel-details-hero-slider-container"]'],
    ['heroImage', 'img[data-lcp]'],
    ['sectionsSheet', '[data-testid="travel-sections-sheet-wrapper"]'],
  ] as const

  const rectCache = new Map<string, string>()
  const startedAt = Date.now()
  const perf = window.performance
  let intervalId: ReturnType<typeof setInterval> | null = null
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let observer: PerformanceObserver | null = null

  const formatRect = (el: Element | null) => {
    if (!el || typeof (el as HTMLElement).getBoundingClientRect !== 'function') return 'missing'
    const rect = (el as HTMLElement).getBoundingClientRect()
    return [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)].join(':')
  }

  const sample = () => {
    for (const [label, selector] of selectors) {
      const next = formatRect(document.querySelector(selector))
      if (rectCache.get(label) === next) continue
      rectCache.set(label, next)
      tdTrace(`layout:${label}`, next)
    }
  }

  sample()
  intervalId = setInterval(sample, 180)
  timeoutId = setTimeout(() => {
    if (intervalId) clearInterval(intervalId)
    intervalId = null
  }, 6000)

  if (typeof PerformanceObserver !== 'undefined') {
    try {
      observer = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries() as Array<
          PerformanceEntry & { value?: number; hadRecentInput?: boolean; sources?: Array<{ node?: Node | null }> }
        >) {
          if (!entry || entry.hadRecentInput) continue
          const sourceNames = Array.isArray(entry.sources)
            ? entry.sources
                .map((source) => {
                  const node = source?.node as HTMLElement | null
                  if (!node) return null
                  return node.getAttribute?.('data-testid') || node.id || node.tagName?.toLowerCase() || null
                })
                .filter(Boolean)
            : []

          tdTrace('layout:shift', {
            value: entry.value ?? null,
            sources: sourceNames,
            sinceMountMs: Date.now() - startedAt,
            sinceNavigationMs: typeof perf?.now === 'function' ? Math.round(perf.now()) : null,
          })
        }
      })
      observer.observe({ type: 'layout-shift', buffered: true })
    } catch {
      observer = null
    }
  }

  return () => {
    if (intervalId) clearInterval(intervalId)
    if (timeoutId) clearTimeout(timeoutId)
    observer?.disconnect()
  }
}
