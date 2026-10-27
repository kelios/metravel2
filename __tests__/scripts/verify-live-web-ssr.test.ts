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
    const fetchImpl = jest.fn().mockResolvedValueOnce(Response.json({ results: [{ slug: 'example' }] }))
      .mockResolvedValueOnce(pendingResponse())
    await expect(verifyLiveWebSsr({ sha, mode: 'deployment', codeHealth, fetchImpl }))
      .resolves.toMatchObject({ sha, canonical, content_status: 'pending', retry_after_seconds: 5 })
    expect(codeHealth).toHaveBeenCalledWith(sha)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(() => verifyRuntimeResponse(pendingResponse(), pendingHtml, { sha, canonical })).toThrow('strict acceptance')
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
