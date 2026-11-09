/** @jest-environment node */
// #3160: общий бюджет нагрузки пост-деплойных проверок на прод.
const { PROD_LOAD_CEILINGS, isProductionOrigin, prodSafeConcurrency } = require('@/scripts/lib/prodLoadBudget')
const { checkPagesWithOverloadRetry, CLI_SPEC } = require('@/scripts/post-deploy-seo-check')

describe('prodLoadBudget', () => {
  it('узнаёт прод по хосту, а не по подстроке', () => {
    expect(isProductionOrigin('https://metravel.by')).toBe(true)
    expect(isProductionOrigin('https://www.metravel.by/travels/x')).toBe(true)
    expect(isProductionOrigin('https://dev.metravel.by')).toBe(false)
    expect(isProductionOrigin('http://localhost:8081')).toBe(false)
    expect(isProductionOrigin('не url')).toBe(false)
  })

  it('режет параллельность для прода по классу запроса', () => {
    expect(prodSafeConcurrency('https://metravel.by', 12, 'page')).toBe(PROD_LOAD_CEILINGS.page)
    expect(prodSafeConcurrency('https://metravel.by', 12, 'api')).toBe(PROD_LOAD_CEILINGS.api)
    expect(prodSafeConcurrency('https://metravel.by', 2, 'page')).toBe(2)
  })

  it('не трогает dev и локальные origin', () => {
    expect(prodSafeConcurrency('https://dev.metravel.by', 12, 'page')).toBe(12)
    expect(prodSafeConcurrency('http://127.0.0.1:8096', 8, 'api')).toBe(8)
  })

  it('мусорное число становится одним потоком, неизвестный класс — ошибкой', () => {
    expect(prodSafeConcurrency('https://metravel.by', 0, 'page')).toBe(1)
    expect(prodSafeConcurrency('https://metravel.by', Number.NaN, 'api')).toBe(1)
    expect(() => prodSafeConcurrency('https://metravel.by', 3, 'video')).toThrow(/unknown request kind/)
  })

  it('SEO-проверка по умолчанию идёт в бюджете страниц', () => {
    expect(CLI_SPEC.flags.concurrency.default).toBe(PROD_LOAD_CEILINGS.page)
  })
})

describe('checkPagesWithOverloadRetry', () => {
  const ok = (url: string) => ({ url, issues: [] as Array<{ severity: string; code: string }> })
  const failed = (url: string, status: number) => ({
    url,
    issues: [{ severity: 'error', code: 'http.status', message: `Expected 200, got ${status}` }],
  })

  it('держит не больше заданных потоков одновременно', async () => {
    let active = 0
    let peak = 0
    const urls = Array.from({ length: 10 }, (_, i) => `u${i}`)
    await checkPagesWithOverloadRetry(urls, {
      concurrency: 3,
      wait: async () => {},
      check: async (url: string) => {
        active++
        peak = Math.max(peak, active)
        await new Promise((resolve) => setImmediate(resolve))
        active--
        return { response: { status: 200, headers: {} }, result: ok(url) }
      },
    })
    expect(peak).toBe(3)
  })

  it('503 под нагрузкой, который отвечает 200 в одиночку, — предупреждение, не ошибка', async () => {
    const calls: string[] = []
    const waits: number[] = []
    const results = await checkPagesWithOverloadRetry(['a', 'b'], {
      concurrency: 2,
      wait: async (ms: number) => { waits.push(ms) },
      check: async (url: string) => {
        calls.push(url)
        if (url === 'b' && calls.filter((c) => c === 'b').length === 1) {
          return { response: { status: 503, headers: { 'retry-after': '30' } }, result: failed(url, 503) }
        }
        return { response: { status: 200, headers: {} }, result: ok(url) }
      },
    })
    expect(calls).toEqual(['a', 'b', 'b'])
    expect(waits).toEqual([5000]) // Retry-After 30 с ограничен потолком
    expect(results[0].issues).toEqual([])
    expect(results[1].issues).toEqual([
      expect.objectContaining({ severity: 'warning', code: 'http.overload-retried' }),
    ])
  })

  it('устойчивый 5xx остаётся ошибкой гейта — перегрузка не прячет реальный сбой', async () => {
    const results = await checkPagesWithOverloadRetry(['a'], {
      concurrency: 3,
      wait: async () => {},
      check: async (url: string) => ({ response: { status: 503, headers: {} }, result: failed(url, 503) }),
    })
    const codes = results[0].issues.map((issue: { code: string; severity: string }) => `${issue.severity}:${issue.code}`)
    expect(codes).toEqual(['error:http.status', 'warning:http.overload-retried'])
  })

  it('лежащий сайт не растягивает хвост выката: переспрос ограничен, остальные 5xx остаются ошибкой', async () => {
    const urls = Array.from({ length: 30 }, (_, i) => `u${i}`)
    let calls = 0
    const results = await checkPagesWithOverloadRetry(urls, {
      concurrency: 3,
      maxRetries: 2,
      wait: async () => {},
      check: async (url: string) => {
        calls++
        return { response: { status: 504, headers: {} }, result: failed(url, 504) }
      },
    })
    expect(calls).toBe(32)
    expect(results).toHaveLength(30)
    expect(results.every((r: { issues: Array<{ severity: string }> }) => r.issues[0].severity === 'error')).toBe(true)
    expect(results[2].issues.map((issue: { code: string }) => issue.code)).toEqual(['http.status'])
  })

  it('4xx и сетевую ошибку не переспрашивает', async () => {
    let calls = 0
    await checkPagesWithOverloadRetry(['a', 'b'], {
      concurrency: 1,
      wait: async () => {},
      check: async (url: string) => {
        calls++
        return url === 'a'
          ? { response: { status: 404, headers: {} }, result: failed(url, 404) }
          : { response: null, result: failed(url, 0) }
      },
    })
    expect(calls).toBe(2)
  })
})
