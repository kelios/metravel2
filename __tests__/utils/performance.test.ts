import { loadScriptDeferred, loadStylesheetDeferred, measurePerformance } from '@/utils/performance'

describe('performance utilities', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    document.head.innerHTML = ''
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
    document.head.innerHTML = ''
  })

  it('deduplicates concurrent script loads and resolves once', async () => {
    const promise1 = loadScriptDeferred('https://cdn.example.com/script.js', 'script-test')
    const promise2 = loadScriptDeferred('https://cdn.example.com/script.js', 'script-test')

    expect(promise1).toBe(promise2)

    jest.runAllTimers()

    const script = document.getElementById('script-test') as HTMLScriptElement
    expect(script).toBeTruthy()

    script.onload?.(new Event('load') as any)

    await expect(promise1).resolves.toBeUndefined()
    expect(document.head.querySelectorAll('script[src="https://cdn.example.com/script.js"]').length).toBe(1)
  })

  it('cleans up failed script load and allows retry', async () => {
    const failingPromise = loadScriptDeferred('https://cdn.example.com/fail.js', 'script-fail')

    jest.runAllTimers()

    const script = document.getElementById('script-fail') as HTMLScriptElement
    expect(script).toBeTruthy()

    script.onerror?.(new Event('error') as any)

    await expect(failingPromise).rejects.toThrow('Failed to load script: https://cdn.example.com/fail.js')
    expect(document.head.querySelector('#script-fail')).toBeNull()

    const retryPromise = loadScriptDeferred('https://cdn.example.com/fail.js', 'script-fail')

    jest.runAllTimers()

    const retryScript = document.getElementById('script-fail') as HTMLScriptElement
    retryScript.onload?.(new Event('load') as any)

    await expect(retryPromise).resolves.toBeUndefined()
    expect(document.head.querySelectorAll('script[src="https://cdn.example.com/fail.js"]').length).toBe(1)
  })

  it('reuses pending stylesheet load by href', async () => {
    const href = 'https://cdn.example.com/styles.css'
    const promise1 = loadStylesheetDeferred(href)
    const promise2 = loadStylesheetDeferred(href)

    expect(promise1).toBe(promise2)

    jest.runAllTimers()

    const link = document.head.querySelector(`link[href="${href}"]`) as HTMLLinkElement
    expect(link).toBeTruthy()

    link.onload?.(new Event('load') as any)

    await expect(promise1).resolves.toBeUndefined()
    expect(document.head.querySelectorAll(`link[href="${href}"]`).length).toBe(1)
  })

  it('clears performance entries to avoid leaks', () => {
    const name = 'perf-leak-check'

    if (typeof performance.getEntriesByName !== 'function') {
      expect(() => measurePerformance(name, () => {})).not.toThrow()
      return
    }

    measurePerformance(name, () => {})

    expect(performance.getEntriesByName(name)).toHaveLength(0)
    expect(performance.getEntriesByName(`${name}-start`)).toHaveLength(0)
    expect(performance.getEntriesByName(`${name}-end`)).toHaveLength(0)
  })
})
