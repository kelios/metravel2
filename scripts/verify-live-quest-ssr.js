#!/usr/bin/env node
'use strict';

const { setTimeout: wait } = require('node:timers/promises');
const { DomUtils } = require('htmlparser2');
const { assertSsrDocument } = require('./lib/ssrDocument');
const { parseQuestPublicRoute, validateQuestPublicProjection } = require('../utils/questPublicPage');
const { parseCliArgs, runCli } = require('./lib/cli-contract');
const { assertReadinessMode, assertCodeHealth, verifyCodeHealth, classifySelectedContent } = require('./lib/ssrDeploymentReadiness');

const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();

function verifyQuestRuntimeResponse(response, html, { sha, projection, requireHit = false }) {
  const page = projection.page, canonical = page.meta.canonical;
  const { find, headings } = assertSsrDocument(response, html, { sha, canonical, requireHit });
  const root = find((node) => node.name === 'html');
  if (root.length !== 1 || root[0].attribs.lang !== projection.locale) throw new Error('Quest document has the wrong request locale');
  const titles = find((node) => node.name === 'title');
  if (titles.length !== 1 || normalize(DomUtils.textContent(titles[0])) !== normalize(page.meta.title)
      || normalize(DomUtils.textContent(headings[0])) !== normalize(page.heading)) throw new Error('Quest title or H1 differs from the selected publication');
  const descriptions = find((node) => node.name === 'meta' && node.attribs?.name === 'description');
  if (descriptions.length !== 1 || descriptions[0].attribs.content !== page.meta.description) throw new Error('Quest meta description differs from the selected publication');
  const robots = find((node) => node.name === 'meta' && node.attribs?.name === 'robots');
  const expectedRobots = projection.quality.indexable ? 'index,follow' : 'noindex,follow';
  if (robots.length !== 1 || robots[0].attribs.content.replace(/\s/g, '') !== expectedRobots) throw new Error('Quest robots differs from its cohort verdict');
  const bodies = find((node) => node.name === 'main' && node.attribs?.['data-quest-public-page'] === projection.kind);
  if (bodies.length !== 1) throw new Error('Quest public React body is absent or duplicated');
  const body = normalize(DomUtils.textContent(bodies[0]));
  const expectedText = [page.heading, page.lead, ...page.paragraphs, ...page.facts,
    ...page.sections.flatMap((section) => [section.heading, ...section.paragraphs,
      ...section.items.flatMap((item) => [item.title, item.text, item.facts])])].filter(Boolean);
  if (expectedText.some((text) => !body.includes(normalize(text)))) throw new Error('Quest public body omits selected published prose');
  const scripts = find((node) => node.name === 'script' && node.attribs?.type === 'application/ld+json'
    && node.attribs?.['data-seo-jsonld'] === 'quest-public');
  if (scripts.length !== 1) throw new Error('Quest public structured data is absent or duplicated');
  const graph = JSON.parse(DomUtils.textContent(scripts[0]))['@graph'];
  if (!Array.isArray(graph)) throw new Error('Quest structured graph is invalid');
  const entity = graph.find((entry) => entry?.['@type'] === (projection.kind === 'detail' ? 'TouristTrip' : 'ItemList'));
  const breadcrumb = graph.find((entry) => entry?.['@type'] === 'BreadcrumbList');
  if (entity?.url !== canonical || breadcrumb?.itemListElement?.at(-1)?.item !== canonical
      || (projection.kind === 'detail' && (entity.mainEntityOfPage !== canonical || entity.inLanguage !== projection.locale
        || entity.name !== page.meta.title || entity.description !== page.meta.description
        || entity.touristType !== page.meta.tourist_type || (page.meta.city_name && entity.location?.name !== page.meta.city_name)))) {
    throw new Error('Quest schema differs from the selected public route');
  }
  const alternatives = find((node) => node.name === 'link' && node.attribs?.rel === 'alternate' && node.attribs?.hreflang);
  const expected = projection.versions.length < 2 ? [] : [
    ...projection.versions.map((version) => [version.locale, 'https://metravel.by' + version.path]),
    ['x-default', 'https://metravel.by' + projection.ru_source_path],
  ];
  if (alternatives.length !== expected.length || expected.some(([locale, href]) =>
    alternatives.filter((node) => node.attribs.hreflang === locale && node.attribs.href === href).length !== 1)) throw new Error('Quest alternates differ from live effective versions');
}

async function verifyLiveQuestSsr({ sha, controlPath, origin = 'https://metravel.by', timeoutMs = 45000, fetchImpl = fetch, sleep = wait,
  mode = 'strict', codeHealth = verifyCodeHealth }) {
  const route = parseQuestPublicRoute(controlPath);
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Full source SHA is required');
  assertReadinessMode(mode);
  const base = new URL(origin);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error('Expected an HTTP origin');
  if (!route && !(mode === 'deployment' && !controlPath)) throw new Error('A published quest control path is required');
  if (mode === 'deployment') assertCodeHealth(await codeHealth(sha), sha);
  if (!route) return { sha, content_status: 'unavailable', error_code: 'no_published_control' };
  const deadline = Date.now() + timeoutMs;
  const request = async (path) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('Quest renderer readiness deadline exceeded');
    return fetchImpl(new URL(path, base), { signal: AbortSignal.timeout(Math.min(5000, remaining)), credentials: 'omit', redirect: 'error' });
  };
  const selection = route.kind === 'detail' ? `detail/${route.city}/${route.slug}` : route.kind === 'city' ? `city/${route.city}` : `country/${route.country}`;
  let failure = new Error('Quest renderer readiness has no successful request');
  while (Date.now() < deadline) {
    try {
      const api = await request(`/api/quests/web/${selection}/?lang=${route.locale}`);
      if (!api.ok) {
        if (mode === 'deployment') {
          const content = classifySelectedContent(api, await api.json(), { kind: route.kind, locale: route.locale });
          return { sha, canonical: new URL(controlPath, base).href, locale: route.locale, ...content };
        }
        throw new Error(`Quest selected publication is unavailable: HTTP ${api.status}`);
      }
      const projection = validateQuestPublicProjection(await api.json(), route);
      if (!projection) throw new Error('Quest selected publication does not match its route');
      const first = await request(controlPath);
      verifyQuestRuntimeResponse(first, await first.text(), { sha, projection });
      const cached = await request(controlPath);
      verifyQuestRuntimeResponse(cached, await cached.text(), { sha, projection, requireHit: true });
      return { sha, canonical: projection.page.meta.canonical, locale: projection.locale, publication_id: projection.publication_id };
    } catch (error) { failure = error; }
    if (Date.now() < deadline) await sleep(Math.min(1000, deadline - Date.now()));
  }
  throw new Error(`Quest renderer readiness failed: ${failure.message}`);
}

const CLI_SPEC = { name: 'verify-live-quest-ssr', usage: 'node scripts/verify-live-quest-ssr.js --sha <full-sha> --control-path /quests/<city>/<slug> [--readiness-mode strict|deployment] [--origin https://metravel.by]',
  selection: 'none', flags: { sha: { type: 'string', required: true }, 'control-path': { type: 'string' }, origin: { type: 'string', default: 'https://metravel.by' }, 'readiness-mode': { type: 'string', default: 'strict' } } };
module.exports = { verifyQuestRuntimeResponse, verifyLiveQuestSsr };
if (require.main === module) runCli(async () => {
  const args = parseCliArgs(process.argv, CLI_SPEC);
  const result = await verifyLiveQuestSsr({ ...args, mode: args.readinessMode });
  console.log(result.content_status
    ? `[quest-ssr-readiness] Code SHA ${result.sha} is ready; content=${result.content_status}; strict content acceptance remains required`
    : `[quest-ssr-readiness] Published ${result.locale} quest and guest cache match ${result.sha}: ${result.canonical}`);
}, CLI_SPEC);
