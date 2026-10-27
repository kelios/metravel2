#!/usr/bin/env node
'use strict'

const { setTimeout: wait } = require('node:timers/promises')
const { DomUtils } = require('htmlparser2')
const { assertSsrDocument } = require('./lib/ssrDocument')
const { assertReadinessMode, assertCodeHealth, verifyCodeHealth, documentContentState } = require('./lib/ssrDeploymentReadiness')
const { parseCliArgs, runCli, UsageError } = require('./lib/cli-contract')

function verifyRuntimeResponse(response, html, { sha, canonical, requireHit = false, mode = 'strict', codeProof }) {
  assertReadinessMode(mode)
  const { find } = assertSsrDocument(response, html, { sha, canonical })
  const islands = find((node) => node.attribs?.['data-ssr-html-island'] === 'description')
  if (islands.length !== 1 || !DomUtils.textContent(islands[0]).trim()) throw new Error('Renderer description is empty')
  if (find((node) => node.attribs?.id === 'ssg-travel-article' || node.attribs?.class?.split(/\s+/).includes('ssg-travel-article')).length) {
    throw new Error('Legacy generated article still owns the document')
  }
  const scripts = find((node) => node.name === 'script' && node.attribs?.type === 'application/ld+json'
    && node.attribs?.['data-seo-jsonld'] === 'travel-article')
  if (scripts.length !== 1) throw new Error('Renderer structured data is missing or duplicated')
  const structured = JSON.parse(DomUtils.textContent(scripts[0]))
  const graph = Array.isArray(structured['@graph']) ? structured['@graph'] : [structured]
  const article = graph.find((node) => node?.['@type'] === 'Article')
  const breadcrumbs = graph.find((node) => node?.['@type'] === 'BreadcrumbList')
  if (article?.url !== canonical || article?.mainEntityOfPage !== canonical || !article?.headline
      || breadcrumbs?.itemListElement?.at(-1)?.item !== canonical) {
    throw new Error('Renderer Article/Breadcrumb schema differs from its public route')
  }
  const content = documentContentState(response, find)
  if (content) {
    if (mode !== 'deployment') throw new Error(`Article discovery content is ${content.content_status}; strict acceptance is incomplete`)
    assertCodeHealth(codeProof, sha)
    return content
  }
  if (requireHit && response.headers.get('x-cache-status') !== 'HIT') throw new Error('Renderer HTML did not enter the guest cache')
  return null
}

async function verifyLiveWebSsr({ sha, origin = 'https://metravel.by', timeoutMs = 45_000, fetchImpl = fetch, sleep = wait,
  mode = 'strict', codeHealth = verifyCodeHealth }) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('A full renderer source SHA is required')
  assertReadinessMode(mode)
  const base = new URL(origin)
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error('Expected an HTTP origin')
  const codeProof = mode === 'deployment' ? assertCodeHealth(await codeHealth(sha), sha) : null
  const deadline = Date.now() + timeoutMs
  const request = async (url) => {
    const remaining = deadline - Date.now()
    if (remaining <= 0) throw new Error('Renderer readiness deadline exceeded')
    return fetchImpl(url, { signal: AbortSignal.timeout(Math.min(5000, remaining)), redirect: 'error', credentials: 'omit' })
  }
  const catalog = await request(new URL(`/api/travels/?page=1&perPage=5&where=${encodeURIComponent(JSON.stringify({ publish: 1, moderation: 1 }))}`, origin))
  if (!catalog.ok) throw new Error(`Public travel control is unavailable: HTTP ${catalog.status}`)
  const data = await catalog.json()
  const items = Array.isArray(data) ? data : data.results || data.data || data.items || []
  const slugs = [...new Set(items.map((item) => item?.slug).filter((slug) => typeof slug === 'string'
    && slug.length > 0 && slug.length <= 250))].slice(0, 3)
  if (!slugs.length) throw new Error('Public catalog has no usable article control')
  let failure = new Error('Renderer readiness has no successful request')
  while (Date.now() < deadline) {
    for (const slug of slugs) {
      try {
        const canonical = new URL(`/travels/${encodeURIComponent(slug)}`, origin).href
        const first = await request(canonical)
        const firstContent = verifyRuntimeResponse(first, await first.text(), { sha, canonical, mode, codeProof })
        if (firstContent) return { sha, canonical, ...firstContent }
        const cached = await request(canonical)
        const cachedContent = verifyRuntimeResponse(cached, await cached.text(), { sha, canonical, requireHit: true, mode, codeProof })
        if (cachedContent) return { sha, canonical, ...cachedContent }
        console.log(`[web-ssr-readiness] Rendered article and guest cache match ${sha}: ${canonical}`)
        return { sha, canonical }
      } catch (error) {
        if (error?.code === 'SSR_CODE_CONTRACT') throw error
        failure = error
      }
    }
    if (Date.now() < deadline) await sleep(Math.min(1000, deadline - Date.now()))
  }
  throw new Error(`Renderer readiness failed: ${failure.message}`)
}

module.exports = { verifyRuntimeResponse, verifyLiveWebSsr }
const CLI_SPEC = { name: 'verify-live-web-ssr', usage: 'node scripts/verify-live-web-ssr.js <sha> [--readiness-mode strict|deployment] [--origin https://metravel.by]',
  positionals: { min: 1 }, flags: { 'readiness-mode': { type: 'string', default: 'strict' }, origin: { type: 'string', default: 'https://metravel.by' } } }
if (require.main === module) runCli(async () => {
  const args = parseCliArgs(process.argv, CLI_SPEC)
  if (args.positionals.length !== 1) throw new UsageError('Expected exactly one renderer source SHA')
  const result = await verifyLiveWebSsr({ ...args, sha: args.positionals[0], mode: args.readinessMode })
  if (result.content_status) console.log(`[web-ssr-readiness] Code SHA ${result.sha} is ready; content=${result.content_status}; strict content acceptance remains required`)
}, CLI_SPEC)
