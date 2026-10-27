/** @jest-environment node */
const path = require('node:path');
const { verifyQuestRuntimeResponse, verifyLiveQuestSsr } = require('@/scripts/verify-live-quest-ssr');
const { buildQuestWebProjection } = require('@/scripts/lib/questWebProjection');
const { loadSsgCatalogs } = require('@/i18n/babel-inline-plugin');
import { questPrivateSnapshot } from '../fixtures/questPublicProjection';

const sha = 'a'.repeat(40);
const rows = buildQuestWebProjection(questPrivateSnapshot(), loadSsgCatalogs(path.resolve(__dirname, '../..')).catalogs).pages;
const detail = rows.find((row: { kind: string; locale: string }) => row.kind === 'detail' && row.locale === 'ru');
const projection = { ...detail, schema_version: 2, state: 'available', publication_id: 'b'.repeat(64), corpus_revision: 'c'.repeat(64),
  ru_source_path: detail.canonical_path, versions: [] };
const page = projection.page;
const graph = { '@graph': [
  { '@type': 'TouristTrip', name: page.meta.title, description: page.meta.description, touristType: page.meta.tourist_type,
    location: { '@type': 'City', name: page.meta.city_name }, url: page.meta.canonical, mainEntityOfPage: page.meta.canonical, inLanguage: 'ru' },
  { '@type': 'BreadcrumbList', itemListElement: [{ item: page.meta.canonical }] },
] };
const paragraphs = [page.heading, page.kicker, page.lead, ...page.paragraphs, ...page.facts,
  ...page.sections.flatMap((section: { heading: string; paragraphs: string[]; items: Array<{ title: string; text: string; facts: string }> }) =>
    [section.heading, ...section.paragraphs, ...section.items.flatMap((item) => [item.title, item.text, item.facts])])];
const html = `<html lang="ru"><head><title>${page.meta.title}</title><meta name="description" content="${page.meta.description}">`
  + `<link rel="canonical" href="${page.meta.canonical}"><meta name="robots" content="index, follow"></head><body>`
  + `<main data-quest-public-page="detail"><h1>${page.heading}</h1>${paragraphs.map((text: string) => `<p>${text}</p>`).join('')}</main>`
  + `<script type="application/ld+json" data-seo-jsonld="quest-public">${JSON.stringify(graph)}</script></body></html>`;
const response = (headers: Record<string, string> = {}) => new Response(html, { headers: {
  'Content-Type': 'text/html', 'X-Metravel-Ssr-Source': sha, 'X-Cache-Status': 'HIT', ...headers } });
const codeProof = { schema_version: 1, status: 'ok', sha, client_sha: sha, renderer_sha: sha, dirty: false };

it('requires the activated source, selected published prose, SEO identity and guest cache', () => {
  expect(() => verifyQuestRuntimeResponse(response(), html, { sha, projection, requireHit: true })).not.toThrow();
  expect(() => verifyQuestRuntimeResponse(response({ 'X-Metravel-Ssr-Source': 'b'.repeat(40) }), html, { sha, projection })).toThrow('activated');
  expect(() => verifyQuestRuntimeResponse(response({ 'X-Cache-Status': 'MISS' }), html, { sha, projection, requireHit: true })).toThrow('guest cache');
  expect(() => verifyQuestRuntimeResponse(response(), html.replace('lang="ru"', 'lang="pl"'), { sha, projection })).toThrow('locale');
  expect(() => verifyQuestRuntimeResponse(response(), html.replace('index, follow', 'noindex, follow'), { sha, projection })).toThrow('robots');
  const sentence = page.sections[0].items[0].text;
  expect(() => verifyQuestRuntimeResponse(response(), html.replace(sentence, ''), { sha, projection })).toThrow('prose');
});

it('compares a selected API publication with rendered HTML and the immediately repeated cache HIT', async () => {
  const fetchImpl = jest.fn().mockResolvedValueOnce(Response.json(projection))
    .mockResolvedValueOnce(response({ 'X-Cache-Status': 'MISS' })).mockResolvedValueOnce(response());
  await expect(verifyLiveQuestSsr({ sha, controlPath: projection.canonical_path, fetchImpl })).resolves.toMatchObject({ sha, locale: 'ru', publication_id: projection.publication_id });
  expect(fetchImpl).toHaveBeenCalledTimes(3);
  expect(String(fetchImpl.mock.calls[0][0])).toBe('https://metravel.by/api/quests/web/detail/7/fixture-city-walk/?lang=ru');
  expect(String(fetchImpl.mock.calls[1][0])).toBe(page.meta.canonical);
  expect(String(fetchImpl.mock.calls[2][0])).toBe(page.meta.canonical);
});

it.each([
  ['refresh_pending', 3, 'pending'], ['refresh_stale', 31, 'error'], ['publication_corrupt', null, 'error'],
])('reports content %s separately from a proved healthy deployment', async (errorCode, age, expected) => {
  const unavailable = { schema_version: 2, state: 'temporary_failure', kind: 'detail', locale: 'ru', page: null,
    versions: [], error_code: errorCode, source_checked_at: age === null ? null : 1000, source_age_seconds: age };
  const fetchImpl = jest.fn().mockResolvedValue(Response.json(unavailable, { status: 503,
    headers: { 'Cache-Control': 'no-store', 'Retry-After': '5' } }));
  await expect(verifyLiveQuestSsr({ sha, controlPath: projection.canonical_path, mode: 'deployment',
    codeHealth: async () => codeProof, fetchImpl })).resolves.toMatchObject({ sha, content_status: expected, error_code: errorCode });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

it('does not call a withdrawn control a broken renderer after checking the active pair', async () => {
  const fetchImpl = jest.fn().mockResolvedValue(Response.json({ schema_version: 2, state: 'unavailable',
    kind: 'detail', locale: 'ru', page: null, versions: [] }, { status: 404, headers: { 'Cache-Control': 'no-store' } }));
  await expect(verifyLiveQuestSsr({ sha, controlPath: projection.canonical_path, mode: 'deployment',
    codeHealth: async () => codeProof, fetchImpl })).resolves.toMatchObject({ content_status: 'unavailable' });
});

it('requires an eligible control in strict mode but reports its absence separately after a deployment health proof', async () => {
  const { getQuestControlPath } = require('@/scripts/lib/webOutput');
  const capability = { schema_version: 2, available: true, enabled: true,
    quest_web: { schema_version: 2, builder_schema: 2, refresh_max_age_seconds: 30 } };
  expect(() => getQuestControlPath(capability)).toThrow('control path');
  expect(getQuestControlPath(capability, { allowUnavailable: true })).toBeNull();
  expect(() => getQuestControlPath({ ...capability, quest_web: { ...capability.quest_web, control_path: '/wrong' } }, { allowUnavailable: true })).toThrow('control path');
  await expect(verifyLiveQuestSsr({ sha, mode: 'deployment', codeHealth: async () => codeProof })).resolves.toMatchObject({ content_status: 'unavailable' });
  await expect(verifyLiveQuestSsr({ sha })).rejects.toThrow('control path');
});

it.each([
  { error_code: 'refresh_pending', source_age_seconds: 31 },
  { error_code: 'some_server_error', source_age_seconds: 1 },
  { kind: 'country', source_age_seconds: 1 },
  { source_age_seconds: 1, answer_pattern: 'must never be public' },
  { source_age_seconds: 1, publication_id: ['a'.repeat(64)] },
  { source_age_seconds: 1, quality: { indexable: false, word_count: 0, own_fivegram_ratio: null, answer_pattern: 'private' } },
])('rejects malformed or unbounded readiness instead of treating arbitrary 503 as pending: %j', (overrides) => {
  const { classifySelectedContent } = require('@/scripts/lib/ssrDeploymentReadiness');
  const payload = { schema_version: 2, state: 'temporary_failure', kind: 'detail', locale: 'ru',
    page: null, versions: [], error_code: 'refresh_pending', source_checked_at: 1000, source_age_seconds: 1, ...overrides };
  const api = Response.json(payload, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '5' } });
  expect(() => classifySelectedContent(api, payload, { kind: 'detail', locale: 'ru' })).toThrow();
});
