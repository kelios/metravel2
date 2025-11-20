/**
 * Утилиты для оптимизации производительности
 */

/**
 * Отложенная загрузка скрипта
 */
export function loadScriptDeferred(src: string, id?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      resolve()
      return
    }

    // Проверяем, не загружен ли уже скрипт
    if (id && document.getElementById(id)) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.defer = true
    if (id) script.id = id

    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))

    // Загружаем после idle
    if ('requestIdleCallback' in window) {
      ;(window as any).requestIdleCallback(() => {
        document.head.appendChild(script)
      })
    } else {
      setTimeout(() => {
        document.head.appendChild(script)
      }, 2000)
    }
  })
}

/**
 * Отложенная загрузка стилей
 */
export function loadStylesheetDeferred(href: string, id?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      resolve()
      return
    }

    if (id && document.getElementById(id)) {
      resolve()
      return
    }

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    if (id) link.id = id

    link.onload = () => resolve()
    link.onerror = () => reject(new Error(`Failed to load stylesheet: ${href}`))

    if ('requestIdleCallback' in window) {
      ;(window as any).requestIdleCallback(() => {
        document.head.appendChild(link)
      })
    } else {
      setTimeout(() => {
        document.head.appendChild(link)
      }, 2000)
    }
  })
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

  performance.mark(startMark)
  fn()
  performance.mark(endMark)

  try {
    performance.measure(name, startMark, endMark)
    const measure = performance.getEntriesByName(name)[0]
    if (measure && measure.duration > 100) {
      console.warn(`[Performance] ${name} took ${measure.duration.toFixed(2)}ms`)
    }
  } catch (e) {
    // Ignore
  }
}




