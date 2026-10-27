import type { ImmutableRequest } from 'expo-server';
import { loadQuestPublicRoute } from '@/components/quests/runtime/questRouteLoader';
import { fetchPublicRouteJson } from '@/utils/ssr/fetchPublicRouteJson';
import { questPrivateSnapshot } from '../../fixtures/questPublicProjection';
const { buildQuestWebProjection } = require('@/scripts/lib/questWebProjection');
const { loadSsgCatalogs } = require('@/i18n/babel-inline-plugin');
const path = require('node:path');

jest.mock('@/utils/ssr/fetchPublicRouteJson', () => ({ fetchPublicRouteJson: jest.fn() }));
const fetchMock = fetchPublicRouteJson as jest.Mock;
const source = buildQuestWebProjection(questPrivateSnapshot(), loadSsgCatalogs(path.resolve(__dirname, '../../..')).catalogs);
const request = (signal = new AbortController().signal) => ({ signal } as ImmutableRequest);
const raw = (locale: string) => ({ ...source.pages.find((entry: { kind: string; locale: string }) => entry.kind === 'detail' && entry.locale === locale),
  schema_version: 2, state: 'available', publication_id: 'b'.repeat(64), corpus_revision: 'c'.repeat(64), ru_source_path: '/quests/7/fixture-city-walk',
  versions: source.pages.filter((entry: { kind: string }) => entry.kind === 'detail').map((entry: { locale: string; canonical_path: string; content_revision: string }) =>
    ({ locale: entry.locale, path: entry.canonical_path, content_revision: entry.content_revision })) });

describe('quest public loader', () => {
  const original = process.env.EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR;
  beforeEach(() => { process.env.EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR = 'true'; fetchMock.mockReset().mockResolvedValue(raw('ru')); });
  afterEach(() => { if (original === undefined) delete process.env.EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR; else process.env.EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR = original; });

  it('keeps static export, disabled rollout and unrelated catch-all paths network-free', async () => {
    await expect(loadQuestPublicRoute(undefined, { city: '[city]' })).resolves.toBeNull();
    await expect(loadQuestPublicRoute(request(), { missing: ['login'] })).resolves.toBeNull();
    process.env.EXPO_PUBLIC_QUEST_WEB_RUNTIME_SSR = 'false';
    await expect(loadQuestPublicRoute(request(), { city: '7', questId: 'fixture-city-walk' })).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shares one selected API request between loader and metadata, but never across requests', async () => {
    const signal = new AbortController().signal;
    const [first, second] = await Promise.all([loadQuestPublicRoute(request(signal), { city: '7', questId: 'fixture-city-walk' }),
      loadQuestPublicRoute(request(signal), { city: '7', questId: 'fixture-city-walk' })]);
    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).toBe('quests/web/detail/7/fixture-city-walk/?lang=ru');
    await loadQuestPublicRoute(request(), { city: '7', questId: 'fixture-city-walk' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('isolates simultaneous locale requests and serializes no private gameplay', async () => {
    fetchMock.mockImplementation(async (_request, endpoint: string) => raw(new URL(endpoint, 'https://example.test').searchParams.get('lang')!));
    const results = await Promise.all(['ru', 'be', 'uk', 'pl', 'en'].map((locale) => loadQuestPublicRoute(request(), locale === 'ru'
      ? { city: '7', questId: 'fixture-city-walk' } : { missing: [locale, 'quests', '7', 'fixture-city-walk'] })));
    expect(results.map((entry) => entry?.locale)).toEqual(['ru', 'be', 'uk', 'pl', 'en']);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(JSON.stringify(results)).not.toMatch(/"(?:task|hint|answer_pattern|progress)"/);
  });

  it('fails closed on a response from another locale or a broken publication', async () => {
    fetchMock.mockResolvedValueOnce(raw('pl'));
    await expect(loadQuestPublicRoute(request(), { city: '7', questId: 'fixture-city-walk' })).rejects.toMatchObject({ httpStatus: 503 });
    fetchMock.mockResolvedValueOnce({ ...raw('ru'), state: 'temporary_failure' });
    await expect(loadQuestPublicRoute(request(), { city: '7', questId: 'fixture-city-walk' })).rejects.toMatchObject({ httpStatus: 503 });
  });
});
