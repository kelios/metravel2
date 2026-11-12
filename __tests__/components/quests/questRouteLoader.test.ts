import type { ImmutableRequest } from 'expo-server';
import { loadQuestPublicRoute } from '@/components/quests/runtime/questRouteLoader';
import { fetchPublicRouteJson } from '@/utils/ssr/fetchPublicRouteJson';
import { questPrivateSnapshot, questPublicApiResponse, questPublicLocales } from '../../fixtures/questPublicProjection';
const { buildQuestWebProjection } = require('@/scripts/lib/questWebProjection');
const { loadSsgCatalogs } = require('@/i18n/babel-inline-plugin');
const path = require('node:path');

jest.mock('@/utils/ssr/fetchPublicRouteJson', () => ({ fetchPublicRouteJson: jest.fn() }));
const fetchMock = fetchPublicRouteJson as jest.Mock;
const snapshot = questPrivateSnapshot();
const source = buildQuestWebProjection(snapshot, loadSsgCatalogs(path.resolve(__dirname, '../../..')).catalogs);
const request = (signal = new AbortController().signal) => ({ signal } as ImmutableRequest);
const raw = (locale: string) => questPublicApiResponse(source.pages, snapshot, locale as (typeof questPublicLocales)[number]);

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

  // #2896: публикация ответила 404. Документ по-прежнему падает кодом 404 (его
  // отдаст nginx оболочкой «не найдено»), а клиентский запрос данных маршрута —
  // `Accept: application/json` от expo-router — получает маркер `not_found`:
  // иначе переход на такой адрес заканчивался «Failed to load loader data».
  it('turns a publication 404 into a not_found marker for client loader-data requests only', async () => {
    const notFound = Object.assign(new Error('Not Found'), { httpStatus: 404 });
    fetchMock.mockRejectedValue(notFound);
    const documentRequest = { signal: new AbortController().signal,
      headers: new Headers({ accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }) } as unknown as ImmutableRequest;
    await expect(loadQuestPublicRoute(documentRequest, { city: 'this-quest-does-not-exist-123' })).rejects.toMatchObject({ httpStatus: 404 });
    await expect(loadQuestPublicRoute(request(), { city: 'this-quest-does-not-exist-123' })).rejects.toMatchObject({ httpStatus: 404 });

    const dataRequest = { signal: new AbortController().signal, headers: new Headers({ accept: 'application/json' }) } as unknown as ImmutableRequest;
    await expect(loadQuestPublicRoute(dataRequest, { city: 'this-quest-does-not-exist-123' })).resolves.toEqual(
      { kind: 'not_found', path: '/quests/this-quest-does-not-exist-123', httpStatus: 404 });
    await expect(loadQuestPublicRoute(dataRequest, { country: 'nope-xyz' })).resolves.toMatchObject({ kind: 'not_found', path: '/quests/country/nope-xyz' });
    // 503 — не «нет такого адреса»: клиент не должен рисовать «не найдено» на сбое.
    fetchMock.mockRejectedValue(Object.assign(new Error('Service Unavailable'), { httpStatus: 503 }));
    await expect(loadQuestPublicRoute(dataRequest, { city: 'grodno' })).rejects.toMatchObject({ httpStatus: 503 });
  });

  it('fails closed on a response from another locale or a broken publication', async () => {
    fetchMock.mockResolvedValueOnce(raw('pl'));
    await expect(loadQuestPublicRoute(request(), { city: '7', questId: 'fixture-city-walk' })).rejects.toMatchObject({ httpStatus: 503 });
    fetchMock.mockResolvedValueOnce({ ...raw('ru'), state: 'temporary_failure' });
    await expect(loadQuestPublicRoute(request(), { city: '7', questId: 'fixture-city-walk' })).rejects.toMatchObject({ httpStatus: 503 });
  });
});
