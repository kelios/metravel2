#!/usr/bin/env node
'use strict'

const { setTimeout: wait } = require('node:timers/promises')
const { DomUtils } = require('htmlparser2')
const { assertSsrDocument } = require('./lib/ssrDocument')
const { assertReadinessMode, assertCodeHealth, verifyCodeHealth, createReadinessTiming, createReadinessBudget,
  documentContentState } = require('./lib/ssrDeploymentReadiness')
const { parseCliArgs, runCli, UsageError } = require('./lib/cli-contract')
const { redirects } = require('./seo-redirects.json')

const LEGACY_ARTICLE_CONTROLS = [
  'ozero-sorapis-krugovoi-marshrut-215-217-kak-doiti-chto-zhdat-po-puti-i-chto-posmotret-riadom',
  'forty-krakova',
  'marshrut-odin-den-poseshchenie-ozer-i-istochnikov-barkovshchina-dolzhina-vechele-lepelskoe',
  'plitvitskie-ozera-v-khorvatii-kak-dobratsia-chto-posmotret-i-poleznye-sovety',
]

async function verifyLegacyArticleLoaders(request, origin, sha) {
  for (const slug of LEGACY_ARTICLE_CONTROLS) {
    const canonicalSlug = redirects.find(({ from }) => from === slug)?.to
    if (!canonicalSlug) throw new Error(`Missing legacy article control in redirect manifest: ${slug}`)
    const url = new URL(`/_expo/loaders/(tabs)/travels/${encodeURIComponent(slug)}?returnTo=%2Fsearch`, origin)
    const response = await request(url)
    const label = `Legacy article loader (${slug})`
    if (response.status !== 200) throw new Error(`${label}: HTTP ${response.status}`)
    if (response.headers.get('x-metravel-ssr-source') !== sha
        || !response.headers.get('content-type')?.includes('application/json')) {
      throw new Error(`${label}: expected JSON from renderer ${sha}`)
    }
    const { travel } = await response.json().catch(() => ({})) ?? {}
    if (travel?.slug !== canonicalSlug || !Number.isSafeInteger(travel.id) || travel.id <= 0
        || typeof travel.description !== 'string' || !travel.description.trim()) {
      throw new Error(`${label}: missing canonical article or description`)
    }
  }
  console.log(`[web-ssr-readiness] ${LEGACY_ARTICLE_CONTROLS.length} legacy article loaders match ${sha}`)
}

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

async function selectControlSlugs(request, origin) {
  const catalog = await request(new URL(`/api/travels/?page=1&perPage=5&where=${encodeURIComponent(JSON.stringify({ publish: 1, moderation: 1 }))}`, origin))
  if (!catalog.ok) throw new Error(`Public travel control is unavailable: HTTP ${catalog.status}`)
  const data = await catalog.json()
  const items = Array.isArray(data) ? data : data.results || data.data || data.items || []
  const slugs = [...new Set(items.map((item) => item?.slug).filter((slug) => typeof slug === 'string'
    && slug.length > 0 && slug.length <= 250))].slice(0, 3)
  if (!slugs.length) throw new Error('Public catalog has no usable article control')
  return slugs
}

async function verifyLiveWebSsr({ sha, origin = 'https://metravel.by', timeoutMs = 45_000, fetchImpl = fetch, sleep = wait,
  mode = 'strict', codeHealth = verifyCodeHealth, timing = createReadinessTiming() }) {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('A full renderer source SHA is required')
  assertReadinessMode(mode)
  const base = new URL(origin)
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error('Expected an HTTP origin')
  const codeProof = mode === 'deployment' ? assertCodeHealth(await codeHealth(sha), sha) : null
  // #3337: the budget keeps why each attempt was refused; the deadline itself
  // never replaces the last refused check in the failure of a rollback.
  const budget = createReadinessBudget('Renderer readiness', timeoutMs)
  const request = async (url) => timing.response(await budget.fetch(fetchImpl, url, { redirect: 'error', credentials: 'omit' }))
  // The catalog control shares the renderer's retry deadline, as the quest API
  // does in verify-live-quest-ssr.js: one slow or 5xx answer right after the
  // paired restart is a transient, not a refused release (42f5681f2, 9bde01ff6).
  let slugs = null
  let legacyReady = mode !== 'deployment'
  while (budget.remaining() > 0) {
    timing.attempt()
    try {
      if (!legacyReady) {
        await timing.measure('legacy-loaders', () => verifyLegacyArticleLoaders(request, origin, sha))
        legacyReady = true
      }
      slugs ??= await timing.measure('catalog', () => selectControlSlugs(request, origin))
    } catch (error) {
      budget.refused(error)
    }
    for (const slug of slugs || []) {
      try {
        const canonical = new URL(`/travels/${encodeURIComponent(slug)}`, origin).href
        const firstContent = await timing.measure('document', async () => {
          const response = await request(canonical)
          return verifyRuntimeResponse(response, await response.text(), { sha, canonical, mode, codeProof })
        })
        if (firstContent) return { sha, canonical, ...firstContent }
        const cachedContent = await timing.measure('guest-HIT', async () => {
          const response = await request(canonical)
          return verifyRuntimeResponse(response, await response.text(), { sha, canonical, requireHit: true, mode, codeProof })
        })
        if (cachedContent) return { sha, canonical, ...cachedContent }
        console.log(`[web-ssr-readiness] Rendered article and guest cache match ${sha}: ${canonical}`)
        return { sha, canonical }
      } catch (error) {
        if (error?.code === 'SSR_CODE_CONTRACT') throw error
        budget.refused(error)
      }
    }
    if (budget.remaining() > 0) await sleep(Math.min(1000, budget.remaining()))
  }
  throw budget.failure()
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
