/** @jest-environment node */

const { verifyRuntimeResponse, verifyLiveWebSsr } = require('@/scripts/verify-live-web-ssr')

const sha = 'a'.repeat(40)
const canonical = 'https://metravel.by/travels/example'
const graph = {
  '@graph': [
    { '@type': 'Article', headline: 'Article', url: canonical, mainEntityOfPage: canonical },
    { '@type': 'BreadcrumbList', itemListElement: [{ item: canonical }] },
  ],
}
const html = `<html><head><link rel="canonical" href="${canonical}"><style>.ssg-travel-article{display:none}</style></head><body>`
  + '<h1>Article</h1><div data-ssr-html-island="description"><p>Actual article body.</p></div>'
  + `<script type="application/ld+json" data-seo-jsonld="travel-article">${JSON.stringify(graph)}</script></body></html>`
const response = (headers: Record<string, string> = {}) => new Response(html, {
  headers: { 'Content-Type': 'text/html', 'X-Metravel-Ssr-Source': sha, 'X-Cache-Status': 'HIT', ...headers },
})
const codeProof = { schema_version: 1, status: 'ok', sha, client_sha: sha, renderer_sha: sha, dirty: false }
const legacyLoader = (slug: string) => Response.json(
  { travel: { slug, id: 42, description: '<p>Actual article body.</p>' } },
  { headers: { 'X-Metravel-Ssr-Source': sha } },
)
const pendingHtml = html.replace('</body>', '<section data-travel-link-graph="pending" data-travel-graph-error="refresh_pending"></section></body>')
const pendingResponse = (headers: Record<string, string> = {}) => new Response(pendingHtml, { headers: {
  'Content-Type': 'text/html', 'X-Metravel-Ssr-Source': sha, 'X-Metravel-Travel-Graph-State': 'pending',
  'Cache-Control': 'no-store', 'Retry-After': '5', ...headers,
} })

describe('paired renderer publication readiness', () => {
  it('accepts current SSR body, schema, canonical and cached identity', () => {
    expect(() => verifyRuntimeResponse(response(), html, { sha, canonical, requireHit: true })).not.toThrow()
  })

  it('rejects static fallback 200, stale renderer identity and an uncacheable guest response', () => {
    const staticFallback = new Response(html, { headers: { 'Content-Type': 'text/html' } })
    expect(() => verifyRuntimeResponse(staticFallback, html, { sha, canonical })).toThrow('activated renderer')
    expect(() => verifyRuntimeResponse(response({ 'X-Metravel-Ssr-Source': 'b'.repeat(40) }), html, { sha, canonical })).toThrow('activated renderer')
    expect(() => verifyRuntimeResponse(response({ 'X-Cache-Status': 'MISS' }), html, { sha, canonical, requireHit: true })).toThrow('guest cache')
  })

  it('rejects empty description, legacy article ownership and incorrect structured data', () => {
    expect(() => verifyRuntimeResponse(response(), html.replace('<p>Actual article body.</p>', ''), { sha, canonical })).toThrow('description')
    expect(() => verifyRuntimeResponse(response(), html.replace('<h1>', '<article id="ssg-travel-article"></article><h1>'), { sha, canonical })).toThrow('Legacy')
    expect(() => verifyRuntimeResponse(response(), html.replace('"mainEntityOfPage":"https://metravel.by/travels/example"', '"mainEntityOfPage":"https://metravel.by/travels/other"'), { sha, canonical })).toThrow('Article/Breadcrumb')
  })

  it('selects a currently published control and requires a real rendered response followed by HIT', async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(Response.json({ results: [{ slug: 'example' }] }))
      .mockResolvedValueOnce(response({ 'X-Cache-Status': 'MISS' }))
      .mockResolvedValueOnce(response())
    await expect(verifyLiveWebSsr({ sha, fetchImpl })).resolves.toEqual({ sha, canonical })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(String(fetchImpl.mock.calls[0][0])).toContain('/api/travels/')
    expect(fetchImpl.mock.calls[1][0]).toBe(canonical)
    expect(fetchImpl.mock.calls[2][0]).toBe(canonical)
  })

  it('retries the catalog control within the deadline instead of refusing on one slow or 5xx answer', async () => {
    const sleep = jest.fn().mockResolvedValue(undefined)
    const fetchImpl = jest.fn()
      .mockRejectedValueOnce(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
      .mockResolvedValueOnce(new Response('', { status: 502 }))
      .mockResolvedValueOnce(Response.json({ results: [{ slug: 'example' }] }))
      .mockResolvedValueOnce(response({ 'X-Cache-Status': 'MISS' }))
      .mockResolvedValueOnce(response())
    await expect(verifyLiveWebSsr({ sha, fetchImpl, sleep })).resolves.toEqual({ sha, canonical })
    expect(fetchImpl).toHaveBeenCalledTimes(5)
    expect(sleep).toHaveBeenCalledTimes(2)
    expect(String(fetchImpl.mock.calls[2][0])).toContain('/api/travels/')
  })

  it('refuses with the last catalog failure once the deadline passes', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(new Response('', { status: 503 }))
    await expect(verifyLiveWebSsr({ sha, fetchImpl, timeoutMs: 30, sleep: () => new Promise((resolve) => setTimeout(resolve, 5)) }))
      .rejects.toThrow('Renderer readiness failed: Public travel control is unavailable: HTTP 503')
    expect(fetchImpl.mock.calls.every(([url]) => String(url).includes('/api/travels/'))).toBe(true)
  })

  // #3337: rollout 37c40a247 was rolled back on 11.11.2026 with nothing but
  // "Renderer readiness deadline exceeded": 27 documents answered 200, and the
  // deadline error of the final request replaced the check that refused them.
  describe('refusal reason at the deadline (#3337)', () => {
    let now: number
    let clock: jest.SpyInstance
    const sleep = async (delay: number) => { now += delay }
    // Every response costs 700 ms of the shared deadline.
    const live = (documentHeaders: Record<string, string>, catalog = () => Response.json({ results: [{ slug: 'example' }] })) =>
      jest.fn(async (url: URL | string) => {
        now += 700
        return String(url).includes('/api/travels/') ? catalog() : response(documentHeaders)
      })
    const refusal = async (options: Record<string, unknown>) => {
      const error = await verifyLiveWebSsr({ sha, sleep, ...options }).then(() => null, (reason: Error) => reason)
      if (!error) throw new Error('The readiness check was expected to refuse the release')
      return error.message
    }

    beforeEach(() => {
      now = Date.now()
      clock = jest.spyOn(Date, 'now').mockImplementation(() => now)
    })
    afterEach(() => clock.mockRestore())

    it('names the check that refused the document, not the deadline that ended the retries', async () => {
      const fetchImpl = live({ 'X-Cache-Status': 'MISS' })
      // 0.7 s catalog, 1.4 s document, 2.1 s no HIT, pause, 3.8 s document:
      // the repeated guest request finds the 3.5 s deadline already passed.
      const message = await refusal({ fetchImpl, timeoutMs: 3500 })

      expect(fetchImpl).toHaveBeenCalledTimes(4)
      expect(message).toBe('Renderer readiness failed: Renderer HTML did not enter the guest cache'
        + ' (deadline exceeded; refused checks: 1× Renderer HTML did not enter the guest cache)')
    })

    it('reports the last refused check first and counts every reason over the attempts', async () => {
      let catalogReads = 0
      const fetchImpl = live({ 'X-Cache-Status': 'MISS' }, () => (catalogReads += 1) === 1
        ? new Response('', { status: 503 })
        : Response.json({ results: [{ slug: 'example' }] }))
      const message = await refusal({ fetchImpl, timeoutMs: 9000 })

      expect(message).toMatch(/^Renderer readiness failed: Renderer HTML did not enter the guest cache \(deadline exceeded; /)
      expect(message).toContain('refused checks: 3× Renderer HTML did not enter the guest cache; 1× Public travel control is unavailable: HTTP 503)')
    })

    it('does not let a request aborted by the deadline itself replace the refused check', async () => {
      let documents = 0
      const fetchImpl = jest.fn(async (url: URL | string, init: { signal: AbortSignal }) => {
        now += 700
        if (String(url).includes('/api/travels/')) return Response.json({ results: [{ slug: 'example' }] })
        documents += 1
        // The third document request starts with less than its own 5 s left.
        if (documents > 2) throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
        expect(init.signal).toBeInstanceOf(AbortSignal)
        return response({ 'X-Cache-Status': 'MISS' })
      })
      const message = await refusal({ fetchImpl, timeoutMs: 7000 })

      expect(documents).toBeGreaterThan(2)
      expect(message).toBe('Renderer readiness failed: Renderer HTML did not enter the guest cache'
        + ' (deadline exceeded; refused checks: 1× Renderer HTML did not enter the guest cache)')
    })

    it('still reports a slow response that had its whole request timeout as a reason', async () => {
      const fetchImpl = jest.fn(async () => {
        now += 5000
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
      })
      const message = await refusal({ fetchImpl, timeoutMs: 5000 })

      expect(fetchImpl).toHaveBeenCalledTimes(1)
      expect(message).toBe('Renderer readiness failed: The operation was aborted due to timeout'
        + ' (deadline exceeded; refused checks: 1× The operation was aborted due to timeout)')
    })

    it('says so when the deadline passed before any check could be refused', async () => {
      const fetchImpl = jest.fn()
      await expect(verifyLiveWebSsr({ sha, fetchImpl, timeoutMs: 0 }))
        .rejects.toThrow('Renderer readiness failed: deadline exceeded before any check was refused')
      expect(fetchImpl).not.toHaveBeenCalled()
    })

    it('lists at most five reasons and counts the rest', () => {
      const { createReadinessBudget } = require('@/scripts/lib/ssrDeploymentReadiness')
      const budget = createReadinessBudget('Renderer readiness', 1000)
      for (const slug of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) budget.refused(new Error(`Legacy article loader (${slug}): HTTP 502`))
      budget.refused(new Error('Legacy article loader (c): HTTP 502'))

      expect(budget.failure().message).toBe('Renderer readiness failed: Legacy article loader (c): HTTP 502 (deadline exceeded; refused checks: '
        + '2× Legacy article loader (c): HTTP 502; 1× Legacy article loader (a): HTTP 502; 1× Legacy article loader (b): HTTP 502; '
        + '1× Legacy article loader (d): HTTP 502; 1× Legacy article loader (e): HTTP 502; +2 more)')
    })
  })

  it('can select a public article whose slug contains Unicode', async () => {
    const unicodeCanonical = `https://metravel.by/travels/${encodeURIComponent('паездка')}`
    const unicodeHtml = html.replaceAll(canonical, unicodeCanonical)
    const unicodeResponse = () => new Response(unicodeHtml, { headers: {
      'Content-Type': 'text/html', 'X-Metravel-Ssr-Source': sha, 'X-Cache-Status': 'HIT',
    } })
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(Response.json({ results: [{ slug: 'паездка' }] }))
      .mockResolvedValueOnce(unicodeResponse())
      .mockResolvedValueOnce(unicodeResponse())
    await expect(verifyLiveWebSsr({ sha, fetchImpl })).resolves.toEqual({ sha, canonical: unicodeCanonical })
  })

  it('separates a typed pending graph from healthy code only in deployment mode', async () => {
    const codeHealth = jest.fn().mockResolvedValue(codeProof)
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(legacyLoader('ozero-sorapis-krugovoi-marshrut-v-dolomitakh'))
      .mockResolvedValueOnce(legacyLoader('forty-krakova-avstriiskie-ukrepleniia-xix-veka'))
      .mockResolvedValueOnce(legacyLoader('ozera-lepelshchiny-za-den-vechele-dolzhina-barkovshchina'))
      .mockResolvedValueOnce(legacyLoader('plitvitskie-ozera-v-khorvatii-kak-dobratsia'))
      .mockResolvedValueOnce(Response.json({ results: [{ slug: 'example' }] }))
      .mockResolvedValueOnce(pendingResponse())
    await expect(verifyLiveWebSsr({ sha, mode: 'deployment', codeHealth, fetchImpl }))
      .resolves.toMatchObject({ sha, canonical, content_status: 'pending', retry_after_seconds: 5 })
    expect(codeHealth).toHaveBeenCalledWith(sha)
    expect(fetchImpl).toHaveBeenCalledTimes(6)
    expect(String(fetchImpl.mock.calls[1][0])).toBe(
      'https://metravel.by/_expo/loaders/(tabs)/travels/forty-krakova?returnTo=%2Fsearch',
    )
    expect(fetchImpl.mock.calls[1][1]).toMatchObject({ redirect: 'error', credentials: 'omit' })
    expect(fetchImpl.mock.calls.slice(2, 4).map(([url]) => String(url))).toEqual([
      'https://metravel.by/_expo/loaders/(tabs)/travels/marshrut-odin-den-poseshchenie-ozer-i-istochnikov-barkovshchina-dolzhina-vechele-lepelskoe?returnTo=%2Fsearch',
      'https://metravel.by/_expo/loaders/(tabs)/travels/plitvitskie-ozera-v-khorvatii-kak-dobratsia-chto-posmotret-i-poleznye-sovety?returnTo=%2Fsearch',
    ])
    expect(() => verifyRuntimeResponse(pendingResponse(), pendingHtml, { sha, canonical })).toThrow('strict acceptance')
  })

  it('refuses to finalize if the legacy client loader keeps returning 503', async () => {
    const fetchImpl = jest.fn(async (url: URL) => url.pathname.endsWith('/forty-krakova')
      ? new Response('', { status: 503 })
      : legacyLoader('ozero-sorapis-krugovoi-marshrut-v-dolomitakh'))
    let now = Date.now()
    const clock = jest.spyOn(Date, 'now').mockImplementation(() => now)
    try {
      await expect(verifyLiveWebSsr({ sha, mode: 'deployment', codeHealth: async () => codeProof,
        fetchImpl, timeoutMs: 2000, sleep: async (delay: number) => { now += delay } }))
        .rejects.toThrow('Legacy article loader (forty-krakova): HTTP 503')
      expect(fetchImpl).toHaveBeenCalledTimes(4)
      expect(fetchImpl.mock.calls.every(([url]) => url.pathname.startsWith('/_expo/loaders/'))).toBe(true)
    } finally {
      clock.mockRestore()
    }
  })

  it('never relaxes source, body, schema or no-store checks for pending content', () => {
    const options = { sha, canonical, mode: 'deployment', codeProof, requireHit: true }
    expect(() => verifyRuntimeResponse(pendingResponse(), pendingHtml, options)).not.toThrow()
    expect(() => verifyRuntimeResponse(pendingResponse(), pendingHtml, { ...options, codeProof: { ...codeProof, renderer_sha: 'b'.repeat(40) } })).toThrow('independently')
    expect(() => verifyRuntimeResponse(pendingResponse({ 'X-Metravel-Ssr-Source': 'b'.repeat(40) }), pendingHtml, options)).toThrow('activated')
    expect(() => verifyRuntimeResponse(pendingResponse({ 'Cache-Control': 'public', 'X-Cache-Status': 'HIT' }), pendingHtml, options)).toThrow('guest cache')
    expect(() => verifyRuntimeResponse(pendingResponse(), pendingHtml.replace('<p>Actual article body.</p>', ''), options)).toThrow('description')
    expect(() => verifyRuntimeResponse(pendingResponse(), pendingHtml.replace('data-travel-link-graph="pending"', 'data-travel-link-graph="available"'), options)).toThrow('discovery state')
  })

  it('checks the independent client/renderer proof before trusting any deployment response', async () => {
    const fetchImpl = jest.fn()
    await expect(verifyLiveWebSsr({ sha, mode: 'deployment', codeHealth: async () => ({ ...codeProof, dirty: true }), fetchImpl })).rejects.toThrow('clean source SHA')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('recognizes the pending-request to ready-body cache race without relaxing strict acceptance', () => {
    const availableHtml = pendingHtml.replace('data-travel-link-graph="pending"', 'data-travel-link-graph="available"')
    const available = pendingResponse({ 'X-Metravel-Travel-Graph-State': 'available' })
    expect(verifyRuntimeResponse(available, availableHtml, { sha, canonical, mode: 'deployment', codeProof, requireHit: true }))
      .toMatchObject({ content_status: 'pending', error_code: 'cache_transition' })
    expect(() => verifyRuntimeResponse(available, availableHtml, { sha, canonical, requireHit: true })).toThrow('strict acceptance')
  })

  it('never finalizes a real selected-DTO schema regression as a content error', () => {
    const options = { sha, canonical, mode: 'deployment', codeProof }
    const failed = pendingHtml.replace('data-travel-link-graph="pending"', 'data-travel-link-graph="error"')
    const failedResponse = pendingResponse({ 'X-Metravel-Travel-Graph-State': 'error' })
    expect(() => verifyRuntimeResponse(failedResponse,
      failed.replace('data-travel-graph-error="refresh_pending"', 'data-travel-graph-error="invalid_graph_response"'), options))
      .toThrow('code/schema contract failure')
    for (const code of ['refresh_stale', 'publication_corrupt', 'graph_transport_failed']) {
      expect(verifyRuntimeResponse(failedResponse, failed.replace('refresh_pending', code), options))
        .toMatchObject({ content_status: 'error', error_code: code })
    }
    expect(verifyRuntimeResponse(failedResponse, failed.replace('refresh_pending', 'unavailable'), options))
      .toMatchObject({ content_status: 'unavailable' })
  })
})
