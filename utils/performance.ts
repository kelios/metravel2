/**
 * Утилиты для оптимизации производительности
 */

const pendingScriptLoads = new Map<string, Promise<void>>()
const pendingStyleLoads = new Map<string, Promise<void>>()

const getScriptKey = (src: string, id?: string) => id ?? src
const getStylesheetKey = (href: string, id?: string) => id ?? href

/**
 * Отложенная загрузка скрипта
 */
export function loadScriptDeferred(src: string, id?: string): Promise<void> {
  if (typeof document === 'undefined') {
    return Promise.resolve()
  }

  const key = getScriptKey(src, id)
  const existingScript =
    (id && document.getElementById(id)) ||
    document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)

  if (existingScript) {
    return Promise.resolve()
  }

  const pending = pendingScriptLoads.get(key)
  if (pending) {
    return pending
  }

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.defer = true
    if (id) script.id = id

    const cleanup = () => {
      pendingScriptLoads.delete(key)
    }

    script.onload = () => {
      cleanup()
      resolve()
    }
    script.onerror = () => {
      cleanup()
      script.remove()
      reject(new Error(`Failed to load script: ${src}`))
    }

    const append = () => {
      document.head.appendChild(script)
    }

    if ('requestIdleCallback' in window) {
      ;(window as any).requestIdleCallback(append)
    } else {
      setTimeout(append, 2000)
    }
  })

  pendingScriptLoads.set(key, promise)

  return promise
}

/**
 * Отложенная загрузка стилей
 */
export function loadStylesheetDeferred(href: string, id?: string): Promise<void> {
  if (typeof document === 'undefined') {
    return Promise.resolve()
  }

  const key = getStylesheetKey(href, id)
  const existingLink =
    (id && document.getElementById(id)) ||
    document.querySelector<HTMLLinkElement>(`link[href="${href}"]`)

  if (existingLink) {
    return Promise.resolve()
  }

  const pending = pendingStyleLoads.get(key)
  if (pending) {
    return pending
  }

  const promise = new Promise<void>((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    if (id) link.id = id

    const cleanup = () => {
      pendingStyleLoads.delete(key)
    }

    link.onload = () => {
      cleanup()
      resolve()
    }
    link.onerror = () => {
      cleanup()
      link.remove()
      reject(new Error(`Failed to load stylesheet: ${href}`))
    }

    const append = () => {
      document.head.appendChild(link)
    }

    if ('requestIdleCallback' in window) {
      ;(window as any).requestIdleCallback(append)
    } else {
      setTimeout(append, 2000)
    }
  })

  pendingStyleLoads.set(key, promise)

  return promise
}

/**
 * Preload ресурса
 */
export function preloadResource(
  href: string,
  as: 'image' | 'script' | 'style' | 'font' | 'fetch',
  type?: string,
  crossorigin?: 'anonymous' | 'use-credentials'
): void {
  if (typeof document === 'undefined') return

  const link = document.createElement('link')
  link.rel = 'preload'
  link.href = href
  link.as = as
  if (type) link.type = type
  if (crossorigin) link.crossOrigin = crossorigin

  document.head.appendChild(link)
}

/**
 * Prefetch ресурса
 */
export function prefetchResource(href: string, as: 'image' | 'script' | 'style' | 'font'): void {
  if (typeof document === 'undefined') return

  const link = document.createElement('link')
  link.rel = 'prefetch'
  link.href = href
  link.as = as

  document.head.appendChild(link)
}

/**
 * Отложенная инициализация функции
 */
export function deferExecution(fn: () => void, delay = 2000): void {
  if (typeof window === 'undefined') {
    fn()
    return
  }

  if ('requestIdleCallback' in window) {
    ;(window as any).requestIdleCallback(fn, { timeout: delay })
  } else {
    setTimeout(fn, delay)
  }
}

/**
 * Intersection Observer для lazy loading
 */
export function createLazyLoadObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options?: IntersectionObserverInit
): IntersectionObserver | null {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return null
  }

  return new IntersectionObserver(callback, {
    rootMargin: '50px',
    threshold: 0.01,
    ...options,
  })
}

/**
 * Измерение производительности
 */
export function measurePerformance(name: string, fn: () => void): void {
  if (typeof performance === 'undefined' || !performance.mark) {
    fn()
    return
  }

  const startMark = `${name}-start`
  const endMark = `${name}-end`

  try {
    performance.mark(startMark)
    fn()
    performance.mark(endMark)
    performance.measure(name, startMark, endMark)
    const measure = performance.getEntriesByName(name)[0]
    if (measure && measure.duration > 100) {
      console.warn(`[Performance] ${name} took ${measure.duration.toFixed(2)}ms`)
    }
  } catch {
    // Ignore
  } finally {
    if (performance.clearMarks) {
      performance.clearMarks(startMark)
      performance.clearMarks(endMark)
    }
    if (performance.clearMeasures) {
      performance.clearMeasures(name)
    }
  }
}

export type {
  PerformanceMetrics,
  PerformanceMetricName,
  PerformanceMetricReporter,
} from './performanceMonitoring'

export {
  PerformanceMonitor,
  initPerformanceMonitoring,
  analyzeResourceTiming,
  monitorMemoryUsage,
} from './performanceMonitoring'



